import { NextRequest, NextResponse } from "next/server"
import { panelIsConfigured } from "@/lib/sanaei"
import { runUsageCheck } from "@/lib/usageChecker"
import { listInboundsWithUsage } from "@/lib/inbounds-query"
import { serializeForJson } from "@/lib/json-serialize"

export async function GET() {
  try {
    const output = await listInboundsWithUsage()
    return NextResponse.json(serializeForJson(output))
  } catch (err) {
    console.error("GET /api/inbounds error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body?.action === "sync") {
      const result = await runUsageCheck()
      if (result && "error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }

      const inbounds = await listInboundsWithUsage()
      const inboundSyncStatus: Record<number, "ok" | "error"> = {}
      for (const inbound of inbounds) {
        inboundSyncStatus[inbound.id] = "ok"
      }

      return NextResponse.json(
        serializeForJson({
          success: true,
          inbounds,
          inboundSyncStatus,
          ...result,
        })
      )
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 })
  } catch (err) {
    console.error("POST /api/inbounds error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
