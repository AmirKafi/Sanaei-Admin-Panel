/**
 * Build share links (vless/vmess/trojan) from panel inbound JSON.
 * Logic aligned with 3x-ui sub/subService.go.
 */

export type PanelClientRef = {
  id: string
  email: string
  flow?: string
  password?: string
  security?: string
}

export type GeneratedConfigMeta = {
  protocol: string
  port: number
  server: string
  remark: string
  network: string
  security: string
  uuid?: string
  email?: string
}

export type GeneratedLink = {
  uri: string
  label: string
  meta: GeneratedConfigMeta
}

function parseJsonField<T extends Record<string, unknown>>(
  value: unknown
): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T
    } catch {
      return {} as T
    }
  }
  if (value && typeof value === "object") return value as T
  return {} as T
}

function searchHost(headers: Record<string, unknown> | undefined): string {
  if (!headers) return ""
  for (const [key, val] of Object.entries(headers)) {
    if (key.toLowerCase() === "host") {
      if (Array.isArray(val)) return String(val[0] ?? "")
      return String(val ?? "")
    }
  }
  return ""
}

function searchKey(data: unknown, key: string): unknown {
  if (!data || typeof data !== "object") return undefined
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = searchKey(item, key)
      if (found !== undefined) return found
    }
    return undefined
  }
  const obj = data as Record<string, unknown>
  if (key in obj) return obj[key]
  for (const v of Object.values(obj)) {
    const found = searchKey(v, key)
    if (found !== undefined) return found
  }
  return undefined
}

function pickRandom<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined
  return items[Math.floor(Math.random() * items.length)]
}

function randomSeq(length: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

function buildLinkWithParams(
  link: string,
  params: Record<string, string>,
  fragment: string
): string {
  const url = new URL(link)
  const q = new URLSearchParams(url.search)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, v)
  }
  url.search = q.toString()
  url.hash = encodeURIComponent(fragment)
  return url.toString()
}

function buildLinkWithParamsAndSecurity(
  link: string,
  params: Record<string, string>,
  fragment: string,
  security: string,
  omitTlsFields: boolean
): string {
  const url = new URL(link)
  const q = new URLSearchParams(url.search)
  for (const [k, v] of Object.entries(params)) {
    if (k === "security") {
      q.set(k, security)
      continue
    }
    if (omitTlsFields && (k === "alpn" || k === "sni" || k === "fp")) continue
    if (v !== undefined && v !== "") q.set(k, v)
  }
  url.search = q.toString()
  url.hash = encodeURIComponent(fragment)
  return url.toString()
}

function applyPathAndHostParams(
  settings: Record<string, unknown>,
  params: Record<string, string>
) {
  const path = String(settings.path ?? "/")
  params.path = path
  const host =
    typeof settings.host === "string" && settings.host
      ? settings.host
      : searchHost(settings.headers as Record<string, unknown> | undefined)
  if (host) params.host = host
}

function buildXhttpExtra(xhttp: Record<string, unknown>): Record<string, unknown> | null {
  const extra: Record<string, unknown> = {}
  const xpb = xhttp.xPaddingBytes
  if (typeof xpb === "string" && xpb) extra.xPaddingBytes = xpb
  if (xhttp.xPaddingObfsMode === true) {
    extra.xPaddingObfsMode = true
    for (const field of [
      "xPaddingKey",
      "xPaddingHeader",
      "xPaddingPlacement",
      "xPaddingMethod",
    ]) {
      const v = xhttp[field]
      if (typeof v === "string" && v) extra[field] = v
    }
  }
  const mode = xhttp.mode
  if (typeof mode === "string" && mode) extra.mode = mode
  for (const field of [
    "sessionPlacement",
    "sessionKey",
    "seqPlacement",
    "seqKey",
    "uplinkDataPlacement",
    "uplinkDataKey",
    "scMaxEachPostBytes",
  ]) {
    const v = xhttp[field]
    if (typeof v === "string" && v) extra[field] = v
  }
  const rawHeaders = xhttp.headers as Record<string, unknown> | undefined
  if (rawHeaders && Object.keys(rawHeaders).length > 0) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rawHeaders)) {
      if (k.toLowerCase() === "host") continue
      out[k] = v
    }
    if (Object.keys(out).length > 0) extra.headers = out
  }
  return Object.keys(extra).length > 0 ? extra : null
}

function applyXhttpExtraParams(
  xhttp: Record<string, unknown>,
  params: Record<string, string>
) {
  applyPathAndHostParams(xhttp, params)
  const mode = xhttp.mode
  if (typeof mode === "string" && mode) params.mode = mode
  const xpb = xhttp.xPaddingBytes
  if (typeof xpb === "string" && xpb) params.x_padding_bytes = xpb
  const extra = buildXhttpExtra(xhttp)
  if (extra) params.extra = JSON.stringify(extra)
}

function applyShareNetworkParams(
  stream: Record<string, unknown>,
  streamNetwork: string,
  params: Record<string, string>
) {
  switch (streamNetwork) {
    case "tcp": {
      const tcp = stream.tcpSettings as Record<string, unknown> | undefined
      const header = tcp?.header as Record<string, unknown> | undefined
      const typeStr = String(header?.type ?? "")
      if (typeStr === "http") {
        const request = header?.request as Record<string, unknown> | undefined
        const requestPath = request?.path as unknown[] | undefined
        if (requestPath?.[0]) params.path = String(requestPath[0])
        params.host = searchHost(request?.headers as Record<string, unknown>)
        params.headerType = "http"
      }
      break
    }
    case "ws": {
      const ws = stream.wsSettings as Record<string, unknown> | undefined
      if (ws) applyPathAndHostParams(ws, params)
      break
    }
    case "grpc": {
      const grpc = stream.grpcSettings as Record<string, unknown> | undefined
      if (grpc) {
        params.serviceName = String(grpc.serviceName ?? "")
        if (grpc.authority) params.authority = String(grpc.authority)
        if (grpc.multiMode === true) params.mode = "multi"
      }
      break
    }
    case "httpupgrade": {
      const httpupgrade = stream.httpupgradeSettings as Record<string, unknown>
      if (httpupgrade) applyPathAndHostParams(httpupgrade, params)
      break
    }
    case "xhttp": {
      const xhttp = stream.xhttpSettings as Record<string, unknown> | undefined
      if (xhttp) applyXhttpExtraParams(xhttp, params)
      break
    }
  }
}

function applyShareTLSParams(stream: Record<string, unknown>, params: Record<string, string>) {
  params.security = "tls"
  const tlsSetting = stream.tlsSettings as Record<string, unknown> | undefined
  if (!tlsSetting) return
  const alpns = tlsSetting.alpn as unknown[] | undefined
  if (alpns?.length) {
    params.alpn = alpns.map((a) => String(a)).join(",")
  }
  const sniValue = searchKey(tlsSetting, "serverName")
  if (typeof sniValue === "string" && sniValue) params.sni = sniValue
  const tlsSettings = searchKey(tlsSetting, "settings")
  const fpValue = searchKey(tlsSettings, "fingerprint")
  if (typeof fpValue === "string" && fpValue) params.fp = fpValue
}

function applyShareRealityParams(stream: Record<string, unknown>, params: Record<string, string>) {
  params.security = "reality"
  const realitySetting = stream.realitySettings as Record<string, unknown> | undefined
  if (!realitySetting) return
  const realitySettings = searchKey(realitySetting, "settings")
  const sNames = searchKey(realitySetting, "serverNames") as unknown[] | undefined
  const picked = pickRandom(sNames ?? [])
  if (typeof picked === "string") params.sni = picked
  const pbkValue = searchKey(realitySettings, "publicKey")
  if (typeof pbkValue === "string") params.pbk = pbkValue
  const sidValue = searchKey(realitySetting, "shortIds") as unknown[] | undefined
  const sid = pickRandom(sidValue ?? [])
  if (typeof sid === "string") params.sid = sid
  const fpValue = searchKey(realitySettings, "fingerprint")
  if (typeof fpValue === "string" && fpValue) params.fp = fpValue
  params.spx = `/${randomSeq(15)}`
}

function buildExternalProxyURLLinks(
  externalProxies: unknown[],
  params: Record<string, string>,
  baseSecurity: string,
  makeLink: (dest: string, port: number) => string,
  makeRemark: (ep: Record<string, unknown>) => string
): string[] {
  const links: string[] = []
  for (const externalProxy of externalProxies) {
    const ep = externalProxy as Record<string, unknown>
    const newSecurity = String(ep.forceTls ?? "same")
    const dest = String(ep.dest ?? "")
    const port = Number(ep.port ?? 0)
    let securityToApply = baseSecurity
    if (newSecurity !== "same") securityToApply = newSecurity
    links.push(
      buildLinkWithParamsAndSecurity(
        makeLink(dest, port),
        params,
        makeRemark(ep),
        securityToApply,
        newSecurity === "none"
      )
    )
  }
  return links
}

function genRemark(inboundRemark: string, email: string, extra = ""): string {
  const parts = [inboundRemark, email, extra].filter(Boolean)
  return parts.join("-")
}

function resolveInboundAddress(
  remoteInbound: Record<string, unknown>,
  fallbackHost: string
): string {
  const listen = String(remoteInbound.listen ?? "").trim()
  if (
    !listen ||
    listen === "0.0.0.0" ||
    listen === "::" ||
    listen === "::0"
  ) {
    return fallbackHost
  }
  return listen
}

function findClientInSettings(
  settings: Record<string, unknown>,
  match: { email?: string; uuid?: string }
): PanelClientRef | null {
  const clients = Array.isArray(settings.clients) ? settings.clients : []
  const email = String(match.email ?? "").trim().toLowerCase()
  const uuid = String(match.uuid ?? "").trim()

  for (const raw of clients) {
    const c = raw as Record<string, unknown>
    const cEmail = String(c.email ?? c.user ?? "").trim().toLowerCase()
    const cId = String(c.id ?? c.uuid ?? "").trim()
    if (email && cEmail === email) {
      return {
        id: cId,
        email: String(c.email ?? c.user ?? "").trim() || cEmail,
        flow: String(c.flow ?? ""),
        password: String(c.password ?? ""),
        security: String(c.security ?? ""),
      }
    }
    if (uuid && cId === uuid) {
      return {
        id: cId,
        email: cEmail || uuid,
        flow: String(c.flow ?? ""),
        password: String(c.password ?? ""),
        security: String(c.security ?? ""),
      }
    }
  }
  return null
}

function buildVmessLink(obj: Record<string, unknown>): string {
  const jsonStr = JSON.stringify(obj, null, 2)
  return `vmess://${Buffer.from(jsonStr, "utf8").toString("base64")}`
}

function applyVmessNetworkParams(
  stream: Record<string, unknown>,
  network: string,
  obj: Record<string, unknown>
) {
  obj.net = network
  switch (network) {
    case "ws": {
      const ws = stream.wsSettings as Record<string, unknown> | undefined
      if (ws) {
        obj.path = ws.path ?? "/"
        const host =
          typeof ws.host === "string" && ws.host
            ? ws.host
            : searchHost(ws.headers as Record<string, unknown>)
        if (host) obj.host = host
      }
      break
    }
    case "grpc": {
      const grpc = stream.grpcSettings as Record<string, unknown> | undefined
      if (grpc) {
        obj.path = grpc.serviceName ?? ""
        obj.authority = grpc.authority ?? ""
        if (grpc.multiMode === true) obj.type = "multi"
      }
      break
    }
    case "xhttp": {
      const xhttp = stream.xhttpSettings as Record<string, unknown> | undefined
      if (xhttp) {
        obj.path = xhttp.path ?? "/"
        const host =
          typeof xhttp.host === "string" && xhttp.host
            ? xhttp.host
            : searchHost(xhttp.headers as Record<string, unknown>)
        if (host) obj.host = host
        if (xhttp.mode) obj.mode = xhttp.mode
      }
      break
    }
  }
}

function applyVmessTLSParams(stream: Record<string, unknown>, obj: Record<string, unknown>) {
  const tlsSetting = stream.tlsSettings as Record<string, unknown> | undefined
  if (!tlsSetting) return
  const alpns = tlsSetting.alpn as unknown[] | undefined
  if (alpns?.length) obj.alpn = alpns.map((a) => String(a)).join(",")
  const sniValue = searchKey(tlsSetting, "serverName")
  if (typeof sniValue === "string") obj.sni = sniValue
  const tlsSettings = searchKey(tlsSetting, "settings")
  const fpValue = searchKey(tlsSettings, "fingerprint")
  if (typeof fpValue === "string") obj.fp = fpValue
}

function genVmessLink(
  remoteInbound: Record<string, unknown>,
  client: PanelClientRef,
  fallbackHost: string
): GeneratedLink[] {
  const address = resolveInboundAddress(remoteInbound, fallbackHost)
  const port = Number(remoteInbound.port ?? 0)
  const remark = String(remoteInbound.remark ?? "").trim()
  const stream = parseJsonField<Record<string, unknown>>(remoteInbound.streamSettings)
  const network = String(stream.network ?? "tcp")
  const obj: Record<string, unknown> = {
    v: "2",
    add: address,
    port,
    type: "none",
    id: client.id,
    scy: client.security || "auto",
  }
  applyVmessNetworkParams(stream, network, obj)
  const security = String(stream.security ?? "none")
  obj.tls = security
  if (security === "tls") applyVmessTLSParams(stream, obj)

  const externalProxies = stream.externalProxy as unknown[] | undefined
  const label = genRemark(remark, client.email)
  const meta: GeneratedConfigMeta = {
    protocol: "vmess",
    port,
    server: address,
    remark: label,
    network,
    security,
    uuid: client.id,
    email: client.email,
  }

  if (externalProxies?.length) {
    return externalProxies.map((epRaw) => {
      const ep = epRaw as Record<string, unknown>
      const newObj = { ...obj }
      const newSecurity = String(ep.forceTls ?? "same")
      newObj.ps = genRemark(remark, client.email, String(ep.remark ?? ""))
      newObj.add = String(ep.dest ?? address)
      newObj.port = Number(ep.port ?? port)
      if (newSecurity !== "same") newObj.tls = newSecurity
      const uri = buildVmessLink(newObj)
      return {
        uri,
        label: String(newObj.ps),
        meta: { ...meta, server: String(newObj.add), port: Number(newObj.port) },
      }
    })
  }

  obj.ps = label
  return [{ uri: buildVmessLink(obj), label, meta }]
}

function genVlessLink(
  remoteInbound: Record<string, unknown>,
  client: PanelClientRef,
  fallbackHost: string
): GeneratedLink[] {
  const address = resolveInboundAddress(remoteInbound, fallbackHost)
  const port = Number(remoteInbound.port ?? 0)
  const remark = String(remoteInbound.remark ?? "").trim()
  const stream = parseJsonField<Record<string, unknown>>(remoteInbound.streamSettings)
  const settings = parseJsonField<Record<string, unknown>>(remoteInbound.settings)
  const network = String(stream.network ?? "tcp")
  const params: Record<string, string> = { type: network }
  const encryption = settings.encryption
  if (typeof encryption === "string") params.encryption = encryption

  applyShareNetworkParams(stream, network, params)
  const security = String(stream.security ?? "none")
  switch (security) {
    case "tls":
      applyShareTLSParams(stream, params)
      if (network === "tcp" && client.flow) params.flow = client.flow
      break
    case "reality":
      applyShareRealityParams(stream, params)
      if (network === "tcp" && client.flow) params.flow = client.flow
      break
    default:
      params.security = "none"
  }

  const externalProxies = stream.externalProxy as unknown[] | undefined
  const baseMeta: GeneratedConfigMeta = {
    protocol: "vless",
    port,
    server: address,
    remark: genRemark(remark, client.email),
    network,
    security,
    uuid: client.id,
    email: client.email,
  }

  if (externalProxies?.length) {
    const uris = buildExternalProxyURLLinks(
      externalProxies,
      params,
      security,
      (dest, p) => `vless://${client.id}@${dest}:${p}`,
      (ep) => genRemark(remark, client.email, String(ep.remark ?? ""))
    )
    return uris.map((uri, i) => {
      const ep = externalProxies[i] as Record<string, unknown>
      const label = genRemark(remark, client.email, String(ep.remark ?? ""))
      return {
        uri,
        label,
        meta: {
          ...baseMeta,
          server: String(ep.dest ?? address),
          port: Number(ep.port ?? port),
          remark: label,
        },
      }
    })
  }

  const label = genRemark(remark, client.email)
  const uri = buildLinkWithParams(`vless://${client.id}@${address}:${port}`, params, label)
  return [{ uri, label, meta: { ...baseMeta, remark: label } }]
}

function genTrojanLink(
  remoteInbound: Record<string, unknown>,
  client: PanelClientRef,
  fallbackHost: string
): GeneratedLink[] {
  const address = resolveInboundAddress(remoteInbound, fallbackHost)
  const port = Number(remoteInbound.port ?? 0)
  const remark = String(remoteInbound.remark ?? "").trim()
  const stream = parseJsonField<Record<string, unknown>>(remoteInbound.streamSettings)
  const password = client.password || client.id
  const network = String(stream.network ?? "tcp")
  const params: Record<string, string> = { type: network }

  applyShareNetworkParams(stream, network, params)
  const security = String(stream.security ?? "none")
  switch (security) {
    case "tls":
      applyShareTLSParams(stream, params)
      break
    case "reality":
      applyShareRealityParams(stream, params)
      if (network === "tcp" && client.flow) params.flow = client.flow
      break
    default:
      params.security = "none"
  }

  const externalProxies = stream.externalProxy as unknown[] | undefined
  const baseMeta: GeneratedConfigMeta = {
    protocol: "trojan",
    port,
    server: address,
    remark: genRemark(remark, client.email),
    network,
    security,
    email: client.email,
  }

  if (externalProxies?.length) {
    const uris = buildExternalProxyURLLinks(
      externalProxies,
      params,
      security,
      (dest, p) => `trojan://${password}@${dest}:${p}`,
      (ep) => genRemark(remark, client.email, String(ep.remark ?? ""))
    )
    return uris.map((uri, i) => {
      const ep = externalProxies[i] as Record<string, unknown>
      const label = genRemark(remark, client.email, String(ep.remark ?? ""))
      return {
        uri,
        label,
        meta: {
          ...baseMeta,
          server: String(ep.dest ?? address),
          port: Number(ep.port ?? port),
          remark: label,
        },
      }
    })
  }

  const label = genRemark(remark, client.email)
  const uri = buildLinkWithParams(
    `trojan://${password}@${address}:${port}`,
    params,
    label
  )
  return [{ uri, label, meta: { ...baseMeta, remark: label } }]
}

/** Generate all share links for one client on one inbound. */
export function generateInboundLinks(
  remoteInbound: Record<string, unknown>,
  match: { email?: string; uuid?: string; subId?: string },
  fallbackHost: string
): GeneratedLink[] {
  const protocol = String(remoteInbound.protocol ?? "").toLowerCase()
  const settings = parseJsonField<Record<string, unknown>>(remoteInbound.settings)
  const client = findClientInSettings(settings, match)
  if (!client) return []

  switch (protocol) {
    case "vmess":
      return genVmessLink(remoteInbound, client, fallbackHost)
    case "vless":
      return genVlessLink(remoteInbound, client, fallbackHost)
    case "trojan":
      return genTrojanLink(remoteInbound, client, fallbackHost)
    default:
      return []
  }
}

export function hostFromPanelUrl(panelUrl: string): string {
  try {
    return new URL(panelUrl).hostname
  } catch {
    return ""
  }
}
