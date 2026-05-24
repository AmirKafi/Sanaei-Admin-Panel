export type InboundSyncFields = {
  remark: string
  protocol: string
  port: number
  network: string
  tls: boolean
  enabled: boolean
  clientCount: number
  trafficUp: bigint
  trafficDown: bigint
  expiryTime: Date | null
}

/** Maps remote panel inbound payload to Prisma Inbound create/update fields. */
export function buildInboundSyncData(
  remoteInbound: Record<string, unknown>
): InboundSyncFields {
  const panelTag = String(remoteInbound.tag ?? "").trim()
  const remarkFromPanel = String(
    remoteInbound.remark ?? remoteInbound.name ?? ""
  ).trim()
  const trafficUp = BigInt(Number(remoteInbound.up ?? 0))
  const trafficDown = BigInt(Number(remoteInbound.down ?? 0))

  return {
    remark: remarkFromPanel || panelTag || "Inbound",
    protocol: String(remoteInbound.protocol ?? remoteInbound.type ?? ""),
    port: Number(remoteInbound.port ?? remoteInbound.listen ?? 0),
    network: String(remoteInbound.network ?? remoteInbound.net ?? "tcp"),
    tls:
      remoteInbound.tls === true ||
      remoteInbound.tls === 1 ||
      remoteInbound.tls === "true",
    enabled: !(remoteInbound.enable === false || remoteInbound.enabled === false),
    clientCount: Number(
      remoteInbound.clientCount ??
        (remoteInbound.clientStats as unknown[] | undefined)?.length ??
        (remoteInbound.settings as { clients?: unknown[] } | undefined)?.clients
          ?.length ??
        0
    ),
    trafficUp,
    trafficDown,
    expiryTime:
      Number(remoteInbound.expiryTime) > 0
        ? new Date(Number(remoteInbound.expiryTime))
        : null,
  }
}
