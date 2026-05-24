import { Inbound, Client, Settings } from "./data"

export type RawApiInbound = {
  id: number
  panelId: string | null
  remark: string
  tag?: string
  protocol: string
  port: number
  network: string
  tls: number | boolean
  enabled: number | boolean
  clientCount: number
  expiryTime: number | null
  up?: number
  down?: number
  allTime?: number
}

export type RawApiClientLink = {
  id: number
  clientId: number
  inboundId: number
  remoteId: string | null
  remoteEmail: string | null
  remotePass: string | null
  enabled: number | boolean
  createdAt: string
  updatedAt: string
}

export type RawApiClient = {
  id: number
  uuid: string
  email: string | null
  name: string
  panelSubId?: string | null
  totalQuota: number
  enabled: number | boolean
  expiryTime: number | null
  createdAt: string
  updatedAt: string
}

export type ClientSummary = {
  id: string
  uuid: string
  email: string
  enable: boolean
  totalGB: number
  usedGB: number
  expiryTime: number
  inboundIds: number[]
  usagePerInbound: { inboundId: number; up: number; down: number }[]
  links: Array<{ link: RawApiClientLink; inbound: RawApiInbound | null; usage: { up: number; down: number } }>
}

export type InboundSummary = Inbound & {
  up: number
  down: number
}

function bytesToGB(bytes: number) {
  return bytes
}

export function normalizeInboundRows(raw: RawApiInbound[]): InboundSummary[] {
  return raw.map(normalizeInbound)
}

function normalizeInbound(raw: RawApiInbound): InboundSummary {
  const up = Number(raw.up || 0)
  const down = Number(raw.down || 0)
  return {
    id: raw.id,
    remark: raw.remark,
    tag: raw.tag ?? "",
    protocol: (raw.protocol || "").toString() as Inbound["protocol"],
    port: Number(raw.port || 0),
    network: raw.network || "tcp",
    tls: raw.tls === true || raw.tls === 1,
    up,
    down,
    allTime: Number(raw.allTime ?? up + down),
    total: 0,
    enable: raw.enabled === true || raw.enabled === 1,
    clientCount: Number(raw.clientCount || 0),
    expiryTime: Number(raw.expiryTime || 0),
  }
}

function normalizeClient(raw: RawApiClient, links: any[], usedBytes: number): ClientSummary {
  const linkItems = links.map((item) => ({
    link: item.link,
    inbound: item.inbound,
    usage: item.usage || { up: 0, down: 0 },
  }))

  return {
    id: String(raw.id),
    uuid: raw.uuid,
    email: raw.name || raw.email || raw.uuid,
    enable: raw.enabled === true || raw.enabled === 1,
    totalGB: Number(raw.totalQuota || 0),
    usedGB: Number(usedBytes || 0),
    expiryTime: Number(raw.expiryTime || 0),
    inboundIds: linkItems.map((item) => item.link.inboundId),
    usagePerInbound: linkItems.map((item) => ({
      inboundId: item.link.inboundId,
      up: Number(item.usage.up || 0),
      down: Number(item.usage.down || 0),
    })),
    links: linkItems,
  }
}

export async function fetchSettings(): Promise<Settings> {
  const response = await fetch("/api/settings", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Unable to load settings")
  }
  return response.json()
}

export async function saveSettings(
  settings: Settings & { adminUsername?: string; adminPassword?: string }
) {
  const response = await fetch("/api/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      payload?.error ||
      (payload?.details ? "Validation failed" : null) ||
      "Unable to save settings"
    throw new Error(message)
  }
  return response.json()
}

export async function fetchInbounds(): Promise<InboundSummary[]> {
  const response = await fetch("/api/inbounds", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Unable to load inbounds")
  }
  const raw = await response.json()
  return Array.isArray(raw) ? raw.map(normalizeInbound) : []
}

export type SyncInboundsResult = {
  success: boolean
  synced?: unknown[]
  inbounds?: RawApiInbound[]
  inboundSyncStatus?: Record<number, "ok" | "error">
}

export async function syncInbounds(): Promise<SyncInboundsResult> {
  const response = await fetch("/api/inbounds", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "sync" }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      payload?.error || payload?.message || `Unable to sync inbounds (${response.status})`
    throw new Error(message)
  }

  return response.json()
}

export async function fetchClients(): Promise<ClientSummary[]> {
  const response = await fetch("/api/clients", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Unable to load clients")
  }
  const raw = await response.json()
  return Array.isArray(raw)
    ? raw.map((item: any) => normalizeClient(item.client, item.links, item.usedBytes))
    : []
}

export async function createClient(params: {
  name: string
  totalQuota: number
  inboundIds: number[]
}) {
  const response = await fetch("/api/clients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  })
  if (!response.ok) {
    throw new Error("Unable to create client")
  }
  return response.json()
}

export async function fetchClientDetail(id: string): Promise<ClientSummary> {
  const response = await fetch(`/api/clients/${encodeURIComponent(id)}`, { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Unable to load client detail")
  }
  const raw = await response.json()
  return normalizeClient(raw.client, raw.links, raw.usedBytes)
}

export async function updateClient(id: string, data: { name?: string; totalQuota?: number; enabled?: boolean; expiryTime?: string | null }) {
  const response = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || "Unable to update client")
  }
  return response.json()
}

export async function disableClient(id: string) {
  const response = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "disable" }),
  })
  if (!response.ok) {
    throw new Error("Unable to disable client")
  }
  return response.json()
}

export async function migrateClient(id: string, targetInboundId: number) {
  const response = await fetch(`/api/clients/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "migrate", targetInboundId }),
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.error || "Unable to migrate client")
  }
  return response.json()
}

export async function getMigrationPreview(sourceInboundId: number, targetInboundId: number) {
  const searchParams = new URLSearchParams({
    sourceInboundId: String(sourceInboundId),
    targetInboundId: String(targetInboundId),
  })
  const response = await fetch(`/api/inbounds/migrateClients?${searchParams}`, { cache: "no-store" })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message = payload?.error || payload?.errors?.[0] || "Unable to load migration preview"
    throw new Error(message)
  }
  return response.json()
}

export type MigrateClientsRequestOptions = {
  targetInboundIds?: number[]
  nameAffix?: "none" | "prefix" | "postfix"
  addPostfix?: boolean
  skipExisting?: boolean
}

export async function migrateInboundClients(
  sourceInboundId: number,
  targetInboundId: number | number[],
  options: MigrateClientsRequestOptions = {}
) {
  const targetInboundIds = Array.isArray(targetInboundId)
    ? targetInboundId
    : options.targetInboundIds ?? [targetInboundId]

  const response = await fetch("/api/inbounds/migrateClients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceInboundId,
      targetInboundIds: targetInboundIds.length > 1 ? targetInboundIds : undefined,
      targetInboundId: targetInboundIds.length === 1 ? targetInboundIds[0] : undefined,
      action: "migrate",
      ...options,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      payload?.error || payload?.errors?.[0] || `Unable to migrate clients (${response.status})`
    throw new Error(message)
  }

  return response.json()
}

export async function syncClientsFromPanel(sourceInboundId: number) {
  const response = await fetch("/api/inbounds/migrateClients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceInboundId,
      action: "sync",
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      payload?.error || payload?.errors?.[0] || `Unable to sync clients (${response.status})`
    throw new Error(message)
  }

  return response.json()
}

export async function syncAndMigrateInboundClients(
  sourceInboundId: number,
  targetInboundId: number | number[],
  options: MigrateClientsRequestOptions = {}
) {
  const targetInboundIds = Array.isArray(targetInboundId)
    ? targetInboundId
    : options.targetInboundIds ?? [targetInboundId]

  const response = await fetch("/api/inbounds/migrateClients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceInboundId,
      targetInboundIds: targetInboundIds.length > 1 ? targetInboundIds : undefined,
      targetInboundId: targetInboundIds.length === 1 ? targetInboundIds[0] : undefined,
      action: "sync-and-migrate",
      ...options,
    }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      payload?.error || payload?.errors?.[0] || `Unable to sync and migrate (${response.status})`
    throw new Error(message)
  }

  return response.json()
}
