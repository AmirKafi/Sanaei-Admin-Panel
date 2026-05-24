import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { panelApiRequest, panelIsConfigured } from "@/lib/sanaei"

export async function GET(request: NextRequest, context: any) {
  try {
    const params = context?.params ?? {}
    const id = Number(params.id)
    const row = await prisma.inbound.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })
    return NextResponse.json(row)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: any) {
  try {
    const params = context?.params ?? {}
    const id = Number(params.id)
    const body = await request.json()
    const update: any = {}
    if (body.remark !== undefined) update.remark = String(body.remark)
    if (body.protocol !== undefined) update.protocol = String(body.protocol)
    if (body.port !== undefined) update.port = Number(body.port)
    if (body.network !== undefined) update.network = String(body.network)
    if (body.tls !== undefined) update.tls = !!body.tls
    if (body.enabled !== undefined) update.enabled = !!body.enabled
    await prisma.inbound.update({ where: { id }, data: update })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, context: any) {
  try {
    const params = context?.params ?? {}
    const id = Number(params.id)
    const row = await prisma.inbound.findUnique({ where: { id } })
    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })

    const panelId = row.panelId
    // attempt remote delete if panelId available and panel configured
    if (panelId) {
      if (await panelIsConfigured()) {
        try {
          await panelApiRequest(`/inbounds/del/${encodeURIComponent(panelId)}`, "POST")
        } catch {}
      }
    }
    await prisma.inbound.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
