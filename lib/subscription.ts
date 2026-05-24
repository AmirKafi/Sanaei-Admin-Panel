import { prisma } from "./prisma"
import {
  generateInboundLinks,
  hostFromPanelUrl,
  type GeneratedConfigMeta,
} from "./panel-link"
import {
  findPanelClientForLink,
  parsePanelInbound,
  resolvePanelList,
} from "./panel-traffic"
import {
  getPanelRootUrl,
  getPanelSettings,
  panelApiRequest,
  panelIsConfigured,
} from "./sanaei"

export type SubscriptionConfig = {
  label: string
  uri: string
  meta?: GeneratedConfigMeta
  inboundId?: number
}

export type SubscriptionInboundConfig = {
  name: string
  url: string
  downloaded: number
  uploaded: number
  usage: number
  meta?: GeneratedConfigMeta
}

export type SubscriptionInbound = {
  inboundId: number
  name: string
  type: string
  totalDownloaded: number
  totalUploaded: number
  totalUsage: number
  configs: SubscriptionInboundConfig[]
}

export type SubscriptionPayload = {
  subId: string
  clientName: string | null
  status: "active" | "disabled"
  downloaded: number
  uploaded: number
  usage: number
  totalQuota: number
  remained: number
  expiryTime: number | null
  lastOnline: number | null
  subscriptionUrl: string
  clashSubscriptionUrl: string
  configs: SubscriptionConfig[]
  inbounds: SubscriptionInbound[]
}

const PROTOCOL_PREFIXES = [
  "vless://",
  "vmess://",
  "trojan://",
  "ss://",
  "tuic://",
  "hy2://",
  "hysteria2://",
]

export function decodeSubscriptionBody(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ""
  if (trimmed.includes("://")) return trimmed
  try {
    const decoded = Buffer.from(trimmed, "base64").toString("utf8")
    if (decoded.includes("://")) return decoded
  } catch {
    /* not base64 */
  }
  return trimmed
}

export function parseSubscriptionConfigs(text: string): SubscriptionConfig[] {
  const decoded = decodeSubscriptionBody(text)
  const lines = decoded.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

  return lines
    .filter((line) =>
      PROTOCOL_PREFIXES.some((prefix) => line.toLowerCase().startsWith(prefix))
    )
    .map((uri) => {
      const hashIdx = uri.lastIndexOf("#")
      let label = "Config"
      if (hashIdx >= 0) {
        try {
          label = decodeURIComponent(uri.slice(hashIdx + 1)) || label
        } catch {
          label = uri.slice(hashIdx + 1) || label
        }
      }
      return { label, uri }
    })
}

export function buildPanelSubscriptionUrls(panelRoot: string, subId: string) {
  const base = panelRoot.replace(/\/+$/, "")
  const encoded = encodeURIComponent(subId)
  return {
    subscriptionUrl: `${base}/sub/${encoded}`,
    clashSubscriptionUrl: `${base}/sub/${encoded}?target=clash`,
  }
}

async function fetchUrlText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" })
    if (!response.ok) return null
    return await response.text()
  } catch {
    return null
  }
}

function detectProtocolFromUri(uri: string): string {
  const lower = uri.toLowerCase()
  if (lower.startsWith("vless://")) return "vless"
  if (lower.startsWith("vmess://")) return "vmess"
  if (lower.startsWith("trojan://")) return "trojan"
  if (lower.startsWith("ss://")) return "shadowsocks"
  return "other"
}

function configMatchesLink(
  config: SubscriptionConfig,
  remoteEmail: string | null,
  inboundRemark: string,
  inboundPort?: number,
  inboundProtocol?: string
): boolean {
  const label = config.label.toLowerCase()
  const email = (remoteEmail || "").toLowerCase()
  const remark = inboundRemark.toLowerCase()
  const protocol = (inboundProtocol || "").toLowerCase()

  // 1. If we have meta (generated from panel), use it for high-confidence matching
  if (config.meta) {
    const meta = config.meta
    const portMatch = inboundPort == null || meta.port === inboundPort
    const protocolMatch = !protocol || meta.protocol.toLowerCase() === protocol

    // If we have both port and protocol match, it's almost certainly this inbound
    if (portMatch && protocolMatch) {
      // Still check email if provided to be sure it's the right client
      if (!email) return true
      const emailNorm = email.replace(/[^a-z0-9]/g, "")
      const labelNorm = label.replace(/[^a-z0-9]/g, "")
      return labelNorm.includes(emailNorm)
    }
  }

  // 2. Fallback to fuzzy matching but require BOTH email and remark if both are present
  // to avoid one inbound taking all configs of the same client.
  const emailNorm = email.replace(/[^a-z0-9]/g, "")
  const remarkNorm = remark.replace(/[^a-z0-9]/g, "")
  const labelNorm = label.replace(/[^a-z0-9]/g, "")

  const emailMatches = !emailNorm || labelNorm.includes(emailNorm)
  const remarkMatches = !remarkNorm || labelNorm.includes(remarkNorm)

  if (emailNorm && remarkNorm) {
    return emailMatches && remarkMatches
  }

  return emailMatches || remarkMatches
}

async function getLinkUsage(clientInboundId: number) {
  const snapshot = await prisma.usageSnapshot.findFirst({
    where: { clientInboundId },
    orderBy: { recordedAt: "desc" },
  })
  const up = Number(snapshot?.up ?? 0)
  const down = Number(snapshot?.down ?? 0)
  return { up, down }
}

function buildInboundConfigEntry(
  config: SubscriptionConfig,
  up: number,
  down: number,
  meta?: GeneratedConfigMeta
): SubscriptionInboundConfig {
  return {
    name: config.label,
    url: config.uri,
    downloaded: down,
    uploaded: up,
    usage: up + down,
    meta,
  }
}

function maxLastOnline(values: Array<number | null | undefined>): number | null {
  let max: number | null = null
  for (const v of values) {
    if (v == null || v <= 0) continue
    if (max == null || v > max) max = v
  }
  return max
}

async function fetchRemoteInbounds(): Promise<Record<string, unknown>[]> {
  const response = await panelApiRequest("/inbounds/list", "GET")
  return resolvePanelList(response) as Record<string, unknown>[]
}

type ClientMatchInput = {
  subId: string
  uuid?: string | null
  links: Array<{
    inboundId: number
    inbound: { panelId: string | null; remark: string; protocol: string } | null
    remoteEmail: string | null
    remoteId: string | null
  }>
}

async function buildConfigsFromPanelInbounds(
  match: ClientMatchInput
): Promise<{ configs: SubscriptionConfig[]; lastOnline: number | null }> {
  const remotes = await fetchRemoteInbounds()
  const fallbackHost = hostFromPanelUrl((await getPanelSettings()).panelUrl)
  const configs: SubscriptionConfig[] = []
  const lastOnlineValues: Array<number | null> = []

  const inboundByPanelId = new Map(
    remotes.map((inbound) => [
      String(inbound.id ?? inbound._id ?? inbound.inboundId ?? "").trim(),
      inbound,
    ])
  )

  const linkedPanelIds = new Set(
    match.links.map((l) => l.inbound?.panelId).filter(Boolean) as string[]
  )

  // 1. Process linked inbounds in our database
  for (const link of match.links) {
    const panelId = link.inbound?.panelId
    if (!panelId) continue
    const remote = inboundByPanelId.get(panelId)
    if (!remote) continue

    const parsed = parsePanelInbound(remote)
    const panelClient = findPanelClientForLink(
      { remoteEmail: link.remoteEmail, remoteId: link.remoteId },
      parsed.clients,
      match.uuid
    )
    if (panelClient?.lastOnline) lastOnlineValues.push(panelClient.lastOnline)

    const generated = generateInboundLinks(
      remote,
      {
        email: link.remoteEmail ?? panelClient?.email,
        uuid: link.remoteId ?? panelClient?.uuid ?? match.uuid,
        // We don't pass subId here to force strict matching for the specific link.
      },
      fallbackHost
    )

    for (const item of generated) {
      configs.push({
        label: item.label,
        uri: item.uri,
        meta: item.meta,
        inboundId: link.inboundId,
      })
    }
  }

  // 2. Process other inbounds on panel that are NOT linked in our DB
  // Since we no longer use subId on the panel, we can't reliably find other inbounds
  // unless we search by email/uuid, but we've already handled linked ones.

  return { configs, lastOnline: maxLastOnline(lastOnlineValues) }
}

async function buildInboundGroups(
  clientId: number,
  configs: SubscriptionConfig[]
): Promise<SubscriptionInbound[]> {
  const links = await prisma.clientInbound.findMany({
    where: { clientId },
    include: { inbound: true },
    orderBy: { inboundId: "asc" },
  })

  if (links.length === 0) {
    if (configs.length === 0) return []
    const type = detectProtocolFromUri(configs[0]?.uri ?? "")
    return [
      {
        inboundId: 0,
        name: "Configs",
        type,
        totalDownloaded: 0,
        totalUploaded: 0,
        totalUsage: 0,
        configs: configs.map((c) => buildInboundConfigEntry(c, 0, 0, c.meta)),
      },
    ]
  }

  const remaining = [...configs]
  const groups: SubscriptionInbound[] = []

  if (links.length === configs.length && configs.length > 0) {
    for (let i = 0; i < links.length; i++) {
      const link = links[i]
      const config = configs[i]
      const { up, down } = await getLinkUsage(link.id)
      const remark = link.inbound?.remark || `Inbound ${link.inboundId}`
      const protocol = (link.inbound?.protocol || detectProtocolFromUri(config.uri)).toLowerCase()
      groups.push({
        inboundId: link.inboundId,
        name: remark,
        type: protocol,
        totalDownloaded: down,
        totalUploaded: up,
        totalUsage: up + down,
        configs: [buildInboundConfigEntry(config, up, down, config.meta)],
      })
    }
    return groups
  }

  for (const link of links) {
    const remark = link.inbound?.remark || `Inbound ${link.inboundId}`
    const protocol = (link.inbound?.protocol || "other").toLowerCase()
    const { up, down } = await getLinkUsage(link.id)

    const matched: SubscriptionConfig[] = []
    const nextRemaining: SubscriptionConfig[] = []
    for (const config of remaining) {
      // Priority 1: Match by inboundId if available
      if (config.inboundId === link.inboundId) {
        matched.push(config)
      }
      // Priority 2: Fallback to fuzzy matching for configs without inboundId
      else if (
        !config.inboundId &&
        configMatchesLink(
          config,
          link.remoteEmail,
          remark,
          link.inbound?.port,
          link.inbound?.protocol
        )
      ) {
        matched.push(config)
      } else {
        nextRemaining.push(config)
      }
    }
    remaining.splice(0, remaining.length, ...nextRemaining)

    const assigned = matched
    const perUp = assigned.length > 0 ? Math.floor(up / assigned.length) : 0
    const perDown = assigned.length > 0 ? Math.floor(down / assigned.length) : 0

    groups.push({
      inboundId: link.inboundId,
      name: remark,
      type: protocol,
      totalDownloaded: down,
      totalUploaded: up,
      totalUsage: up + down,
      configs: assigned.map((c) => buildInboundConfigEntry(c, perUp, perDown, c.meta)),
    })
  }

  if (remaining.length > 0) {
    const byProtocol = new Map<string, SubscriptionConfig[]>()
    for (const config of remaining) {
      const type = detectProtocolFromUri(config.uri)
      const list = byProtocol.get(type) ?? []
      list.push(config)
      byProtocol.set(type, list)
    }
    for (const [type, list] of byProtocol) {
      groups.push({
        inboundId: -1,
        name: type.toUpperCase(),
        type,
        totalDownloaded: 0,
        totalUploaded: 0,
        totalUsage: 0,
        configs: list.map((c) => buildInboundConfigEntry(c, 0, 0, c.meta)),
      })
    }
  }

  if (groups.length === 0 && configs.length > 0) {
    const type = detectProtocolFromUri(configs[0].uri)
    return [
      {
        inboundId: 0,
        name: "Config Links",
        type,
        totalDownloaded: 0,
        totalUploaded: 0,
        totalUsage: 0,
        configs: configs.map((c) => buildInboundConfigEntry(c, 0, 0, c.meta)),
      },
    ]
  }

  return groups
}

async function getLatestUsageForClient(clientId: number) {
  const links = await prisma.clientInbound.findMany({ where: { clientId } })
  let up = 0
  let down = 0

  for (const link of links) {
    const usage = await getLinkUsage(link.id)
    up += usage.up
    down += usage.down
  }

  return { up, down }
}

export async function getSubscriptionBySubId(
  subId: string
): Promise<SubscriptionPayload | null> {
  const trimmed = subId.trim()
  if (!trimmed) return null

  const client = await prisma.client.findFirst({
    where: { uuid: trimmed },
  })

  const configured = await panelIsConfigured().catch(() => false)
  let subscriptionUrl = ""
  let clashSubscriptionUrl = ""

  // Use /sub/ path which handles both UI and plain text via middleware
  subscriptionUrl = `/sub/${trimmed}`
  clashSubscriptionUrl = `/sub/${trimmed}?target=clash`

  let configs: SubscriptionConfig[] = []
  let lastOnline: number | null = null

  if (configured) {
    try {
      if (client) {
        const links = await prisma.clientInbound.findMany({
          where: { clientId: client.id },
          include: { inbound: true },
        })
        const built = await buildConfigsFromPanelInbounds({
          subId: trimmed,
          uuid: client.uuid,
          links: links.map((link) => ({
            inboundId: link.inboundId,
            inbound: link.inbound,
            remoteEmail: link.remoteEmail,
            remoteId: link.remoteId,
          })),
        })
        configs = built.configs
        lastOnline = built.lastOnline
      }
    } catch (error) {
      console.error("[subscription] Failed to build configs from panel inbounds:", error)
    }
  }

  // If no configs found from linked inbounds, don't fallback to panel's sub endpoint
  // as per "handled on our side" requirement.

  if (!client) {
    return null
  }

  const { up, down } = await getLatestUsageForClient(client.id)
  const inbounds = await buildInboundGroups(client.id, configs)
  const totalQuota = Number(client.totalQuota ?? 0)
  const usage = up + down
  const remained = totalQuota > 0 ? Math.max(0, totalQuota - usage) : 0

  const expiryMs = client.expiryTime ? client.expiryTime.getTime() : null

  return {
    subId: trimmed,
    clientName: client.name,
    status: client.enabled ? "active" : "disabled",
    downloaded: down,
    uploaded: up,
    usage,
    totalQuota,
    remained,
    expiryTime: expiryMs,
    lastOnline,
    subscriptionUrl,
    clashSubscriptionUrl,
    configs,
    inbounds,
  }
}

async function buildInboundGroupsFromConfigsOnly(
  configs: SubscriptionConfig[]
): Promise<SubscriptionInbound[]> {
  if (configs.length === 0) return []
  const type = detectProtocolFromUri(configs[0].uri)
  return [
    {
      inboundId: 0,
      name: "Config Links",
      type,
      totalDownloaded: 0,
      totalUploaded: 0,
      totalUsage: 0,
      configs: configs.map((c) => buildInboundConfigEntry(c, 0, 0, c.meta)),
    },
  ]
}
