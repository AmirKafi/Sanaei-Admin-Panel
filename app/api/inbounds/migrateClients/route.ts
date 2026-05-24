import { NextRequest, NextResponse } from "next/server"
import {
  migrateClients,
  migrateClientsToTargets,
  aggregateMigrationResults,
  getMigrationPreview,
  syncClientsFromPanel,
  syncAndMigrateClients,
} from "@/lib/migration"
import { apiError, parseJsonBody } from "@/lib/api-response"
import { serializeForJson } from "@/lib/json-serialize"
import { migrateClientsSchema } from "@/lib/validations"
import { resolveNameAffixMode } from "@/lib/quota"
import { z } from "zod"

const previewQuerySchema = z.object({
  sourceInboundId: z.coerce.number().int().positive(),
  targetInboundId: z.coerce.number().int().positive(),
})

function resolveTargetInboundIds(data: {
  targetInboundId?: number
  targetInboundIds?: number[]
}): number[] {
  if (data.targetInboundIds?.length) return [...new Set(data.targetInboundIds)]
  if (data.targetInboundId) return [data.targetInboundId]
  return []
}

function buildMigrateOptions(data: {
  nameAffix?: "none" | "prefix" | "postfix"
  addPostfix?: boolean
  skipExisting?: boolean
}) {
  return {
    nameAffix: resolveNameAffixMode({
      nameAffix: data.nameAffix,
      addPostfix: data.addPostfix,
    }),
    skipExisting: data.skipExisting ?? true,
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, migrateClientsSchema)
    if (!parsed.ok) return parsed.response

    const { sourceInboundId, action = "migrate" } = parsed.data
    const migrateOptions = buildMigrateOptions(parsed.data)
    const targetIds = resolveTargetInboundIds(parsed.data)

    if (action === "sync") {
      const result = await syncClientsFromPanel(sourceInboundId)
      if (!result.success) {
        return NextResponse.json(
          { success: false, errors: result.errors, summary: result.summary },
          { status: 400 }
        )
      }
      return NextResponse.json(serializeForJson({ success: true, result }))
    }

    if (targetIds.length === 0) {
      return apiError("targetInboundId or targetInboundIds is required", 400)
    }

    if (action === "sync-and-migrate") {
      const result = await syncAndMigrateClients(sourceInboundId, targetIds, migrateOptions)
      if (!result.success) {
        return NextResponse.json(
          serializeForJson({
            success: false,
            errors: result.migrationResult.errors,
            syncResult: result.syncResult,
            migrationResult: result.migrationResult,
            migrationResults: result.migrationResults,
          }),
          { status: 400 }
        )
      }
      return NextResponse.json(serializeForJson({ success: true, result }))
    }

    if (action === "preview" || action === "dry-run") {
      const preview = await getMigrationPreview(sourceInboundId, targetIds[0])
      if (!preview.valid) {
        return NextResponse.json({ success: false, errors: preview.errors }, { status: 400 })
      }
      return NextResponse.json(
        serializeForJson({
          success: true,
          action: "preview",
          preview: preview.preview,
          targetInboundIds: targetIds,
        })
      )
    }

    if (action === "migrate") {
      if (targetIds.length === 1) {
        const result = await migrateClients(sourceInboundId, targetIds[0], migrateOptions)
        if (!result.success) {
          return NextResponse.json(
            { success: false, errors: result.errors, summary: result.summary },
            { status: 400 }
          )
        }
        return NextResponse.json({ success: true, result })
      }

      const { results } = await migrateClientsToTargets(
        sourceInboundId,
        targetIds,
        migrateOptions
      )
      const result = aggregateMigrationResults(results)
      if (!result.success || result.summary.failed > 0) {
        return NextResponse.json(
          { success: false, errors: result.errors, summary: result.summary, results },
          { status: 400 }
        )
      }
      return NextResponse.json({ success: true, result, results })
    }

    return apiError(`Unknown action: ${action}`, 400)
  } catch (err) {
    console.error("[Migration API] Error:", err)
    return apiError(err instanceof Error ? err.message : "Migration failed", 500)
  }
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = Object.fromEntries(req.nextUrl.searchParams.entries())
    const parsed = previewQuerySchema.safeParse(searchParams)
    if (!parsed.success) {
      return apiError("sourceInboundId and targetInboundId are required", 400, parsed.error.flatten())
    }

    const { sourceInboundId, targetInboundId } = parsed.data
    const preview = await getMigrationPreview(sourceInboundId, targetInboundId)

    if (!preview.valid) {
      return NextResponse.json({ success: false, errors: preview.errors }, { status: 400 })
    }

    return NextResponse.json(serializeForJson({ success: true, preview: preview.preview }))
  } catch (err) {
    console.error("[Migration API] Error:", err)
    return apiError(err instanceof Error ? err.message : "Preview failed", 500)
  }
}
