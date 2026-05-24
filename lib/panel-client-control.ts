import { panelApiRequest } from "./sanaei"
import { parseSettingsClients, resolvePanelList, normalizeEmail } from "./panel-traffic"
import { quotaBytesToPanelTotalField } from "./quota"

export type PanelClientMatch = {
  uuid?: string | null
  email?: string | null
  remoteId?: string | null
}

export function findSettingsClient(
  remoteInbound: Record<string, unknown>,
  match: PanelClientMatch
): Record<string, unknown> | null {
  const { byUuid, byEmail } = parseSettingsClients(remoteInbound)
  const uuid = String(match.uuid ?? "").trim()
  const email = normalizeEmail(match.email)
  const remoteId = String(match.remoteId ?? "").trim()

  if (uuid && byUuid.has(uuid)) {
    return { ...(byUuid.get(uuid) as Record<string, unknown>) }
  }
  if (email && byEmail.has(email)) {
    return { ...(byEmail.get(email) as Record<string, unknown>) }
  }
  if (remoteId && byUuid.has(remoteId)) {
    return { ...(byUuid.get(remoteId) as Record<string, unknown>) }
  }

  return null
}

export function preparePanelClientForUpdate(
  settingsClient: Record<string, unknown>,
  patch: { enable?: boolean; totalGB?: number; expiryTime?: number | null; email?: string }
): Record<string, unknown> {
  const client: Record<string, unknown> = { ...settingsClient }
  const id = String(client.id ?? client.uuid ?? "").trim()
  if (id) client.id = id

  if (patch.enable !== undefined) client.enable = patch.enable
  if (patch.totalGB !== undefined) client.totalGB = patch.totalGB
  if (patch.expiryTime !== undefined) client.expiryTime = patch.expiryTime ?? 0
  if (patch.email !== undefined) client.email = patch.email

  delete client.up
  delete client.down
  delete client.allTime
  delete client.total
  delete client.inboundId
  delete client.lastOnline

  return client
}

export async function updatePanelClientOnInbound(
  inboundPanelId: string | number,
  clientUuid: string,
  settingsClient: Record<string, unknown>
) {
  const uuid = String(clientUuid).trim()
  const body = {
    id: Number(inboundPanelId),
    settings: JSON.stringify({ clients: [settingsClient] }),
  }
  await panelApiRequest(
    `/inbounds/updateClient/${encodeURIComponent(uuid)}`,
    "POST",
    body
  )
}

export async function setPanelClientEnabledFromInbound(
  remoteInbound: Record<string, unknown>,
  inboundPanelId: string | number,
  match: PanelClientMatch,
  enabled: boolean,
  options?: { totalQuotaBytes?: number }
): Promise<boolean> {
  const settingsClient = findSettingsClient(remoteInbound, match)
  if (!settingsClient) return false

  const clientUuid = String(
    match.uuid?.trim() || settingsClient.id || settingsClient.uuid || ""
  ).trim()
  if (!clientUuid) return false

  const patch: { enable: boolean; totalGB?: number } = { enable: enabled }
  if (options?.totalQuotaBytes !== undefined) {
    patch.totalGB = quotaBytesToPanelTotalField(options.totalQuotaBytes)
  }

  const payload = preparePanelClientForUpdate(settingsClient, patch)
  await updatePanelClientOnInbound(inboundPanelId, clientUuid, payload)
  return true
}

export type PanelClientDisableOp = {
  inboundPanelId: string
  clientUuid: string
  remoteInbound: Record<string, unknown>
}

export async function applyPanelClientDisables(
  ops: PanelClientDisableOp[]
): Promise<number> {
  let count = 0
  for (const op of ops) {
    try {
      const ok = await setPanelClientEnabledFromInbound(
        op.remoteInbound,
        op.inboundPanelId,
        { uuid: op.clientUuid },
        false
      )
      if (ok) count++
    } catch (error) {
      console.error(
        `[panel-client-control] Failed to disable ${op.clientUuid} on inbound ${op.inboundPanelId}:`,
        error
      )
    }
  }
  return count
}

export async function restartPanelXrayService(): Promise<void> {
  await panelApiRequest("/server/restartXrayService", "POST")
}

export async function disableClientLinksOnPanel(
  links: Array<{
    inboundPanelId: string
    remoteEmail: string | null
    remoteId: string | null
    clientUuid?: string | null
  }>,
  remoteInbounds?: Record<string, unknown>[]
): Promise<number> {
  let inbounds = remoteInbounds
  if (!inbounds) {
    const response = await panelApiRequest("/inbounds/list", "GET")
    inbounds = resolvePanelList(response) as Record<string, unknown>[]
  }

  const inboundByPanelId = new Map(
    inbounds.map((inbound) => [
      String(inbound.id ?? inbound._id ?? inbound.inboundId ?? "").trim(),
      inbound,
    ])
  )

  const ops: PanelClientDisableOp[] = []

  for (const link of links) {
    const remoteInbound = inboundByPanelId.get(link.inboundPanelId)
    if (!remoteInbound) continue

    const settingsClient = findSettingsClient(remoteInbound, {
      uuid: link.clientUuid,
      email: link.remoteEmail,
      remoteId: link.remoteId,
    })
    if (!settingsClient) continue

    const clientUuid = String(
      link.clientUuid?.trim() || settingsClient.id || settingsClient.uuid || ""
    ).trim()
    if (!clientUuid) continue

    ops.push({
      inboundPanelId: link.inboundPanelId,
      clientUuid,
      remoteInbound,
    })
  }

  return applyPanelClientDisables(ops)
}

export async function syncClientDetailsOnPanel(
  links: Array<{
    inboundPanelId: string
    remoteEmail: string | null
    remoteId: string | null
    clientUuid?: string | null
  }>,
  patch: {
    enabled?: boolean
    totalQuotaBytes?: number
    expiryTime?: number | null
    name?: string
  },
  remoteInbounds?: Record<string, unknown>[]
): Promise<{ count: number; updatedEmails: Array<{ inboundPanelId: string; oldEmail: string; newEmail: string }> }> {
  let inbounds = remoteInbounds
  if (!inbounds) {
    const response = await panelApiRequest("/inbounds/list", "GET")
    inbounds = resolvePanelList(response) as Record<string, unknown>[]
  }

  const inboundByPanelId = new Map(
    inbounds.map((inbound) => [
      String(inbound.id ?? inbound._id ?? inbound.inboundId ?? "").trim(),
      inbound,
    ])
  )

  let count = 0
  const updatedEmails: Array<{ inboundPanelId: string; oldEmail: string; newEmail: string }> = []

  for (let i = 0; i < links.length; i++) {
    const link = links[i]
    const remoteInbound = inboundByPanelId.get(link.inboundPanelId)
    if (!remoteInbound) continue

    const settingsClient = findSettingsClient(remoteInbound, {
      uuid: link.clientUuid,
      email: link.remoteEmail,
      remoteId: link.remoteId,
    })
    if (!settingsClient) continue

    const clientUuid = String(
      link.clientUuid?.trim() || settingsClient.id || settingsClient.uuid || ""
    ).trim()
    if (!clientUuid) continue

    const updatePatch: any = {}
    if (patch.enabled !== undefined) updatePatch.enable = patch.enabled
    if (patch.totalQuotaBytes !== undefined) {
      updatePatch.totalGB = quotaBytesToPanelTotalField(patch.totalQuotaBytes)
    }
    if (patch.expiryTime !== undefined) {
      updatePatch.expiryTime = patch.expiryTime
    }
    
    if (patch.name !== undefined) {
      // Try to preserve the existing suffix if it's like _N or -ibN
      let suffix = `_${i}`
      if (link.remoteEmail) {
        if (link.remoteEmail.includes("_")) {
          const parts = link.remoteEmail.split("_")
          const lastPart = parts[parts.length - 1]
          if (!isNaN(parseInt(lastPart))) {
            suffix = `_${lastPart}`
          }
        } else if (link.remoteEmail.includes("-ib")) {
          const parts = link.remoteEmail.split("-ib")
          const lastPart = parts[parts.length - 1]
          if (!isNaN(parseInt(lastPart))) {
            suffix = `-ib${lastPart}`
          }
        }
      }

      const newEmail = patch.name + suffix
      updatePatch.email = newEmail
      if (link.remoteEmail && link.remoteEmail !== newEmail) {
        updatedEmails.push({
          inboundPanelId: link.inboundPanelId,
          oldEmail: link.remoteEmail,
          newEmail: newEmail,
        })
      }
    }

    const payload = preparePanelClientForUpdate(settingsClient, updatePatch)
    try {
      await updatePanelClientOnInbound(link.inboundPanelId, clientUuid, payload)
      count++
    } catch (error) {
      console.error(
        `[panel-client-control] Failed to update client on inbound ${link.inboundPanelId}:`,
        error
      )
    }
  }

  if (patch.enabled === false && count > 0) {
    await restartPanelXrayService()
  }

  return { count, updatedEmails }
}

export async function syncClientLinksEnabledOnPanel(
  links: Array<{
    inboundPanelId: string
    remoteEmail: string | null
    remoteId: string | null
    clientUuid?: string | null
  }>,
  enabled: boolean,
  options?: { totalQuotaBytes?: number },
  remoteInbounds?: Record<string, unknown>[]
): Promise<number> {
  let inbounds = remoteInbounds
  if (!inbounds) {
    const response = await panelApiRequest("/inbounds/list", "GET")
    inbounds = resolvePanelList(response) as Record<string, unknown>[]
  }

  const inboundByPanelId = new Map(
    inbounds.map((inbound) => [
      String(inbound.id ?? inbound._id ?? inbound.inboundId ?? "").trim(),
      inbound,
    ])
  )

  let count = 0
  for (const link of links) {
    const remoteInbound = inboundByPanelId.get(link.inboundPanelId)
    if (!remoteInbound) continue

    try {
      const ok = await setPanelClientEnabledFromInbound(
        remoteInbound,
        link.inboundPanelId,
        {
          uuid: link.clientUuid,
          email: link.remoteEmail,
          remoteId: link.remoteId,
        },
        enabled,
        options?.totalQuotaBytes !== undefined
          ? { totalQuotaBytes: options.totalQuotaBytes }
          : undefined
      )
      if (ok) count++
    } catch (error) {
      console.error(
        `[panel-client-control] Failed to set enable=${enabled} on inbound ${link.inboundPanelId}:`,
        error
      )
    }
  }

  if (!enabled && count > 0) {
    await restartPanelXrayService()
  }

  return count
}
