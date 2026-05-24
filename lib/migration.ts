import { prisma } from "./prisma"
import { panelApiRequest, panelIsConfigured } from "./sanaei"
import {
  buildMigratedClientEmail,
  quotaBytesToPanelTotalField,
  normalizeQuotaToBytes,
  resolveNameAffixMode,
  type NameAffixMode,
} from "./quota"
import { saveUsageSnapshot } from "./usage-snapshot"
import { parsePanelInbound, resolvePanelList } from "./panel-traffic"
import { findLogicalClientForPanel, stripPanelEmailAffix } from "./client-resolve"

export interface MigrationResult {
  success: boolean
  summary: {
    sourceInboundId: number
    targetInboundId: number
    totalProcessed: number
    migrated: number
    skipped: number
    failed: number
  }
  details: MigrationDetail[]
  errors: string[]
}

export interface MigrationDetail {
  clientId: number
  clientName: string
  clientUuid: string
  status: "migrated" | "skipped" | "failed" | "duplicate"
  newRemoteEmail?: string
  newRemoteId?: string
  error?: string
}

/**
 * Validate that migration is possible
 */
export async function validateMigration(
  sourceInboundId: number,
  targetInboundId: number
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []

  if (sourceInboundId === targetInboundId) {
    errors.push("Source and target inbound must be different")
  }

  const sourceInbound = await prisma.inbound.findUnique({
    where: { id: sourceInboundId },
  })
  if (!sourceInbound) {
    errors.push(`Source inbound (ID: ${sourceInboundId}) not found`)
  }

  const targetInbound = await prisma.inbound.findUnique({
    where: { id: targetInboundId },
  })
  if (!targetInbound) {
    errors.push(`Target inbound (ID: ${targetInboundId}) not found`)
  }

  if (targetInbound && !targetInbound.panelId) {
    errors.push(`Target inbound must have a panel ID to add clients`)
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get all clients for a specific inbound
 */
export async function getClientsForInbound(inboundId: number) {
  const links = await prisma.clientInbound.findMany({
    where: { inboundId },
    include: {
      client: true,
      inbound: true,
    },
  })

  return links
}

/**
 * Whether this logical client already has a link on the target inbound.
 */
async function clientExistsInTarget(
  clientId: number,
  targetInboundId: number
): Promise<boolean> {
  const existing = await prisma.clientInbound.findUnique({
    where: {
      clientId_inboundId: {
        clientId,
        inboundId: targetInboundId,
      },
    },
  })
  return !!existing
}

/**
 * Merge duplicate Client rows created by older migrations into the source inbound client.
 */
export async function reconcileMigrationDuplicates(sourceInboundId: number): Promise<number> {
  const sourceLinks = await getClientsForInbound(sourceInboundId)
  let merged = 0

  for (const link of sourceLinks) {
    const sourceClient = link.client
    const rawEmail = (link.remoteEmail || sourceClient.name || "").trim()
    if (!rawEmail) continue

    const baseEmail = stripPanelEmailAffix(rawEmail)
    if (!baseEmail) continue

    const duplicates = await prisma.client.findMany({
      where: {
        id: { not: sourceClient.id },
        OR: [
          { name: { startsWith: `${baseEmail}_to_` } },
          { name: { startsWith: `${baseEmail}-ib` } },
          { name: { endsWith: `_${baseEmail}` } },
          { name: baseEmail },
          ...(rawEmail !== baseEmail ? [{ name: rawEmail }] : []),
        ],
      },
      include: { clientLinks: true },
    })

    for (const dup of duplicates) {
      if (dup.clientLinks.some((l) => l.inboundId === sourceInboundId)) continue

      await prisma.$transaction(async (tx) => {
        for (const dupLink of dup.clientLinks) {
          const onSource = await tx.clientInbound.findUnique({
            where: {
              clientId_inboundId: {
                clientId: sourceClient.id,
                inboundId: dupLink.inboundId,
              },
            },
          })
          
          if (onSource) {
            await tx.usageSnapshot.deleteMany({ where: { clientInboundId: dupLink.id } })
            await tx.clientInbound.delete({ where: { id: dupLink.id } })
          } else {
            await tx.clientInbound.update({
              where: { id: dupLink.id },
              data: { clientId: sourceClient.id },
            })
          }
        }

        const remaining = await tx.clientInbound.count({ where: { clientId: dup.id } })
        if (remaining === 0) {
          await tx.client.delete({ where: { id: dup.id } })
          merged++
        }
      })
    }
  }

  if (merged > 0) {
    console.log(`[Migration] Reconciled ${merged} duplicate client record(s)`)
  }
  return merged
}

export interface MigrateClientsOptions {
  nameAffix?: NameAffixMode
  /** @deprecated use nameAffix */
  addPostfix?: boolean
  skipExisting?: boolean
}

/**
 * Add client to target inbound on Sanaei panel (unique email + full quota, zero usage on panel).
 */

async function addClientToPanel(params: {
  panelId: string
  uniqueEmail: string
  quotaBytes: number
  enable: boolean
}): Promise<{ success: boolean; remoteId?: string; remoteEmail?: string; error?: string }> {
  try {
    if (!(await panelIsConfigured())) {
      return { success: false, error: "Panel not configured" }
    }

    const inboundUuid =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : String(Date.now())

    const totalGB = quotaBytesToPanelTotalField(params.quotaBytes)

    const clientObj = {
      id: inboundUuid,
      email: params.uniqueEmail,
      limitIp: 0,
      totalGB,
      expiryTime: 0,
      enable: params.enable && totalGB > 0,
      tgId: "",
      subId: "",
    }

    const payload = {
      id: Number(params.panelId),
      settings: JSON.stringify({ clients: [clientObj] }),
    }

    const remoteResp = await panelApiRequest(`/inbounds/addClient`, "POST", payload)

    if (remoteResp?.success === false) {
      return { success: false, error: `Panel API error: ${remoteResp.msg || "Unknown error"}` }
    }

    const remoteId = remoteResp?.id
      ? String(remoteResp.id)
      : remoteResp?.data?.id
        ? String(remoteResp.data.id)
        : remoteResp?.result?.id
          ? String(remoteResp.result.id)
          : inboundUuid

    return {
      success: true,
      remoteId,
      remoteEmail: params.uniqueEmail,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: errorMsg }
  }
}

async function getLinkUsageBytes(clientInboundId: number): Promise<number> {
  const snapshot = await prisma.usageSnapshot.findFirst({
    where: { clientInboundId },
    orderBy: { recordedAt: "desc" },
  })
  if (!snapshot) return 0
  return Number(snapshot.up) + Number(snapshot.down)
}

/**
 * Migrate clients from source inbound to target inbound
 */
export async function migrateClients(
  sourceInboundId: number,
  targetInboundId: number,
  options: MigrateClientsOptions = {}
): Promise<MigrationResult> {
  const { skipExisting = true } = options
  const nameAffix = resolveNameAffixMode(options)

  // Validate migration
  const validation = await validateMigration(sourceInboundId, targetInboundId)
  if (!validation.valid) {
    return {
      success: false,
      summary: {
        sourceInboundId,
        targetInboundId,
        totalProcessed: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
      },
      details: [],
      errors: validation.errors,
    }
  }

  const targetInbound = await prisma.inbound.findUnique({
    where: { id: targetInboundId },
  })

  if (!targetInbound) {
    return {
      success: false,
      summary: {
        sourceInboundId,
        targetInboundId,
        totalProcessed: 0,
        migrated: 0,
        skipped: 0,
        failed: 0,
      },
      details: [],
      errors: ["Target inbound not found"],
    }
  }

  await reconcileMigrationDuplicates(sourceInboundId)

  const sourceLinks = await getClientsForInbound(sourceInboundId)

  const details: MigrationDetail[] = []
  let migrated = 0
  let skipped = 0
  let failed = 0

  const usageUpdates: Array<{ clientInboundId: number; up: number; down: number }> = []

  console.log(
    `[Migration] Starting migration from inbound ${sourceInboundId} to ${targetInboundId}`,
    { totalClients: sourceLinks.length }
  )

  for (const link of sourceLinks) {
    const client = link.client
    const sourceEmail = (link.remoteEmail || client.name || `client_${client.id}`).trim()
    const clientName = client.name || sourceEmail
    const displayBase = stripPanelEmailAffix(sourceEmail)

    try {
      const totalQuotaBytes = Number(client.totalQuota ?? 0)
      const sourceUsedBytes = await getLinkUsageBytes(link.id)

      const uniqueEmail = buildMigratedClientEmail(
        displayBase,
        targetInbound.remark,
        targetInboundId,
        nameAffix
      )

      const alreadyExists = await clientExistsInTarget(client.id, targetInboundId)

      if (alreadyExists) {
        console.log(`[Migration] Client already linked to target:`, {
          clientId: client.id,
          clientName,
          targetInboundId,
        })

        if (skipExisting) {
          details.push({
            clientId: client.id,
            clientName,
            clientUuid: client.uuid,
            status: "skipped",
            error: "Client already linked to target inbound",
          })
          skipped++
          continue
        }

        details.push({
          clientId: client.id,
          clientName,
          clientUuid: client.uuid,
          status: "duplicate",
          error: "Client already linked to target inbound",
        })
        skipped++
        continue
      }

      let remoteEmail: string | undefined
      let remoteId: string | undefined

      if (targetInbound.panelId) {
        const panelResult = await addClientToPanel({
          panelId: targetInbound.panelId,
          uniqueEmail,
          quotaBytes: totalQuotaBytes,
          enable: client.enabled && totalQuotaBytes > 0,
        })

        if (!panelResult.success) {
          details.push({
            clientId: client.id,
            clientName,
            clientUuid: client.uuid,
            status: "failed",
            error: panelResult.error || "Failed to add client on panel",
          })
          failed++
          continue
        }

        remoteId = panelResult.remoteId
        remoteEmail = panelResult.remoteEmail ?? uniqueEmail
      } else {
        remoteEmail = uniqueEmail
      }

      const newLink = await prisma.clientInbound.create({
        data: {
          clientId: client.id,
          inboundId: targetInboundId,
          remoteEmail: remoteEmail ?? undefined,
          remoteId: remoteId ?? undefined,
          enabled: client.enabled && totalQuotaBytes > 0,
        },
      })

      usageUpdates.push({
        clientInboundId: newLink.id,
        up: 0,
        down: 0,
      })

      console.log(`[Migration] Successfully migrated client:`, {
        clientId: client.id,
        clientName,
        newLinkId: newLink.id,
        sourceUsedBytes,
        totalQuotaBytes,
        remoteEmail,
      })

      details.push({
        clientId: client.id,
        clientName,
        clientUuid: client.uuid,
        status: "migrated",
        newRemoteEmail: remoteEmail,
        newRemoteId: remoteId,
      })
      migrated++
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error(`[Migration] Error migrating client:`, {
        clientId: client.id,
        clientName,
        error: errorMsg,
      })

      details.push({
        clientId: client.id,
        clientName,
        clientUuid: client.uuid,
        status: "failed",
        error: errorMsg,
      })
      failed++
    }
  }

  if (usageUpdates.length > 0) {
    const { bulkSaveUsageSnapshots } = await import("./usage-snapshot")
    await bulkSaveUsageSnapshots(usageUpdates)
  }

  await reconcileMigrationDuplicates(targetInboundId)

  console.log(`[Migration] Complete:`, {
    sourceInboundId,
    targetInboundId,
    migrated,
    skipped,
    failed,
  })

  return {
    success: true,
    summary: {
      sourceInboundId,
      targetInboundId,
      totalProcessed: sourceLinks.length,
      migrated,
      skipped,
      failed,
    },
    details,
    errors: failed > 0 ? [`${failed} client(s) failed to migrate`] : [],
  }
}

/**
 * Get migration preview (dry run)
 */
export async function getMigrationPreview(
  sourceInboundId: number,
  targetInboundId: number
) {
  const validation = await validateMigration(sourceInboundId, targetInboundId)

  if (!validation.valid) {
    return {
      valid: false,
      errors: validation.errors,
      preview: null,
    }
  }

  const sourceInbound = await prisma.inbound.findUnique({
    where: { id: sourceInboundId },
  })

  const targetInbound = await prisma.inbound.findUnique({
    where: { id: targetInboundId },
    include: { clientLinks: true },
  })

  // If source inbound has panelId, fetch from panel; otherwise from database
  let clientsToPreview: any[] = []

  if (sourceInbound?.panelId) {
    try {
      console.log(`[Preview] Fetching clients from panel for inbound ${sourceInboundId}`, {
        panelId: sourceInbound.panelId,
      })
      const panelClients = await getInboundClientsFromPanel(sourceInbound.panelId)
      console.log(`[Preview] Successfully fetched ${panelClients.length} clients from panel`)
      clientsToPreview = panelClients.map((client: any) => ({
        name: client.remoteEmail || client.panelEmail || "Unknown",
        uuid: client.uuid || "Unknown",
        totalQuota: client.quota || 0,
        usedBytes: Number(client.usedBytes ?? 0),
        up: Number(client.up ?? 0),
        down: Number(client.down ?? 0),
        fromPanel: true,
      }))
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error("[Preview] Failed to fetch from panel:", errorMsg)
      throw error // Don't fall back, let the error bubble up so user sees it
    }
  } else {
    // No panelId, just fetch from database
    const sourceLinks = await getClientsForInbound(sourceInboundId)
    clientsToPreview = sourceLinks.map((link) => ({
      name: link.client.name,
      uuid: link.client.uuid,
      totalQuota: Number(link.client.totalQuota),
      fromPanel: false,
    }))
  }

  const preview = {
    sourceInbound: sourceInbound
      ? {
          id: sourceInbound.id,
          remark: sourceInbound.remark,
          protocol: sourceInbound.protocol,
          panelId: sourceInbound.panelId,
        }
      : null,
    targetInbound: targetInbound
      ? {
          id: targetInbound.id,
          remark: targetInbound.remark,
          protocol: targetInbound.protocol,
          panelId: targetInbound.panelId,
        }
      : null,
    clientsToMigrate: clientsToPreview.length,
    clientDetails: clientsToPreview.map((client: any) => ({
      clientName: client.name,
      clientUuid: client.uuid,
      totalQuota: Number(client.totalQuota ?? 0),
      up: Number(client.up ?? 0),
      down: Number(client.down ?? 0),
      usedBytes: Number(client.usedBytes ?? 0),
      fromPanel: client.fromPanel ?? false,
      alreadyInTarget: false,
    })),
  }

  return {
    valid: true,
    errors: [],
    preview,
  }
}

/**
 * Fetch clients from Sanaei panel for a specific inbound
 */
export async function getInboundClientsFromPanel(inboundId: string) {
  try {
    if (!(await panelIsConfigured())) {
      throw new Error("Panel not configured")
    }

    console.log(`[Panel Sync] Fetching inbound list from panel`)
    const response = await panelApiRequest(`/inbounds/list`, "GET")
    const inbounds = resolvePanelList(response)

    const inbound = inbounds.find(
      (entry: any) => String(entry.id) === String(inboundId)
    )

    if (!inbound) {
      throw new Error(`Inbound ${inboundId} not found in Sanaei panel list`)
    }

    const parsed = parsePanelInbound(inbound as Record<string, unknown>)
    const clients = parsed.clients.map((c) => ({
      panelEmail: c.email,
      name: c.email,
      uuid: c.uuid,
      quota: c.quotaBytes,
      usedBytes: c.allTime,
      up: c.up,
      down: c.down,
      enabled: c.enabled,
      expiryTime: c.expiryTime,
      remoteId: c.panelClientId || c.uuid,
      remoteEmail: c.email,
      comment: "",
      createdAt: null,
      subId: c.subId,
      lastOnline: c.lastOnline,
    }))

    console.log(`[Panel Sync] Found ${clients.length} clients for inbound ${inboundId}`)
    return clients
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Panel Sync] Error fetching clients:`, { errorMsg })
    throw new Error(`Failed to fetch clients from panel: ${errorMsg}`)
  }
}

export interface SyncResult {
  success: boolean
  summary: {
    sourceInboundId: number
    totalFromPanel: number
    newClientsCreated: number
    existingClientsLinked: number
    failed: number
  }
  details: Array<{
    name: string
    panelEmail: string
    status: "created" | "linked" | "failed"
    clientId?: number
    error?: string
  }>
  errors: string[]
}

/**
 * Sync clients from Sanaei panel to admin database
 */
export async function syncClientsFromPanel(
  sourceInboundId: number
): Promise<SyncResult> {
  try {
    const sourceInbound = await prisma.inbound.findUnique({
      where: { id: sourceInboundId },
    })

    if (!sourceInbound) {
      return {
        success: false,
        summary: {
          sourceInboundId,
          totalFromPanel: 0,
          newClientsCreated: 0,
          existingClientsLinked: 0,
          failed: 0,
        },
        details: [],
        errors: ["Source inbound not found"],
      }
    }

    if (!sourceInbound.panelId) {
      return {
        success: false,
        summary: {
          sourceInboundId,
          totalFromPanel: 0,
          newClientsCreated: 0,
          existingClientsLinked: 0,
          failed: 0,
        },
        details: [],
        errors: ["Source inbound has no panel ID"],
      }
    }

    console.log(`[Panel Sync] Starting sync for inbound:`, { sourceInboundId, panelId: sourceInbound.panelId })

    // Fetch clients from panel
    const panelClients = await getInboundClientsFromPanel(sourceInbound.panelId)

    const details: SyncResult["details"] = []
    let newClientsCreated = 0
    let existingClientsLinked = 0
    let failed = 0

    const usageUpdates: Array<{ clientInboundId: number; up: number; down: number }> = []

    for (const panelClient of panelClients) {
      try {
        const quotaBytes = normalizeQuotaToBytes(Number(panelClient.quota || 0))
        const panelEmail = String(panelClient.remoteEmail || panelClient.panelEmail || panelClient.name || "").trim()
        const panelSubId = String(panelClient.subId ?? "").trim()

        let existingClient = await findLogicalClientForPanel({
          uuid: panelClient.uuid,
          email: panelEmail,
          subId: panelSubId,
        })

        let clientId: number
        let wasExisting = !!existingClient

        if (existingClient) {
          clientId = existingClient.id
          const updates: {
            totalQuota?: bigint
            enabled?: boolean
            expiryTime?: Date | null
            panelSubId?: string
          } = {}
          
          const newQuota = BigInt(quotaBytes)
          if (quotaBytes > 0 && existingClient.totalQuota !== newQuota) {
            updates.totalQuota = newQuota
          }
          if (panelClient.expiryTime && existingClient.expiryTime?.getTime() !== panelClient.expiryTime.getTime()) {
            updates.expiryTime = panelClient.expiryTime
          }
          if (panelSubId && existingClient.panelSubId !== panelSubId) {
            updates.panelSubId = panelSubId
          }
          
          if (Object.keys(updates).length > 0) {
            await prisma.client.update({ where: { id: clientId }, data: updates })
          }
          console.log(`[Panel Sync] Client already exists:`, { clientId, name: panelClient.name })
        } else {
          // Use base name for new client record
          const baseName = stripPanelEmailAffix(panelEmail)
          const newClient = await prisma.client.create({
            data: {
              uuid: panelClient.uuid,
              name: baseName || panelEmail || panelClient.name,
              panelSubId: panelSubId || undefined,
              totalQuota: BigInt(quotaBytes || 0),
              enabled: panelClient.enabled,
              expiryTime: panelClient.expiryTime,
            },
          })
          clientId = newClient.id
          newClientsCreated++
          wasExisting = false
          console.log(`[Panel Sync] Created new client:`, { clientId, name: panelClient.name })
        }

        const existingLink = await prisma.clientInbound.findUnique({
          where: {
            clientId_inboundId: {
              clientId,
              inboundId: sourceInboundId,
            },
          },
        })

        let linkId: number

        if (!existingLink) {
          const createdLink = await prisma.clientInbound.create({
            data: {
              clientId,
              inboundId: sourceInboundId,
              remoteEmail: panelEmail || panelClient.remoteEmail,
              remoteId: panelClient.remoteId,
              enabled: panelClient.enabled,
            },
          })
          linkId = createdLink.id

          if (wasExisting) {
            existingClientsLinked++
            console.log(`[Panel Sync] Linked existing client to inbound:`, {
              clientId,
              inboundId: sourceInboundId,
            })
          }
        } else {
          linkId = existingLink.id
          
          const hasEmailChanged = panelEmail && existingLink.remoteEmail !== panelEmail
          const hasRemoteIdChanged = panelClient.remoteId && existingLink.remoteId !== panelClient.remoteId
          const hasEnabledChanged = existingLink.enabled !== panelClient.enabled
          
          if (hasEmailChanged || hasRemoteIdChanged || hasEnabledChanged) {
            const updates: any = {}
            if (hasEmailChanged) updates.remoteEmail = panelEmail
            if (hasRemoteIdChanged) updates.remoteId = panelClient.remoteId
            if (hasEnabledChanged) updates.enabled = panelClient.enabled
            
            await prisma.clientInbound.update({
              where: { id: linkId },
              data: updates,
            })
          }
          
          if (wasExisting) {
            existingClientsLinked++
          }
        }

        usageUpdates.push({
          clientInboundId: linkId,
          up: panelClient.up,
          down: panelClient.down,
        })

        details.push({
          name: panelClient.name,
          panelEmail: panelClient.panelEmail,
          status: wasExisting ? "linked" : "created",
          clientId,
        })
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error(`[Panel Sync] Error processing client:`, { name: panelClient.name, error: errorMsg })
        details.push({
          name: panelClient.name,
          panelEmail: panelClient.panelEmail,
          status: "failed",
          error: errorMsg,
        })
        failed++
      }
    }

    if (usageUpdates.length > 0) {
      const { bulkSaveUsageSnapshots } = await import("./usage-snapshot")
      await bulkSaveUsageSnapshots(usageUpdates)
    }

    console.log(`[Panel Sync] Complete:`, {
      sourceInboundId,
      totalFromPanel: panelClients.length,
      newClientsCreated,
      existingClientsLinked,
      failed,
    })

    return {
      success: true,
      summary: {
        sourceInboundId,
        totalFromPanel: panelClients.length,
        newClientsCreated,
        existingClientsLinked,
        failed,
      },
      details,
      errors: failed > 0 ? [`${failed} client(s) failed to sync`] : [],
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error(`[Panel Sync] Fatal error:`, { error: errorMsg })
    return {
      success: false,
      summary: {
        sourceInboundId,
        totalFromPanel: 0,
        newClientsCreated: 0,
        existingClientsLinked: 0,
        failed: 0,
      },
      details: [],
      errors: [errorMsg],
    }
  }
}

export interface SyncAndMigrateResult {
  success: boolean
  syncResult: SyncResult
  migrationResult: MigrationResult
  migrationResults?: MigrationResult[]
}

function emptyMigrationResult(
  sourceInboundId: number,
  targetInboundId: number,
  errors: string[] = []
): MigrationResult {
  return {
    success: false,
    summary: {
      sourceInboundId,
      targetInboundId,
      totalProcessed: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
    },
    details: [],
    errors,
  }
}

/**
 * Migrate source clients to multiple target inbounds (syncs panel once when using syncAndMigrate).
 */
export async function migrateClientsToTargets(
  sourceInboundId: number,
  targetInboundIds: number[],
  options: MigrateClientsOptions = {}
): Promise<{ success: boolean; results: MigrationResult[] }> {
  const uniqueTargets = [...new Set(targetInboundIds)].filter((id) => id !== sourceInboundId)
  const results: MigrationResult[] = []

  for (const targetInboundId of uniqueTargets) {
    results.push(await migrateClients(sourceInboundId, targetInboundId, options))
  }

  return {
    success: results.length > 0 && results.every((r) => r.success && r.summary.failed === 0),
    results,
  }
}

export function aggregateMigrationResults(results: MigrationResult[]): MigrationResult {
  if (results.length === 0) {
    return emptyMigrationResult(0, 0, ["No target inbounds selected"])
  }

  if (results.length === 1) return results[0]

  const first = results[0]
  return {
    success: results.every((r) => r.success),
    summary: {
      sourceInboundId: first.summary.sourceInboundId,
      targetInboundId: 0,
      totalProcessed: results.reduce((n, r) => n + r.summary.totalProcessed, 0),
      migrated: results.reduce((n, r) => n + r.summary.migrated, 0),
      skipped: results.reduce((n, r) => n + r.summary.skipped, 0),
      failed: results.reduce((n, r) => n + r.summary.failed, 0),
    },
    details: results.flatMap((r) => r.details),
    errors: results.flatMap((r) => r.errors),
  }
}

/**
 * Combined: Sync clients from panel + Migrate to one or more target inbounds
 */
export async function syncAndMigrateClients(
  sourceInboundId: number,
  targetInboundId: number | number[],
  options: MigrateClientsOptions = {}
): Promise<SyncAndMigrateResult> {
  const targetIds = (Array.isArray(targetInboundId) ? targetInboundId : [targetInboundId]).filter(
    Boolean
  )

  console.log(`[Sync+Migrate] Starting combined operation:`, {
    sourceInboundId,
    targetInboundIds: targetIds,
  })

  const syncResult = await syncClientsFromPanel(sourceInboundId)

  if (!syncResult.success) {
    return {
      success: false,
      syncResult,
      migrationResult: emptyMigrationResult(
        sourceInboundId,
        targetIds[0] ?? 0,
        syncResult.errors
      ),
    }
  }

  const { results } = await migrateClientsToTargets(sourceInboundId, targetIds, options)

  await reconcileMigrationDuplicates(sourceInboundId)
  for (const targetId of targetIds) {
    if (targetId !== sourceInboundId) {
      await reconcileMigrationDuplicates(targetId)
    }
  }

  const migrationResult = aggregateMigrationResults(results)

  console.log(`[Sync+Migrate] Complete:`, {
    syncedClients: syncResult.summary.totalFromPanel,
    targetCount: targetIds.length,
    migratedClients: migrationResult.summary.migrated,
    failedClients: migrationResult.summary.failed,
  })

  return {
    success: migrationResult.success && migrationResult.summary.failed === 0,
    syncResult,
    migrationResult,
    migrationResults: results.length > 1 ? results : undefined,
  }
}
