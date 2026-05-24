import { resolvePanelClientQuotaBytes } from "./quota"

export type PanelClientTraffic = {
  email: string
  uuid: string
  panelClientId: string
  subId: string
  up: number
  down: number
  allTime: number
  quotaBytes: number
  enabled: boolean
  expiryTime: Date | null
  lastOnline: number | null
}

export type ParsedPanelInbound = {
  panelId: string
  trafficUp: number
  trafficDown: number
  trafficAllTime: number
  clients: PanelClientTraffic[]
}

export function resolvePanelList(response: unknown): any[] {
  const r = response as Record<string, unknown>
  if (Array.isArray(response)) return response
  if (Array.isArray(r?.data)) return r.data as any[]
  if (Array.isArray(r?.list)) return r.list as any[]
  if (Array.isArray(r?.obj)) return r.obj as any[]
  if (Array.isArray((r?.data as Record<string, unknown>)?.list)) {
    return (r.data as { list: any[] }).list
  }
  if (Array.isArray((r?.data as Record<string, unknown>)?.obj)) {
    return (r.data as { obj: any[] }).obj
  }
  return []
}

export function parseSettingsClients(inbound: Record<string, unknown>) {
  let settings: Record<string, unknown> = inbound.settings as Record<string, unknown>
  if (typeof settings === "string") {
    try {
      settings = JSON.parse(settings) as Record<string, unknown>
    } catch {
      settings = {}
    }
  }
  const list = Array.isArray(settings?.clients) ? settings.clients : []
  const byUuid = new Map<string, Record<string, unknown>>()
  const byEmail = new Map<string, Record<string, unknown>>()

  for (const raw of list) {
    const c = raw as Record<string, unknown>
    const uuid = String(c.id ?? c.uuid ?? "").trim()
    const email = String(c.email ?? c.user ?? "").trim().toLowerCase()
    if (uuid) byUuid.set(uuid, c)
    if (email) byEmail.set(email, c)
  }

  return { byUuid, byEmail }
}

/** Parse inbound + clientStats from /inbounds/list (see inbounds.json). */
export function parsePanelInbound(remoteInbound: Record<string, unknown>): ParsedPanelInbound {
  const panelId = String(
    remoteInbound.id ?? remoteInbound._id ?? remoteInbound.inboundId ?? ""
  ).trim()

  const trafficUp = Number(remoteInbound.up ?? 0)
  const trafficDown = Number(remoteInbound.down ?? 0)
  const trafficAllTime = Number(
    remoteInbound.allTime ?? trafficUp + trafficDown
  )

  const { byUuid, byEmail } = parseSettingsClients(remoteInbound)
  const clientStats = Array.isArray(remoteInbound.clientStats)
    ? remoteInbound.clientStats
    : []

  const clients: PanelClientTraffic[] = []

  for (const raw of clientStats) {
    const stats = raw as Record<string, unknown>
    const email = String(stats.email ?? stats.user ?? "").trim()
    const uuid = String(stats.uuid ?? "").trim()
    const panelClientId = String(stats.id ?? stats._id ?? "").trim()

    if (!email && !uuid) continue

    const settingsClient =
      (uuid ? byUuid.get(uuid) : undefined) ??
      (email ? byEmail.get(email.toLowerCase()) : undefined) ??
      {}

    const up = Number(stats.up ?? 0)
    const down = Number(stats.down ?? 0)
    const allTime = Number(stats.allTime ?? up + down)
    const subId = String(
      stats.subId ??
        (settingsClient as { subId?: string }).subId ??
        ""
    ).trim()

    const lastOnlineRaw = Number(
      stats.lastOnline ?? (settingsClient as { lastOnline?: number }).lastOnline ?? 0
    )

    clients.push({
      email: email || String(settingsClient.email ?? uuid),
      uuid: uuid || String(settingsClient.id ?? settingsClient.uuid ?? email),
      panelClientId,
      subId,
      up,
      down,
      allTime,
      quotaBytes: resolvePanelClientQuotaBytes(
        stats as { total?: number; totalGB?: number },
        settingsClient as { totalGB?: number; total?: number }
      ),
      enabled:
        stats.enable !== false &&
        stats.enabled !== false &&
        (settingsClient as { enable?: boolean }).enable !== false,
      expiryTime:
        Number(stats.expiryTime ?? (settingsClient as { expiryTime?: number }).expiryTime ?? 0) >
        0
          ? new Date(
              Number(
                stats.expiryTime ?? (settingsClient as { expiryTime?: number }).expiryTime
              )
            )
          : null,
      lastOnline: lastOnlineRaw > 0 ? lastOnlineRaw : null,
    })
  }

  return { panelId, trafficUp, trafficDown, trafficAllTime, clients }
}

export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase()
}

/** Match DB ClientInbound row to panel clientStats entry. */
export function matchPanelClientToLink(
  link: { remoteEmail: string | null; remoteId: string | null },
  panelClient: PanelClientTraffic,
  clientUuid?: string | null
): boolean {
  const linkEmail = normalizeEmail(link.remoteEmail)
  const panelEmail = normalizeEmail(panelClient.email)

  if (linkEmail && panelEmail && linkEmail === panelEmail) return true

  const linkRemoteId = String(link.remoteId ?? "").trim()
  if (linkRemoteId && panelClient.panelClientId && linkRemoteId === panelClient.panelClientId) {
    return true
  }
  if (linkRemoteId && panelClient.uuid && linkRemoteId === panelClient.uuid) return true

  const uuid = String(clientUuid ?? "").trim()
  if (uuid && panelClient.uuid && uuid === panelClient.uuid) return true

  if (linkEmail && normalizeEmail(panelClient.uuid) === linkEmail) return true

  return false
}

export function findPanelClientForLink(
  link: { remoteEmail: string | null; remoteId: string | null },
  clients: PanelClientTraffic[],
  clientUuid?: string | null
): PanelClientTraffic | undefined {
  return clients.find((c) => matchPanelClientToLink(link, c, clientUuid))
}
