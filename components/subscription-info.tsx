"use client"

import { memo, useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { QRCodeSVG } from "qrcode.react"
import {
  Copy,
  Check,
  Download,
  Upload,
  Clock,
  Shield,
  Server,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { formatDateTime, formatTrafficCompact } from "@/lib/subscription-format"
import { getUsageBarColor, getUsagePercent } from "@/lib/data"
import type { SubscriptionPayload } from "@/lib/subscription"
import type { GeneratedConfigMeta } from "@/lib/panel-link"

interface InboundConfig {
  name: string
  url: string
  downloaded: string
  uploaded: string
  usage: string
  usageBytes: number
  meta?: GeneratedConfigMeta
}

interface Inbound {
  name: string
  type: string
  totalDownloaded: string
  totalUploaded: string
  totalUsage: string
  totalUsageBytes: number
  configs: InboundConfig[]
}

interface SubscriptionData {
  id: string
  status: "active" | "inactive"
  downloaded: string
  uploaded: string
  usage: string
  usageBytes: number
  totalQuota: string
  totalQuotaBytes: number
  remained: string
  lastOnline: string
  expiry: string
  subscriptionUrl: string
  clashSubscriptionUrl: string
  inbounds: Inbound[]
}

function mapPayload(data: SubscriptionPayload): SubscriptionData {
  const unlimited = data.totalQuota <= 0
  return {
    id: data.subId,
    status: data.status === "active" ? "active" : "inactive",
    downloaded: formatTrafficCompact(data.downloaded),
    uploaded: formatTrafficCompact(data.uploaded),
    usage: formatTrafficCompact(data.usage),
    usageBytes: data.usage,
    totalQuota: unlimited ? "Unlimited" : formatTrafficCompact(data.totalQuota),
    totalQuotaBytes: unlimited ? 0 : data.totalQuota,
    remained: unlimited ? "Unlimited" : formatTrafficCompact(data.remained),
    lastOnline: data.lastOnline ? formatDateTime(data.lastOnline) : "—",
    expiry: data.expiryTime ? formatDateTime(data.expiryTime) : "No expiry",
    subscriptionUrl: data.subscriptionUrl,
    clashSubscriptionUrl: data.clashSubscriptionUrl,
    inbounds: data.inbounds.map((inbound) => ({
      name: inbound.name,
      type: inbound.type,
      totalDownloaded: formatTrafficCompact(inbound.totalDownloaded),
      totalUploaded: formatTrafficCompact(inbound.totalUploaded),
      totalUsage: formatTrafficCompact(inbound.totalUsage),
      totalUsageBytes: inbound.totalUsage,
      configs: inbound.configs.map((config) => ({
        name: config.name,
        url: config.url,
        downloaded: formatTrafficCompact(config.downloaded),
        uploaded: formatTrafficCompact(config.uploaded),
        usage: formatTrafficCompact(config.usage),
        usageBytes: config.usage,
        meta: config.meta,
      })),
    })),
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary/50 text-muted-foreground transition-all hover:bg-secondary hover:text-foreground"
    >
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.span
            key="check"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Check className="h-4 w-4 text-primary" />
          </motion.span>
        ) : (
          <motion.span
            key="copy"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Copy className="h-4 w-4" />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

function UsageBar({ used, total }: { used: number; total: number }) {
  const percent = getUsagePercent(used, total)

  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ backgroundColor: getUsageBarColor(percent) }}
      />
    </div>
  )
}

function MiniUsageBar({
  used,
  total,
  heightClass = "h-2",
}: {
  used: number
  total: number
  heightClass?: string
}) {
  const percent = getUsagePercent(used, total)
  return (
    <div className={cn("relative overflow-hidden rounded-full bg-secondary/50", heightClass)}>
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ backgroundColor: getUsageBarColor(percent) }}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: "active" | "inactive" }) {
  const isActive = status === "active"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        isActive
          ? "bg-success/15 text-success"
          : "bg-destructive/15 text-destructive"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          isActive ? "animate-pulse bg-success" : "bg-destructive"
        )}
      />
      {isActive ? "Active" : "Disabled"}
    </span>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  const isLastOnline = label === "Last Online"
  const isMono = !isLastOnline
  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn(
            "font-medium text-foreground truncate",
            isMono ? "font-mono text-sm" : "text-[11px] leading-tight"
          )}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function ConfigMetaBadges({ meta }: { meta: GeneratedConfigMeta }) {
  const items = [
    { label: "Protocol", value: meta.protocol },
    { label: "Server", value: meta.server },
    { label: "Port", value: String(meta.port) },
    { label: "Network", value: meta.network },
    { label: "Security", value: meta.security },
  ]
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item.label}
          className="rounded-md bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
          title={item.label}
        >
          {item.value}
        </span>
      ))}
    </div>
  )
}

// Simple config link card for the Config Links section
function ConfigLinkCard({ config }: { config: InboundConfig }) {
  return (
    <div className="rounded-lg bg-background/50 p-3">
      <div className="flex items-center gap-3">
      <div className="shrink-0 rounded-lg bg-white p-2">
        <QRCodeSVG value={config.url} size={64} level="M" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {config.name}
          </span>
        </div>
        <p className="truncate font-mono text-xs text-muted-foreground/70">{config.url}</p>
      </div>
      <CopyButton text={config.url} />
      </div>
      {config.meta ? <ConfigMetaBadges meta={config.meta} /> : null}
    </div>
  );
}

// Inbound group for Config Links section - simple visual separation
function InboundConfigGroup({ inbound }: { inbound: Inbound }) {
  const typeColors: Record<string, string> = {
    vless: "border-l-emerald-500",
    vmess: "border-l-blue-500",
    trojan: "border-l-orange-500",
    shadowsocks: "border-l-violet-500",
  };

  const typeBadgeColors: Record<string, string> = {
    vless: "bg-emerald-500/10 text-emerald-500",
    vmess: "bg-blue-500/10 text-blue-500",
    trojan: "bg-orange-500/10 text-orange-500",
    shadowsocks: "bg-violet-500/10 text-violet-500",
  };

  return (
    <div className={cn("overflow-hidden rounded-xl border border-border/50 border-l-4 bg-card/30", typeColors[inbound.type] || "border-l-primary")}>
      <div className="flex items-center gap-3 border-b border-border/30 px-4 py-3">
        <Server className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-foreground">{inbound.name}</span>
        <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium uppercase", typeBadgeColors[inbound.type] || "bg-secondary text-muted-foreground")}>
          {inbound.type}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{inbound.configs.length} config{inbound.configs.length > 1 ? "s" : ""}</span>
      </div>
      <div className="space-y-2 p-3">
        {inbound.configs.map((config, index) => (
          <ConfigLinkCard key={index} config={config} />
        ))}
      </div>
    </div>
  );
}

const inboundTypeBadgeColors: Record<string, string> = {
  vless: "bg-emerald-500/10 text-emerald-500",
  vmess: "bg-blue-500/10 text-blue-500",
  trojan: "bg-orange-500/10 text-orange-500",
  shadowsocks: "bg-violet-500/10 text-violet-500",
}

function InboundUsageDetailRow({
  inbound,
  totalUsage,
}: {
  inbound: Inbound
  totalQuota: number
  totalUsage: number
}) {
  const usageValue = inbound.totalUsageBytes
  const percentOfTotal =
    totalUsage > 0 ? ((usageValue / totalUsage) * 100).toFixed(1) : "0"

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm text-muted-foreground">{inbound.name}</span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
            inboundTypeBadgeColors[inbound.type] || "bg-secondary text-muted-foreground"
          )}
        >
          {inbound.type}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <span className="font-mono text-sm text-foreground">{inbound.totalUsage}</span>
        <span className="text-xs text-muted-foreground">({percentOfTotal}%)</span>
      </div>
    </div>
  )
}


const SubscriptionInfoContent = memo(function SubscriptionInfoContent({
  data,
}: {
  data: SubscriptionData
}) {
  const [copiedAll, setCopiedAll] = useState(false)
  const totalQuotaValue = data.totalQuotaBytes
  const usageValue = data.usageBytes
  const usagePercent = getUsagePercent(usageValue, totalQuotaValue)
  const percentage = usagePercent.toFixed(1)

  const subscriptionQr =
    data.subscriptionUrl ||
    data.inbounds.flatMap((i) => i.configs).map((c) => c.url).join("\n")

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscription Info</h1>
            <p className="font-mono text-sm text-muted-foreground">{data.id}</p>
          </div>
          <ThemeToggle />
        </div>

        {/* Subscription QR */}
        <div className="mb-8 flex justify-center">
          <div className="text-center">
            <div className="mb-2 rounded-2xl bg-white p-4">
              <QRCodeSVG value={subscriptionQr} size={150} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">Subscription</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Download} label="Downloaded" value={data.downloaded} />
          <StatCard icon={Upload} label="Uploaded" value={data.uploaded} />
          <StatCard icon={Clock} label="Last Online" value={data.lastOnline} />
          <StatCard icon={Shield} label="Expiry" value={data.expiry} />
        </div>

        {/* Total Usage Progress */}
        <div className="mb-8 rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Total Data Usage</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">{data.usage}</span>
              <span className="text-muted-foreground">/ {data.totalQuota}</span>
            </div>
          </div>
          <UsageBar used={usageValue} total={totalQuotaValue} />
          <div className="mt-4 flex items-center justify-between text-sm">
            <StatusBadge status={data.status} />
            <span className="text-muted-foreground">{percentage}% used | {data.remained} remaining</span>
          </div>

          {data.inbounds.length > 0 && (
            <div className="mt-6 border-t border-border/50 pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                By Inbound
              </p>
              <div className="overflow-hidden rounded-lg border border-border/50 divide-y divide-border/50">
                {data.inbounds.map((inbound, index) => (
                  <InboundUsageDetailRow
                    key={index}
                    inbound={inbound}
                    totalQuota={totalQuotaValue}
                    totalUsage={usageValue}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Config Links */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">Config Links</h2>
              <span className="text-sm text-muted-foreground">
                {data.inbounds.reduce((acc, i) => acc + i.configs.length, 0)} configs
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-8 gap-2 transition-all",
                copiedAll
                  ? "bg-success/20 text-success hover:bg-success/30 hover:text-success border-success/50"
                  : "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary border-primary/30"
              )}
              onClick={() => {
                const allConfigs = data.inbounds
                  .flatMap((i) => i.configs)
                  .map((c) => c.url)
                  .join("\n")
                navigator.clipboard.writeText(allConfigs)
                setCopiedAll(true)
                setTimeout(() => setCopiedAll(false), 2000)
              }}
            >
              {copiedAll ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy All
                </>
              )}
            </Button>
          </div>
          <div className="space-y-4">
            {data.inbounds.map((inbound, index) => (
              <InboundConfigGroup key={index} inbound={inbound} />
            ))}
          </div>
        </div>

        {/* Details Table */}
        <div className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="border-b border-border/50 px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">Subscription Details</h2>
          </div>
          <div className="divide-y divide-border/50">
            {[
              { label: "Subscription ID", value: data.id },
              { label: "Status", value: data.status, isStatus: true },
              { label: "Downloaded", value: data.downloaded },
              { label: "Uploaded", value: data.uploaded },
              { label: "Usage", value: data.usage },
              { label: "Total Quota", value: data.totalQuota },
              { label: "Remained", value: data.remained },
              { label: "Last Online", value: data.lastOnline },
              { label: "Expiry", value: data.expiry },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                {item.isStatus ? (
                  <StatusBadge status={data.status} />
                ) : (
                  <span className={cn("text-sm text-foreground", item.label !== "Last Online" && "font-mono")}>{item.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

export function SubscriptionInfo({ subId }: { subId: string }) {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadedForSubId = useRef<string | null>(null)
  const fetchInFlight = useRef(false)

  useEffect(() => {
    if (loadedForSubId.current === subId) return
    if (fetchInFlight.current) return
    fetchInFlight.current = true

    let cancelled = false
    const showSpinner = loadedForSubId.current !== subId

    async function load() {
      if (showSpinner) {
        setLoading(true)
        setError(null)
      }
      try {
        const res = await fetch(`/api/sub/${encodeURIComponent(subId)}`, {
          cache: "no-store",
          headers: {
            "Accept": "application/json",
          },
        })
        if (!res.ok) {
          const payload = await res.json().catch(() => null)
          throw new Error(payload?.error || "Subscription not found")
        }
        const json = (await res.json()) as SubscriptionPayload
        if (!cancelled) {
          setData(mapPayload(json))
          loadedForSubId.current = subId
        }
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        fetchInFlight.current = false
        if (!cancelled && showSpinner) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
      fetchInFlight.current = false
    }
  }, [subId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-muted-foreground">
        Loading subscription…
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <p className="text-destructive">{error || "Subscription not found"}</p>
      </div>
    )
  }

  return <SubscriptionInfoContent data={data} />
}
