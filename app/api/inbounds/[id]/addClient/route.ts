import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { panelApiRequest, panelIsConfigured } from "@/lib/sanaei"

export async function POST(request: NextRequest, context: any) {
  try {
    const params = context?.params ?? {}
    const inboundId = Number(params.id)
    const body = await request.json()
    const clientId = Number(body.clientId)
    const inbound = await prisma.inbound.findUnique({ where: { id: inboundId } })
    if (!inbound) return NextResponse.json({ error: "inbound not found" }, { status: 404 })
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) return NextResponse.json({ error: "client not found" }, { status: 404 })

    // Get existing links for this client to determine postfix
    const existingLinks = await prisma.clientInbound.findMany({
      where: { clientId },
    })
    const postfix = `_${existingLinks.length}`

    const panelId = inbound.panelId
    // call Sanaei API to add client to inbound if panelId available and panel configured
    let remoteResp = null
    let payload: any = null
    let remoteEmail: string | null = null
    
    if (panelId) {
      if (!(await panelIsConfigured())) {
        return NextResponse.json({ error: "panel_not_configured" }, { status: 400 })
      }
      try {
        // Generate unique UUID for this inbound
        const uniqueUuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : String(Date.now()) + postfix
        
        // Create unique email with postfix
        const baseEmail = (client as any).email || (client as any).name || `${(client as any).uuid}@local.local`
        const uniqueEmail = baseEmail + postfix
        
        const totalQuota = Number((client as any).totalQuota || 0)
        const clientObj = {
          id: uniqueUuid,
          email: uniqueEmail,
          limitIp: 0,
          totalGB: Math.max(0, Math.round(totalQuota)),
          expiryTime: 0,
          enable: true,
          tgId: "",
          subId: "",
        }
        payload = { id: panelId, settings: { clients: [clientObj] } }
        remoteResp = await panelApiRequest(`/inbounds/addClient`, "POST", payload)
        remoteEmail = clientObj.email
      } catch (e) {
        // continue, still create local mapping
      }
    }
    const linkData: any = { clientId, inboundId }
    if (remoteEmail) linkData.remoteEmail = remoteEmail
    if (remoteResp && typeof remoteResp === "object") {
      const rid = remoteResp.id ? String(remoteResp.id) : remoteResp.data?.id ? String(remoteResp.data.id) : remoteResp.result?.id ? String(remoteResp.result.id) : null
      if (rid) linkData.remoteId = rid
    }
    const linkRes = await prisma.clientInbound.create({ data: linkData })
    return NextResponse.json({ success: true, linkId: linkRes.id, remote: remoteResp })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
