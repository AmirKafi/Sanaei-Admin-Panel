import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { panelApiRequest, panelIsConfigured } from "@/lib/sanaei"
import { apiError, parseJsonBody } from "@/lib/api-response"
import { createClientSchema } from "@/lib/validations"
import { serializeForJson } from "@/lib/json-serialize"

export async function GET() {
  try {
    const cs = await prisma.client.findMany()
    const allLinks = await prisma.clientInbound.findMany()
    const allInbounds = await prisma.inbound.findMany()
    const snapshots = await prisma.usageSnapshot.findMany()

    const usageByClient = new Map<number, number>()
    for (const snapshot of snapshots) {
      const link = allLinks.find((item) => item.id === snapshot.clientInboundId)
      if (!link) continue
      const existing = usageByClient.get(link.clientId) ?? 0
      usageByClient.set(link.clientId, existing + Number(snapshot.up) + Number(snapshot.down))
    }

    const out = []
    for (const c of cs) {
      const links = allLinks.filter((link) => link.clientId === c.id)
      const enriched = []
      for (const l of links) {
        const ib = allInbounds.find((inbound) => inbound.id === l.inboundId)
        enriched.push({ link: l, inbound: ib ?? null })
      }
      out.push({
        client: { ...c, totalQuota: Number(c.totalQuota ?? 0) },
        links: enriched,
        usedBytes: usageByClient.get(c.id) ?? 0,
      })
    }
    return NextResponse.json(serializeForJson(out))
  } catch (err) {
    console.error("GET /api/clients error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const parsed = await parseJsonBody(req, createClientSchema)
    if (!parsed.ok) return parsed.response

    const { name, email, totalQuota, inboundIds } = parsed.data
    const trimmedEmail = email?.trim() || null

    console.log("[Client Create] Request body:", { name, email: trimmedEmail, totalQuota, inboundIds })

    const newUuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : String(Date.now())
    const created = await prisma.client.create({
      data: { uuid: newUuid, name, totalQuota: BigInt(totalQuota) },
    })
    const clientId = created.id
    console.log("[Client Create] Created client:", { clientId, uuid: newUuid, name })

    const createdLinks: Array<any> = []
    for (let index = 0; index < inboundIds.length; index++) {
      const iid = inboundIds[index]
      console.log(`[Client Create] Processing inbound ${index}:`, { iid })
      
      const ib = await prisma.inbound.findUnique({ where: { id: iid } })
      if (!ib) {
        console.log(`[Client Create] Inbound not found:`, { iid })
        continue
      }
      console.log(`[Client Create] Found inbound:`, { iid, panelId: ib.panelId })

      let remoteEmail: string | null = null
      let remoteId: string | null = null
      let remoteError: string | null = null

      if (ib.panelId) {
        try {
          console.log(`[Client Create] Panel ID found, checking configuration`)
          if (!(await panelIsConfigured())) {
            throw new Error("panel_not_configured")
          }
          
          // Generate unique UUID for this inbound's client
          const inboundUuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : String(Date.now()) + "_" + index
          
          // Add postfix to email to make it unique across inbounds
          const postfix = `_${index}`
          const uniqueEmail = (trimmedEmail ?? name) + postfix
          
          // create a client object shaped for the Sanaei panel API
          const clientObj = {
            id: inboundUuid,
            email: uniqueEmail,
            limitIp: 0,
            totalGB: totalQuota,
            expiryTime: 0,
            enable: true,
            tgId: "",
            subId: "",
          }
          const payload = { id: Number(ib.panelId), settings: JSON.stringify({ clients: [clientObj] }) }
          console.log(`[Client Create] Sending to panel API:`, { payload })
          
          const remoteResp = await panelApiRequest(`/inbounds/addClient`, "POST", payload)
          console.log(`[Client Create] Panel API response:`, { remoteResp })
          
          if (!remoteResp.success) {
            throw new Error(`Panel API error: ${remoteResp.msg || 'Unknown error'}`)
          }
          
          remoteEmail = clientObj.email
          if (remoteResp && typeof remoteResp === "object") {
            remoteId = remoteResp.id ? String(remoteResp.id) : remoteResp.data?.id ? String(remoteResp.data.id) : remoteResp.result?.id ? String(remoteResp.result.id) : null
          }
        } catch (e) {
          remoteError = e instanceof Error ? e.message : String(e)
          console.error(`[Client Create] Error adding to panel:`, { remoteError, error: e })
        }
      } else {
        console.log(`[Client Create] No panel ID, skipping remote add`)
      }

      console.log(`[Client Create] Creating ClientInbound link:`, { clientId, inboundId: iid, remoteEmail, remoteId, remoteError })
      const linkRes = await prisma.clientInbound.create({ data: { clientId, inboundId: iid, remoteEmail: remoteEmail ?? undefined, remoteId: remoteId ?? undefined } })
      console.log(`[Client Create] Created ClientInbound:`, { linkId: linkRes.id })
      createdLinks.push({ inboundId: iid, id: linkRes.id, remoteEmail, remoteId, remoteError })
    }

    console.log("[Client Create] Success, returning response:", { clientId, createdLinks })
    return NextResponse.json({ success: true, client: { id: clientId, uuid: newUuid }, links: createdLinks })
  } catch (err) {
    console.error("[Client Create] Fatal error:", { error: err })
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
