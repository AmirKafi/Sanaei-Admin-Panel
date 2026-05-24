/** Panel/API values may be GB (small int) or bytes (large). Normalize to bytes for DB. */
export function normalizeQuotaToBytes(value: number): number {
  const n = Number(value)
  if (!n || n <= 0) return 0
  // Values under ~100 TB expressed as GB (e.g. 1, 5, 100)
  if (n < 100_000) {
    return Math.round(n * 1024 * 1024 * 1024)
  }
  return Math.round(n)
}

/**
 * Panel client JSON uses the field name `totalGB`, but the value is quota in bytes.
 */
export function quotaBytesToPanelTotalField(bytes: number): number {
  if (bytes <= 0) return 0
  return Math.round(bytes)
}

/** @alias quotaBytesToPanelTotalField */
export const bytesToPanelTotalGB = quotaBytesToPanelTotalField

export function sanitizeInboundToken(remark: string, inboundId: number): string {
  const fromRemark = remark.replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "")
  return fromRemark || `ib${inboundId}`
}

/** Short inbound token for panel client email (shown in VPN apps on import). */
export function shortInboundToken(inboundId: number): string {
  return `ib${inboundId}`
}

export type NameAffixMode = "none" | "prefix" | "postfix"

/** Resolve legacy addPostfix flag or explicit affix mode. */
export function resolveNameAffixMode(options: {
  nameAffix?: NameAffixMode
  addPostfix?: boolean
}): NameAffixMode {
  if (options.nameAffix) return options.nameAffix
  if (options.addPostfix === false) return "none"
  return "postfix"
}

/** Unique panel email when the same logical client exists on multiple inbounds. */
export function buildMigratedClientEmail(
  baseEmail: string,
  targetInboundRemark: string,
  targetInboundId: number,
  affix: NameAffixMode | boolean
): string {
  const base = baseEmail.trim()
  const mode: NameAffixMode =
    typeof affix === "boolean" ? (affix ? "postfix" : "none") : affix
  if (mode === "none") return base
  const token = shortInboundToken(targetInboundId)
  if (mode === "prefix") return `${token}-${base}`
  return `${base}-${token}`
}

export function resolvePanelClientQuotaBytes(
  stats: { total?: number; totalGB?: number } | null | undefined,
  settingsClient: { totalGB?: number; total?: number } | null | undefined
): number {
  if (stats?.total != null && Number(stats.total) > 0) {
    return normalizeQuotaToBytes(Number(stats.total))
  }
  if (stats?.totalGB != null && Number(stats.totalGB) > 0) {
    return Math.round(Number(stats.totalGB))
  }
  const fromSettings = settingsClient?.totalGB ?? settingsClient?.total
  if (fromSettings != null && Number(fromSettings) > 0) {
    const n = Number(fromSettings)
    if (settingsClient?.totalGB != null) {
      return Math.round(n)
    }
    return normalizeQuotaToBytes(n)
  }
  return 0
}
