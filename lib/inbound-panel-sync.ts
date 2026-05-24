import type { Client, ClientInbound, Inbound } from "@prisma/client"
import { prisma } from "./prisma"
import { panelApiRequest, panelIsConfigured } from "./sanaei"
import { buildInboundSyncData } from "./inbound-sync"
import {
  parsePanelInbound,
  resolvePanelList,
  type ParsedPanelInbound,
} from "./panel-traffic"

const BATCH_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

export type SyncedInboundUpdate = {
  action: "insert" | "update" | "delete"
  panelId: string
  id: number
}

export type ParsedRemoteInbound = {
  remote: Record<string, unknown>
  parsed: ParsedPanelInbound
  inboundData: ReturnType<typeof buildInboundSyncData>
}

export type ClientInboundWithClient = ClientInbound & { client: Client }

export type InboundRecordsSyncResult = {
  error?: string
  syncedInbounds: SyncedInboundUpdate[]
  checkedAt: number
  parsedRemotes: ParsedRemoteInbound[]
  localInboundByPanelId: Map<string, Inbound>
  linksByInboundId: Map<number, ClientInboundWithClient[]>
}

/** Pull inbound rows from the panel and upsert local Inbound records (no client/usage sync). */
export async function syncInboundRecordsFromPanel(): Promise<InboundRecordsSyncResult> {
  if (!(await panelIsConfigured())) {
    return {
      error: "panel_not_configured",
      syncedInbounds: [],
      checkedAt: Date.now(),
      parsedRemotes: [],
      localInboundByPanelId: new Map(),
      linksByInboundId: new Map(),
    }
  }

  const response = await panelApiRequest("/inbounds/list", "GET")
  const list = resolvePanelList(response)

  const remotePanelIds = list
    .map((item: Record<string, unknown>) =>
      String(
        item.id ?? item._id ?? item.inboundId ?? item.panelId ?? ""
      ).trim()
    )
    .filter(Boolean)

  const parsedRemotes: ParsedRemoteInbound[] = []
  for (const remoteInbound of list) {
    const record = remoteInbound as Record<string, unknown>
    const parsed = parsePanelInbound(record)
    if (!parsed.panelId) continue
    parsedRemotes.push({
      remote: record,
      parsed,
      inboundData: buildInboundSyncData(record),
    })
  }

  const [allLocalInbounds, allLinks] = await Promise.all([
    prisma.inbound.findMany(),
    prisma.clientInbound.findMany({ include: { client: true } }),
  ])

  const localInboundByPanelId = new Map(
    allLocalInbounds
      .filter((inbound) => inbound.panelId)
      .map((inbound) => [inbound.panelId!, inbound])
  )
  const linksByInboundId = new Map<number, ClientInboundWithClient[]>()
  for (const link of allLinks) {
    const group = linksByInboundId.get(link.inboundId) ?? []
    group.push(link)
    linksByInboundId.set(link.inboundId, group)
  }

  const inboundUpdates: SyncedInboundUpdate[] = []
  const inboundCreates: Array<{
    panelId: string
    data: ReturnType<typeof buildInboundSyncData>
  }> = []
  const inboundRowUpdates: Array<{
    id: number
    panelId: string
    data: ReturnType<typeof buildInboundSyncData>
  }> = []

  for (const { parsed, inboundData } of parsedRemotes) {
    const localInbound = localInboundByPanelId.get(parsed.panelId)
    if (!localInbound) {
      inboundCreates.push({ panelId: parsed.panelId, data: inboundData })
    } else {
      inboundRowUpdates.push({
        id: localInbound.id,
        panelId: parsed.panelId,
        data: inboundData,
      })
    }
  }

  await prisma.$transaction(
    async (tx) => {
      for (const item of inboundCreates) {
        const created = await tx.inbound.create({
          data: { panelId: item.panelId, ...item.data },
        })
        inboundUpdates.push({
          action: "insert",
          panelId: item.panelId,
          id: created.id,
        })
        localInboundByPanelId.set(item.panelId, created)
        linksByInboundId.set(created.id, [])
      }

      for (const batch of chunk(inboundRowUpdates, BATCH_SIZE)) {
        await Promise.all(
          batch.map((item) =>
            tx.inbound.update({ where: { id: item.id }, data: item.data })
          )
        )
        for (const item of batch) {
          inboundUpdates.push({
            action: "update",
            panelId: item.panelId,
            id: item.id,
          })
          const existing = localInboundByPanelId.get(item.panelId)
          if (existing) {
            localInboundByPanelId.set(item.panelId, {
              ...existing,
              ...item.data,
            })
          }
        }
      }
    },
    { timeout: 120_000 }
  )

  const staleInbounds = allLocalInbounds.filter(
    (inbound) => inbound.panelId && !remotePanelIds.includes(inbound.panelId)
  )

  if (staleInbounds.length > 0) {
    const staleInboundIds = staleInbounds.map((i) => i.id)
    const staleLinkIds = allLinks
      .filter((l) => staleInboundIds.includes(l.inboundId))
      .map((l) => l.id)

    await prisma.$transaction(async (tx) => {
      if (staleLinkIds.length > 0) {
        await tx.usageSnapshot.deleteMany({
          where: { clientInboundId: { in: staleLinkIds } },
        })
        await tx.clientInbound.deleteMany({ where: { id: { in: staleLinkIds } } })
      }
      await tx.inbound.deleteMany({ where: { id: { in: staleInboundIds } } })
    })

    for (const inbound of staleInbounds) {
      if (!inbound.panelId) continue
      inboundUpdates.push({
        action: "delete",
        panelId: inbound.panelId,
        id: inbound.id,
      })
      localInboundByPanelId.delete(inbound.panelId)
      linksByInboundId.delete(inbound.id)
    }
  }

  return {
    syncedInbounds: inboundUpdates,
    checkedAt: Date.now(),
    parsedRemotes,
    localInboundByPanelId,
    linksByInboundId,
  }
}

export async function syncPanelInboundsOnly() {
  const result = await syncInboundRecordsFromPanel()
  if (result.error) {
    return { error: result.error }
  }
  return {
    syncedInbounds: result.syncedInbounds,
    checkedAt: result.checkedAt,
  }
}
