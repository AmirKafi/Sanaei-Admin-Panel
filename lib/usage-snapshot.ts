import { prisma } from "./prisma"

const BATCH_SIZE = 100

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size))
  }
  return batches
}

export async function saveUsageSnapshot(
  clientInboundId: number,
  up: number,
  down: number,
  tx?: any
) {
  return bulkSaveUsageSnapshots([{ clientInboundId, up, down }], tx)
}

export async function bulkSaveUsageSnapshots(
  updates: Array<{ clientInboundId: number; up: number; down: number }>,
  tx?: any
) {
  if (updates.length === 0) return

  const client = tx || prisma
  const linkIds = [...new Set(updates.map((u) => u.clientInboundId))]
  const existing = await client.usageSnapshot.findMany({
    where: { clientInboundId: { in: linkIds } },
  })
  const existingByLinkId = new Map(
    existing.map((row) => [row.clientInboundId, row])
  )

  const toCreate: Array<{
    clientInboundId: number
    up: bigint
    down: bigint
  }> = []
  const toUpdate: Array<{ id: number; up: bigint; down: bigint }> = []
  const recordedAt = new Date()

  for (const item of updates) {
    const row = existingByLinkId.get(item.clientInboundId)
    const up = BigInt(item.up)
    const down = BigInt(item.down)
    if (row) {
      if (row.up !== up || row.down !== down) {
        toUpdate.push({ id: row.id, up, down })
      }
    } else {
      toCreate.push({ clientInboundId: item.clientInboundId, up, down })
    }
  }

  const runUpdates = async (db: any) => {
    if (toCreate.length > 0) {
      await db.usageSnapshot.createMany({ data: toCreate })
    }
    if (toUpdate.length > 0) {
      // Use SQL upsert or batch updates via executeRawUnsafe for better performance
      // Instead of N individual queries, we'll do batch updates
      for (const batch of chunk(toUpdate, BATCH_SIZE)) {
        // Build SQL for batch update
        const cases = batch
          .map((item) => `WHEN ${item.id} THEN CAST('${item.up}' AS INTEGER)`)
          .join(' ')
        const downCases = batch
          .map((item) => `WHEN ${item.id} THEN CAST('${item.down}' AS INTEGER)`)
          .join(' ')
        const ids = batch.map((item) => item.id).join(',')
        const now = recordedAt.toISOString()

        await db.$executeRawUnsafe(
          `UPDATE "UsageSnapshot" SET "up" = CASE "id" ${cases} ELSE "up" END, "down" = CASE "id" ${downCases} ELSE "down" END, "recordedAt" = '${now}' WHERE "id" IN (${ids})`
        )
      }
    }
  }

  if (tx) {
    await runUpdates(tx)
  } else {
    await prisma.$transaction(runUpdates)
  }
}
