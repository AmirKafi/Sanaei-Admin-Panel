import { prisma } from "./prisma"
import type { PanelClientTraffic } from "./panel-traffic"
import { normalizeEmail } from "./panel-traffic"
import { saveUsageSnapshot } from "./usage-snapshot"
import { findLogicalClientForPanel, stripPanelEmailAffix } from "./client-resolve"

export async function upsertClientFromPanel(
  inboundId: number,
  panelClient: PanelClientTraffic,
  options?: { skipUsageSnapshot?: boolean; tx?: any }
): Promise<{ clientId: number; linkId: number }> {
  const db = options?.tx || prisma
  const emailKey = panelClient.email || panelClient.uuid

  let client = await findLogicalClientForPanel({
    uuid: panelClient.uuid,
    email: panelClient.email,
  }, options?.tx)

  if (!client) {
    const baseName = stripPanelEmailAffix(panelClient.email || "")
    client = await db.client.create({
      data: {
        uuid:
          panelClient.uuid ||
          (typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : String(Date.now())),
        name: baseName || emailKey,
        totalQuota: BigInt(panelClient.quotaBytes || 0),
        enabled: panelClient.enabled,
        expiryTime: panelClient.expiryTime,
      },
    })
  } else {
    const updates: {
      totalQuota?: bigint
      enabled?: boolean
      expiryTime?: Date | null
      name?: string
    } = {}
    if (panelClient.quotaBytes > 0 && client.totalQuota < BigInt(panelClient.quotaBytes)) {
      updates.totalQuota = BigInt(panelClient.quotaBytes)
    }
    if (panelClient.expiryTime && !client.expiryTime) {
      updates.expiryTime = panelClient.expiryTime
    }
    if (Object.keys(updates).length > 0) {
      client = await db.client.update({ where: { id: client.id }, data: updates })
    }
  }

  let link = await db.clientInbound.findUnique({
    where: {
      clientId_inboundId: { clientId: client.id, inboundId },
    },
  })

  if (!link) {
    link = await db.clientInbound.create({
      data: {
        clientId: client.id,
        inboundId,
        remoteEmail: panelClient.email,
        remoteId: panelClient.panelClientId || panelClient.uuid,
        enabled: panelClient.enabled,
      },
    })
  } else {
    link = await db.clientInbound.update({
      where: { id: link.id },
      data: {
        remoteEmail: panelClient.email || link.remoteEmail,
        remoteId: panelClient.panelClientId || panelClient.uuid || link.remoteId,
        enabled: panelClient.enabled,
      },
    })
  }

  if (!options?.skipUsageSnapshot) {
    await saveUsageSnapshot(link.id, panelClient.up, panelClient.down, options?.tx)
  }

  return { clientId: client.id, linkId: link.id }
}

export function linkMatchesPanelClient(
  link: { remoteEmail: string | null; remoteId: string | null },
  panelClient: PanelClientTraffic,
  clientUuid?: string | null
): boolean {
  const linkEmail = normalizeEmail(link.remoteEmail)
  const panelEmail = normalizeEmail(panelClient.email)
  if (linkEmail && panelEmail && linkEmail === panelEmail) return true

  const rid = String(link.remoteId ?? "").trim()
  if (rid && panelClient.panelClientId && rid === panelClient.panelClientId) return true
  if (rid && panelClient.uuid && rid === panelClient.uuid) return true

  const uuid = String(clientUuid ?? "").trim()
  if (uuid && panelClient.uuid && uuid === panelClient.uuid) return true

  return false
}
