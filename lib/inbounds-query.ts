import { prisma } from "./prisma"

export type InboundListRow = {
  id: number
  panelId: string | null
  remark: string
  tag: string | null
  protocol: string
  port: number
  network: string
  tls: boolean
  enabled: boolean
  clientCount: number
  trafficUp: bigint
  trafficDown: bigint
  expiryTime: Date | null
  createdAt: Date
  updatedAt: Date
  up: number
  down: number
  allTime: number
}

/** Single-query-friendly inbound list with aggregated link usage. */
export async function listInboundsWithUsage(): Promise<InboundListRow[]> {
  const [rows, links, snapshots] = await Promise.all([
    prisma.inbound.findMany(),
    prisma.clientInbound.findMany({ select: { id: true, inboundId: true } }),
    prisma.usageSnapshot.findMany({
      select: { clientInboundId: true, up: true, down: true },
    }),
  ])

  const inboundIdByLinkId = new Map(links.map((l) => [l.id, l.inboundId]))
  const usageByInbound = new Map<number, { up: number; down: number }>()

  for (const snapshot of snapshots) {
    const inboundId = inboundIdByLinkId.get(snapshot.clientInboundId)
    if (inboundId == null) continue
    const existing = usageByInbound.get(inboundId) ?? { up: 0, down: 0 }
    usageByInbound.set(inboundId, {
      up: existing.up + Number(snapshot.up),
      down: existing.down + Number(snapshot.down),
    })
  }

  return rows.map((inbound) => {
    const snapshotUp = usageByInbound.get(inbound.id)?.up ?? 0
    const snapshotDown = usageByInbound.get(inbound.id)?.down ?? 0
    const panelUp = Number(inbound.trafficUp ?? 0)
    const panelDown = Number(inbound.trafficDown ?? 0)
    const up = panelUp > 0 ? panelUp : snapshotUp
    const down = panelDown > 0 ? panelDown : snapshotDown
    return {
      ...inbound,
      up,
      down,
      allTime: up + down,
    }
  })
}
