export interface Inbound {
  id: number
  remark: string
  tag?: string
  protocol: "vmess" | "vless" | "trojan" | "shadowsocks"
  port: number
  network: string
  tls: boolean
  up: number      // bytes
  down: number    // bytes
  allTime: number // bytes
  total: number   // bytes, 0 = unlimited
  enable: boolean
  clientCount: number
  expiryTime: number // unix ms, 0 = never
}

export interface Client {
  id: string
  email: string
  enable: boolean
  totalGB: number   // quota in bytes
  usedGB: number    // used in bytes
  expiryTime: number
  inboundIds: number[]
  usagePerInbound: { inboundId: number; up: number; down: number }[]
}

export interface Settings {
  checkIntervalSeconds: number
  panelUrl: string
  username: string
  password: string
  adminUsername?: string
  adminPassword?: string
}

export const mockInbounds: Inbound[] = [
  {
    id: 1,
    remark: "VLESS-TCP-XTLS",
    protocol: "vless",
    port: 443,
    network: "tcp",
    tls: true,
    up: 52428800000,
    down: 157286400000,    allTime: 52586086400,    total: 0,
    enable: true,
    clientCount: 12,
    expiryTime: 0,
  },
  {
    id: 2,
    remark: "VMess-WS-TLS",
    protocol: "vmess",
    port: 8443,
    network: "ws",
    tls: true,
    up: 31457280000,
    down: 94371840000,
    allTime: 125829120000,
    total: 524288000000,
    enable: true,
    clientCount: 8,
    expiryTime: 1735689600000,
  },
  {
    id: 3,
    remark: "Trojan-gRPC",
    protocol: "trojan",
    port: 2053,
    network: "grpc",
    tls: true,
    up: 10485760000,
    down: 41943040000,
    allTime: 52428800000,
    total: 214748364800,
    enable: true,
    clientCount: 5,
    expiryTime: 0,
  },
  {
    id: 4,
    remark: "SS-TCP-Direct",
    protocol: "shadowsocks",
    port: 1080,
    network: "tcp",
    tls: false,
    up: 2097152000,
    down: 8388608000,
    allTime: 10485760000,
    total: 107374182400,
    enable: false,
    clientCount: 3,
    expiryTime: 1704067200000,
  },
  {
    id: 5,
    remark: "VLESS-Reality",
    protocol: "vless",
    port: 8080,
    network: "tcp",
    tls: true,
    up: 78643200000,
    down: 209715200000,
    allTime: 288358400000,
    total: 0,
    enable: true,
    clientCount: 18,
    expiryTime: 0,
  },
]

export const mockClients: Client[] = [
  {
    id: "uuid-001",
    email: "admin_user",
    enable: true,
    totalGB: 53687091200,
    usedGB: 21474836480,
    expiryTime: 1748736000000,
    inboundIds: [1, 2, 5],
    usagePerInbound: [
      { inboundId: 1, up: 3221225472, down: 8589934592 },
      { inboundId: 2, up: 1073741824, down: 4294967296 },
      { inboundId: 5, up: 1073741824, down: 3221225472 },
    ],
  },
  {
    id: "uuid-002",
    email: "user_alpha",
    enable: true,
    totalGB: 10737418240,
    usedGB: 8589934592,
    expiryTime: 1745107200000,
    inboundIds: [1, 3],
    usagePerInbound: [
      { inboundId: 1, up: 2147483648, down: 4294967296 },
      { inboundId: 3, up: 536870912, down: 1610612736 },
    ],
  },
  {
    id: "uuid-003",
    email: "user_beta",
    enable: true,
    totalGB: 32212254720,
    usedGB: 5368709120,
    expiryTime: 1751328000000,
    inboundIds: [2, 5],
    usagePerInbound: [
      { inboundId: 2, up: 1073741824, down: 2147483648 },
      { inboundId: 5, up: 536870912, down: 1610612736 },
    ],
  },
  {
    id: "uuid-004",
    email: "user_gamma",
    enable: false,
    totalGB: 5368709120,
    usedGB: 5368709120,
    expiryTime: 1740960000000,
    inboundIds: [1],
    usagePerInbound: [
      { inboundId: 1, up: 1610612736, down: 3758096384 },
    ],
  },
  {
    id: "uuid-005",
    email: "user_delta",
    enable: true,
    totalGB: 107374182400,
    usedGB: 32212254720,
    expiryTime: 0,
    inboundIds: [1, 2, 3, 5],
    usagePerInbound: [
      { inboundId: 1, up: 4294967296, down: 10737418240 },
      { inboundId: 2, up: 2147483648, down: 6442450944 },
      { inboundId: 3, up: 1073741824, down: 3221225472 },
      { inboundId: 5, up: 1073741824, down: 3221225472 },
    ],
  },
  {
    id: "uuid-006",
    email: "user_epsilon",
    enable: true,
    totalGB: 21474836480,
    usedGB: 15032385536,
    expiryTime: 1753920000000,
    inboundIds: [5],
    usagePerInbound: [
      { inboundId: 5, up: 4294967296, down: 10737418240 },
    ],
  },
  {
    id: "uuid-007",
    email: "user_zeta",
    enable: false,
    totalGB: 10737418240,
    usedGB: 2147483648,
    expiryTime: 1738281600000,
    inboundIds: [3, 4],
    usagePerInbound: [
      { inboundId: 3, up: 268435456, down: 1073741824 },
      { inboundId: 4, up: 268435456, down: 536870912 },
    ],
  },
  {
    id: "uuid-008",
    email: "user_theta",
    enable: true,
    totalGB: 53687091200,
    usedGB: 10737418240,
    expiryTime: 1756512000000,
    inboundIds: [1, 5],
    usagePerInbound: [
      { inboundId: 1, up: 2147483648, down: 5368709120 },
      { inboundId: 5, up: 1073741824, down: 2147483648 },
    ],
  },
]

export const mockSettings: Settings = {
  checkIntervalSeconds: 60,
  panelUrl: "https://panel.example.com",
  username: "admin",
  password: "admin123",
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}

export function getUsagePercent(used: number, total: number): number {
  if (total === 0) return 0
  return Math.min(100, Math.round((used / total) * 100))
}

export function getRemainingBytes(total: number, used: number): number {
  return Math.max(0, total - used)
}

export function getUsageBarColor(percent: number): string {
  if (percent > 90) return "oklch(0.55 0.22 25)"
  if (percent > 70) return "oklch(0.75 0.15 70)"
  return "oklch(0.65 0.2 295)"
}

export function formatDate(timestamp: number): string {
  if (timestamp === 0) return "Never"
  return new Date(timestamp).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function getInboundById(id: number): Inbound | undefined {
  return mockInbounds.find((i) => i.id === id)
}
