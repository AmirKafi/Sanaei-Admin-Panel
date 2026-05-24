import { prisma } from "./prisma"
import { panelIsConfigured, getPanelSettings } from "./sanaei"
import { syncInboundRecordsFromPanel } from "./inbound-panel-sync"
import {
  findPanelClientForLink,
  type PanelClientTraffic,
  type ParsedPanelInbound,
} from "./panel-traffic"
import { linkMatchesPanelClient, upsertClientFromPanel } from "./panel-client-sync"
import { bulkSaveUsageSnapshots } from "./usage-snapshot"
import {
  applyPanelClientDisables,
  restartPanelXrayService,
  type PanelClientDisableOp,
} from "./panel-client-control"

export { saveUsageSnapshot } from "./usage-snapshot"

const BATCH_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

function trackClientUsage(
  clientId: number,
  panelClient: PanelClientTraffic,
  clientUsageTotals: Map<number, bigint>,
  clientHasRemoteMatch: Map<number, { anyEnabled: boolean; anyRemoteFound: boolean }>
) {
  const previousTotal = clientUsageTotals.get(clientId) ?? 0n
  clientUsageTotals.set(
    clientId,
    previousTotal + BigInt(panelClient.up) + BigInt(panelClient.down)
  )

  const status = clientHasRemoteMatch.get(clientId) ?? {
    anyEnabled: false,
    anyRemoteFound: false,
  }
  status.anyRemoteFound = true
  if (panelClient.enabled) status.anyEnabled = true
  clientHasRemoteMatch.set(clientId, status)
}

export { syncPanelInboundsOnly } from "./inbound-panel-sync"

export async function syncPanelInboundsAndClients() {
  if (!(await panelIsConfigured())) {
    console.warn('[usageChecker] Panel not configured')
    return { error: "panel_not_configured" }
  }

  console.log('[usageChecker] Starting sync...')
  const startTime = Date.now()

  const inboundSync = await syncInboundRecordsFromPanel()
  if (inboundSync.error) {
    return { error: inboundSync.error }
  }

  const {
    syncedInbounds: inboundUpdates,
    parsedRemotes,
    localInboundByPanelId,
    linksByInboundId,
  } = inboundSync

  const allLinks = [...linksByInboundId.values()].flat()
  const syncResults: any[] = []
  const clientUsageTotals = new Map<number, bigint>()
  const clientHasRemoteMatch = new Map<
    number,
    { anyEnabled: boolean; anyRemoteFound: boolean }
  >()

  const linkRowUpdates: Array<{
    id: number
    data: { enabled?: boolean; remoteEmail: string; remoteId: string }
  }> = []
  const usageSnapshotUpdates: Array<{
    clientInboundId: number
    up: number
    down: number
  }> = []
  const importTasks: Array<{
    inboundId: number
    panelId: string
    panelClient: PanelClientTraffic
  }> = []

  for (const { parsed } of parsedRemotes) {
    const localInbound = localInboundByPanelId.get(parsed.panelId)
    if (!localInbound) continue

    const inboundId = localInbound.id
    const links = linksByInboundId.get(inboundId) ?? []

    for (const link of links) {
      const panelClient = findPanelClientForLink(
        link,
        parsed.clients,
        link.client.uuid
      )
      if (!panelClient) continue

      const remoteId = (panelClient.panelClientId || panelClient.uuid).toString()
      
      const hasRemoteIdChanged = link.remoteId !== remoteId
      const hasRemoteEmailChanged = link.remoteEmail !== panelClient.email
      const hasEnabledChanged = link.enabled !== panelClient.enabled

      if (hasRemoteIdChanged || hasRemoteEmailChanged || hasEnabledChanged) {
        const data: any = {}
        if (hasRemoteIdChanged) data.remoteId = remoteId
        if (hasRemoteEmailChanged) data.remoteEmail = panelClient.email
        if (hasEnabledChanged) data.enabled = panelClient.enabled

        linkRowUpdates.push({
          id: link.id,
          data
        })
      }

      usageSnapshotUpdates.push({
        clientInboundId: link.id,
        up: panelClient.up,
        down: panelClient.down,
      })

      trackClientUsage(
        link.clientId,
        panelClient,
        clientUsageTotals,
        clientHasRemoteMatch
      )

      syncResults.push({
        inboundPanelId: parsed.panelId,
        clientInboundId: link.id,
        remoteEmail: panelClient.email,
        enabled: panelClient.enabled,
        up: panelClient.up,
        down: panelClient.down,
      })
    }

    for (const panelClient of parsed.clients) {
      const alreadyLinked = links.some((link) =>
        linkMatchesPanelClient(link, panelClient, link.client.uuid)
      )
      if (!alreadyLinked) {
        importTasks.push({ inboundId, panelId: parsed.panelId, panelClient })
      }
    }
  }

  let disabledOnPanel = 0
  let xrayRestarted = false

  await prisma.$transaction(
    async (tx) => {
      // 1. Update existing links - use batch updateMany instead of individual updates
      if (linkRowUpdates.length > 0) {
        // Group updates by data properties for efficient batch processing
        const updatesByKey = new Map<string, number[]>()
        for (const update of linkRowUpdates) {
          const key = JSON.stringify(update.data)
          const ids = updatesByKey.get(key) ?? []
          ids.push(update.id)
          updatesByKey.set(key, ids)
        }
        
        // Execute batch updates grouped by data
        for (const [key, ids] of updatesByKey.entries()) {
          const data = JSON.parse(key)
          await tx.clientInbound.updateMany({
            where: { id: { in: ids } },
            data,
          })
        }
      }

      // 2. Save usage snapshots for existing links
      if (usageSnapshotUpdates.length > 0) {
        await bulkSaveUsageSnapshots(usageSnapshotUpdates, tx)
      }

      // 3. Handle imports (new clients from panel)
      const importUsageUpdates: Array<{
        clientInboundId: number
        up: number
        down: number
      }> = []

      for (const task of importTasks) {
        const { clientId, linkId } = await upsertClientFromPanel(
          task.inboundId,
          task.panelClient,
          { skipUsageSnapshot: true, tx }
        )

        importUsageUpdates.push({
          clientInboundId: linkId,
          up: task.panelClient.up,
          down: task.panelClient.down,
        })

        trackClientUsage(
          clientId,
          task.panelClient,
          clientUsageTotals,
          clientHasRemoteMatch
        )

        syncResults.push({
          inboundPanelId: task.panelId,
          clientInboundId: linkId,
          remoteEmail: task.panelClient.email,
          enabled: task.panelClient.enabled,
          up: task.panelClient.up,
          down: task.panelClient.down,
          imported: true,
        })
      }

      // 4. Save usage snapshots for imported links
      if (importUsageUpdates.length > 0) {
        await bulkSaveUsageSnapshots(importUsageUpdates, tx)
      }

      // 5. Collect and apply client status updates (enabled/disabled)
      const clientIds = [...clientHasRemoteMatch.keys()]
      const localClients =
        clientIds.length > 0
          ? await tx.client.findMany({ where: { id: { in: clientIds } } })
          : []
      const localClientById = new Map(localClients.map((c) => [c.id, c]))

      const remoteInboundByPanelId = new Map<string, Record<string, unknown>>()
      const parsedByPanelId = new Map<string, ParsedPanelInbound>()
      for (const { remote, parsed } of parsedRemotes) {
        remoteInboundByPanelId.set(parsed.panelId, remote)
        parsedByPanelId.set(parsed.panelId, parsed)
      }

      const inboundByLocalId = new Map(
        [...localInboundByPanelId.values()].map((inbound) => [inbound.id, inbound])
      )
      const linksByClientId = new Map<number, typeof allLinks>()
      for (const link of allLinks) {
        const group = linksByClientId.get(link.clientId) ?? []
        group.push(link)
        linksByClientId.set(link.clientId, group)
      }

      const clientRowUpdates: Array<{ id: number; enabled: boolean }> = []
      const panelDisableOps: PanelClientDisableOp[] = []
      const linkIdsToDisable: number[] = []

      for (const [clientId, status] of clientHasRemoteMatch.entries()) {
        const client = localClientById.get(clientId)
        if (!client || !status.anyRemoteFound) continue

        const used = clientUsageTotals.get(clientId) ?? 0n
        const quota = BigInt(client.totalQuota ?? 0)
        const shouldDisable = quota > 0n && used >= quota
        const desiredEnabled = !shouldDisable && status.anyEnabled

        if (client.enabled !== desiredEnabled) {
          clientRowUpdates.push({ id: clientId, enabled: desiredEnabled })
        }

        if (!shouldDisable) continue

        const clientLinks = linksByClientId.get(clientId) ?? []
        for (const link of clientLinks) {
          const localInbound = inboundByLocalId.get(link.inboundId)
          const panelId = localInbound?.panelId
          if (!panelId) continue

          const parsed = parsedByPanelId.get(panelId)
          const remoteInbound = remoteInboundByPanelId.get(panelId)
          if (!parsed || !remoteInbound) continue

          const panelClient = findPanelClientForLink(
            link,
            parsed.clients,
            link.client.uuid
          )
          if (!panelClient?.uuid || !panelClient.enabled) continue

          panelDisableOps.push({
            inboundPanelId: panelId,
            clientUuid: panelClient.uuid,
            remoteInbound,
          })
          linkIdsToDisable.push(link.id)
        }
      }

      if (clientRowUpdates.length > 0) {
        // Group clients by enabled status for batch updates
        const enabledIds = clientRowUpdates.filter((item) => item.enabled).map((item) => item.id)
        const disabledIds = clientRowUpdates.filter((item) => !item.enabled).map((item) => item.id)
        
        if (enabledIds.length > 0) {
          await tx.client.updateMany({
            where: { id: { in: enabledIds } },
            data: { enabled: true },
          })
        }
        if (disabledIds.length > 0) {
          await tx.client.updateMany({
            where: { id: { in: disabledIds } },
            data: { enabled: false },
          })
        }
      }

      // 6. Handle panel disables if needed
      if (panelDisableOps.length > 0) {
        const count = await applyPanelClientDisables(panelDisableOps)
        if (count > 0) {
          disabledOnPanel = count
          if (linkIdsToDisable.length > 0) {
            await tx.clientInbound.updateMany({
              where: { id: { in: [...new Set(linkIdsToDisable)] } },
              data: { enabled: false },
            })
          }
          xrayRestarted = true
        }
      }
    },
    { timeout: 180_000 }
  )

  if (xrayRestarted) {
    await restartPanelXrayService()
  }

  return {
    syncedInbounds: inboundUpdates,
    updatedLinks: syncResults,
    disabledOnPanel,
    xrayRestarted,
    checkedAt: Date.now(),
    duration: Date.now() - startTime,
    stats: {
      linksUpdated: linkRowUpdates.length,
      usageSnapshotsUpdated: usageSnapshotUpdates.length,
      clientsDisabled: disabledOnPanel,
      clientsImported: importTasks.length,
    },
  }
}

export async function runUsageCheck() {
  if (!(await panelIsConfigured())) {
    console.warn('[runUsageCheck] Panel not configured')
    return { error: "panel_not_configured" }
  }
  
  try {
    console.log('[runUsageCheck] Starting usage check...')
    const result = await syncPanelInboundsAndClients()
    console.log('[runUsageCheck] Completed in', (result as any).duration, 'ms', (result as any).stats)
    return result
  } catch (error) {
    console.error('[runUsageCheck] Error:', error)
    throw error
  }
}

export async function getCheckIntervalSeconds(): Promise<number> {
  try {
    const s = await getPanelSettings()
    return Number(s.checkIntervalSeconds || 60) || 60
  } catch {
    return 60
  }
}

export function clearMemoryCache() {
  if (global.gc) global.gc()
}
