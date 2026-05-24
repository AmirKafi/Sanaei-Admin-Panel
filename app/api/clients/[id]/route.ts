import { NextRequest, NextResponse } from "next/server"

import { prisma } from "@/lib/prisma"

import { panelApiRequest, panelIsConfigured } from "@/lib/sanaei"

import { apiError, parseJsonBody } from "@/lib/api-response"

import { clientPatchSchema, clientActionSchema, clientMigrateSchema } from "@/lib/validations"

import { serializeForJson } from "@/lib/json-serialize"

import {
  disableClientLinksOnPanel,
  restartPanelXrayService,
  syncClientLinksEnabledOnPanel,
  syncClientDetailsOnPanel,
} from "@/lib/panel-client-control"



async function getPanelLinksForClient(clientId: number) {

  const links = await prisma.clientInbound.findMany({ where: { clientId } })

  const panelLinks: Array<{

    inboundPanelId: string

    remoteEmail: string | null

    remoteId: string | null

    clientUuid: string | null

  }> = []



  for (const link of links) {

    const inbound = await prisma.inbound.findUnique({ where: { id: link.inboundId } })

    if (!inbound?.panelId) continue

    panelLinks.push({

      inboundPanelId: inbound.panelId,

      remoteEmail: link.remoteEmail,

      remoteId: link.remoteId,

      clientUuid: null,

    })

  }



  return { links, panelLinks }

}



export async function GET(request: NextRequest, context: any) {

  try {

    const params = await Promise.resolve(context?.params ?? {})

    const id = Number(params.id)

    const row = await prisma.client.findUnique({ where: { id } })

    if (!row) return NextResponse.json({ error: "not found" }, { status: 404 })



    const links = await prisma.clientInbound.findMany({ where: { clientId: id } })

    const snapshots = await prisma.usageSnapshot.findMany()



    const usageByLink = new Map<number, { up: number; down: number }>()

    for (const snapshot of snapshots) {

      const existing = usageByLink.get(snapshot.clientInboundId) ?? { up: 0, down: 0 }

      usageByLink.set(snapshot.clientInboundId, {

        up: existing.up + Number(snapshot.up),

        down: existing.down + Number(snapshot.down),

      })

    }



    const enriched = []

    let totalUsage = 0



    const isPanelConfigured = await panelIsConfigured().catch(() => false)



    for (const l of links) {

      const ib = await prisma.inbound.findUnique({ where: { id: l.inboundId } })

      const usage = usageByLink.get(l.id) ?? { up: 0, down: 0 }

      totalUsage += usage.up + usage.down



      let remoteClient = null

      if (isPanelConfigured && l.remoteEmail) {

        try {

          const res = await panelApiRequest(

            `/inbounds/getClientTraffics/${encodeURIComponent(l.remoteEmail)}`,

            "GET"

          )

          if (res && typeof res === "object") {

            if (res.obj) {

              remoteClient = res.obj

            } else if (res.data && typeof res.data === "object") {

              remoteClient = res.data

            } else if (res.email) {

              remoteClient = res

            }

          }

        } catch (e) {

          console.error(`[Client Detail] Error fetching remote client ${l.remoteEmail}:`, e)

        }

      }



      enriched.push({ link: l, inbound: ib ?? null, usage, remoteClient })

    }



    return NextResponse.json(

      serializeForJson({

        client: { ...row, totalQuota: Number(row.totalQuota ?? 0) },

        links: enriched,

        usedBytes: totalUsage,

      })

    )

  } catch (err) {

    console.error("[Client Detail] GET error:", err)

    return NextResponse.json({ error: (err as Error).message }, { status: 500 })

  }

}



export async function PATCH(request: NextRequest, context: any) {
  try {
    const params = await Promise.resolve(context?.params ?? {})
    const id = Number(params.id)
    const parsed = await parseJsonBody(request, clientPatchSchema)
    if (!parsed.ok) return parsed.response

    const body = parsed.data
    const update: Record<string, unknown> = {}

    if (body.name !== undefined) update.name = body.name
    if (body.totalQuota !== undefined) update.totalQuota = BigInt(body.totalQuota)
    if (body.enabled !== undefined) update.enabled = body.enabled
    if (body.expiryTime !== undefined) {
      update.expiryTime = body.expiryTime ? new Date(body.expiryTime) : null
    }

    await prisma.client.update({ where: { id }, data: update })

    const isPanelConfigured = await panelIsConfigured().catch(() => false)
    if (isPanelConfigured) {
      const client = await prisma.client.findUnique({ where: { id } })
      const { panelLinks } = await getPanelLinksForClient(id)

      if (client && panelLinks.length > 0) {
        const { updatedEmails } = await syncClientDetailsOnPanel(panelLinks, {
          enabled: body.enabled,
          totalQuotaBytes: body.totalQuota !== undefined ? Number(body.totalQuota) : undefined,
          expiryTime:
            body.expiryTime !== undefined
              ? body.expiryTime
                ? new Date(body.expiryTime).getTime()
                : 0
              : undefined,
          name: body.name,
        })

        // Update local remoteEmail if it changed on panel
        for (const updateInfo of updatedEmails) {
          const ib = await prisma.inbound.findUnique({
            where: { panelId: updateInfo.inboundPanelId },
          })
          if (ib) {
            await prisma.clientInbound.update({
              where: {
                clientId_inboundId: {
                  clientId: id,
                  inboundId: ib.id,
                },
              },
              data: { remoteEmail: updateInfo.newEmail },
            })
          }
        }

        if (body.enabled !== undefined) {
          await prisma.clientInbound.updateMany({
            where: { clientId: id },
            data: { enabled: Boolean(body.enabled) },
          })
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[Client Update] PATCH error:", err)
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}



export async function POST(request: NextRequest, context: any) {

  try {

    const params = await Promise.resolve(context?.params ?? {})

    const id = Number(params.id)

    const parsed = await parseJsonBody(request, clientActionSchema)

    if (!parsed.ok) return parsed.response



    const { action } = parsed.data



    if (action === "disable") {

      const client = await prisma.client.findUnique({ where: { id } })

      if (!client) return NextResponse.json({ error: "not found" }, { status: 404 })



      const isPanelConfigured = await panelIsConfigured().catch(() => false)

      let disabledOnPanel = 0



      if (isPanelConfigured) {

        const { panelLinks } = await getPanelLinksForClient(id)

        const linksWithUuid = panelLinks.map((link) => ({

          ...link,

          clientUuid: client.uuid,

        }))

        disabledOnPanel = await disableClientLinksOnPanel(linksWithUuid)

        if (disabledOnPanel > 0) {
          await restartPanelXrayService()
        }

      }



      await prisma.client.update({ where: { id }, data: { enabled: false } })

      await prisma.clientInbound.updateMany({

        where: { clientId: id },

        data: { enabled: false },

      })



      return NextResponse.json({ success: true, disabledOnPanel })

    }



    if (action === "migrate") {
      const migrationParsed = await parseJsonBody(request, clientMigrateSchema)
      if (!migrationParsed.ok) return migrationParsed.response
      
      const migrationBody = migrationParsed.data
      const { targetInboundId } = migrationBody

      // Validate source and target inbounds exist
      const sourceLinks = await prisma.clientInbound.findMany({ where: { clientId: id } })
      if (sourceLinks.length === 0) {
        return NextResponse.json({ error: "Client has no existing inbound links" }, { status: 400 })
      }

      const targetInbound = await prisma.inbound.findUnique({ where: { id: targetInboundId } })
      if (!targetInbound) {
        return NextResponse.json({ error: "Target inbound not found" }, { status: 404 })
      }

      // Check if client is already linked to target inbound
      const existingLink = await prisma.clientInbound.findUnique({
        where: {
          clientId_inboundId: {
            clientId: id,
            inboundId: targetInboundId,
          },
        },
      })

      if (existingLink) {
        return NextResponse.json({ error: "Client is already linked to this inbound" }, { status: 400 })
      }

      // Get client details
      const client = await prisma.client.findUnique({ where: { id } })
      if (!client) return NextResponse.json({ error: "Client not found" }, { status: 404 })

      // Create new link for the client in the target inbound
      const newLink = await prisma.clientInbound.create({
        data: {
          clientId: id,
          inboundId: targetInboundId,
          enabled: client.enabled,
          // remoteId, remoteEmail, remotePass will be populated by the next usage check sync
        },
      })

      console.log(`[Client Migrate] Migrated client ${id} to inbound ${targetInboundId}, new link id: ${newLink.id}`)

      return NextResponse.json({ 
        success: true, 
        message: "Client successfully linked to target inbound",
        newLinkId: newLink.id,
      })
    }



    return apiError("unknown action", 400)

  } catch (err) {

    console.error("[Client Action] POST error:", err)

    return apiError(err instanceof Error ? err.message : "Request failed", 500)

  }

}


