"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";
import {
  Settings,
  Copy,
  Check,
  Download,
  Upload,
  Clock,
  Shield,
  Server,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InboundConfig {
  name: string;
  url: string;
  downloaded: string;
  uploaded: string;
  usage: string;
}

interface Inbound {
  name: string;
  type: string;
  totalDownloaded: string;
  totalUploaded: string;
  totalUsage: string;
  configs: InboundConfig[];
}

interface SubscriptionData {
  id: string;
  status: "active" | "inactive" | "expired";
  downloaded: string;
  uploaded: string;
  usage: string;
  totalQuota: string;
  remained: string;
  lastOnline: string;
  expiry: string;
  inbounds: Inbound[];
}

const mockData: SubscriptionData = {
  id: "1yimnd1ltk3q3lx0",
  status: "active",
  downloaded: "176.07MB",
  uploaded: "22.82MB",
  usage: "198.89MB",
  totalQuota: "1.00GB",
  remained: "825.11MB",
  lastOnline: "5/18/2026, 4:42:25 PM",
  expiry: "No expiry",
  inbounds: [
    {
      name: "VLESS-WS",
      type: "vless",
      totalDownloaded: "98.45MB",
      totalUploaded: "12.32MB",
      totalUsage: "110.77MB",
      configs: [
        {
          name: "Vip-n126g60b-Snapp",
          url: "vless://84ac22fb-ac95-4a6b-86b3-2e8ed14bd38a@Snapp.ir:80?encryption=none&host=container.kernelpanicisme.ir&path=%2F&security=none&type=ws#Vip-n126g60b-825.11MB%F0%9F%93%8A",
          downloaded: "54.23MB",
          uploaded: "7.12MB",
          usage: "61.35MB",
        },
        {
          name: "Vip-n126g60b-RyanCloud",
          url: "vless://84ac22fb-ac95-4a6b-86b3-2e8ed14bd38a@ryancloud.ir:80?encryption=none&host=container.kernelpanicisme.ir&path=%2F&security=none&type=ws#Vip-n126g60b-825.11MB",
          downloaded: "44.22MB",
          uploaded: "5.20MB",
          usage: "49.42MB",
        },
      ],
    },
    {
      name: "VMess-TCP",
      type: "vmess",
      totalDownloaded: "52.12MB",
      totalUploaded: "6.80MB",
      totalUsage: "58.92MB",
      configs: [
        {
          name: "Vip-vmess-IR-1",
          url: "vmess://eyJhZGQiOiJpcjEuZXhhbXBsZS5jb20iLCJhaWQiOiIwIiwiaG9zdCI6IiIsImlkIjoiODRhYzIyZmItYWM5NS00YTZiLTg2YjMtMmU4ZWQxNGJkMzhhIiwibmV0IjoidGNwIiwicGF0aCI6IiIsInBvcnQiOiI0NDMiLCJwcyI6IlZpcC12bWVzcy1JUi0xIiwic2N5IjoiYXV0byIsInNuaSI6IiIsInRscyI6InRscyIsInR5cGUiOiIiLCJ2IjoiMiJ9",
          downloaded: "32.10MB",
          uploaded: "4.30MB",
          usage: "36.40MB",
        },
        {
          name: "Vip-vmess-IR-2",
          url: "vmess://eyJhZGQiOiJpcjIuZXhhbXBsZS5jb20iLCJhaWQiOiIwIiwiaG9zdCI6IiIsImlkIjoiODRhYzIyZmItYWM5NS00YTZiLTg2YjMtMmU4ZWQxNGJkMzhhIiwibmV0IjoidGNwIiwicGF0aCI6IiIsInBvcnQiOiI0NDMiLCJwcyI6IlZpcC12bWVzcy1JUi0yIiwic2N5IjoiYXV0byIsInNuaSI6IiIsInRscyI6InRscyIsInR5cGUiOiIiLCJ2IjoiMiJ9",
          downloaded: "20.02MB",
          uploaded: "2.50MB",
          usage: "22.52MB",
        },
      ],
    },
    {
      name: "Trojan-WS",
      type: "trojan",
      totalDownloaded: "25.50MB",
      totalUploaded: "3.70MB",
      totalUsage: "29.20MB",
      configs: [
        {
          name: "Vip-trojan-DE",
          url: "trojan://84ac22fb-ac95-4a6b-86b3-2e8ed14bd38a@de.example.com:443?security=tls&type=ws&path=%2F#Vip-trojan-DE",
          downloaded: "25.50MB",
          uploaded: "3.70MB",
          usage: "29.20MB",
        },
      ],
    },
  ],
};

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
  const percentage = Math.min((used / total) * 100, 100);

  return (
    <div className="relative h-3 overflow-hidden rounded-full bg-secondary">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
        className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary to-primary/70"
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  delay = 0,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-xl border border-border/50 bg-card/50 p-4 backdrop-blur-sm"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="font-mono text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
    </motion.div>
  );
}

// Simple config link card for the Config Links section
function ConfigLinkCard({ config, showQR }: { config: InboundConfig; showQR: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-background/50 p-3">
      {showQR && (
        <div className="shrink-0 rounded-lg bg-white p-2">
          <QRCodeSVG value={config.url} size={64} level="M" />
        </div>
      )}
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
  );
}

// Inbound group for Config Links section - simple visual separation
function InboundConfigGroup({ inbound, showQR }: { inbound: Inbound; showQR: boolean }) {
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
          <ConfigLinkCard key={index} config={config} showQR={showQR} />
        ))}
      </div>
    </div>
  );
}

// Inbound usage card for the Data Usage section - with detailed stats
function InboundUsageCard({ inbound, index, totalQuota }: { inbound: Inbound; index: number; totalQuota: number }) {
  const [expanded, setExpanded] = useState(false);
  const usageValue = parseFloat(inbound.totalUsage);
  const percentage = ((usageValue / totalQuota) * 100).toFixed(1);

  const typeColors: Record<string, string> = {
    vless: "from-emerald-500 to-emerald-600",
    vmess: "from-blue-500 to-blue-600",
    trojan: "from-orange-500 to-orange-600",
    shadowsocks: "from-violet-500 to-violet-600",
  };

  const typeBadgeColors: Record<string, string> = {
    vless: "bg-emerald-500/10 text-emerald-500",
    vmess: "bg-blue-500/10 text-blue-500",
    trojan: "bg-orange-500/10 text-orange-500",
    shadowsocks: "bg-violet-500/10 text-violet-500",
  };

  const barColor = typeColors[inbound.type] || "from-primary to-primary/70";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 * index }}
      className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-secondary/20"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
            <Server className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground">{inbound.name}</h3>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium uppercase", typeBadgeColors[inbound.type] || "bg-secondary text-muted-foreground")}>
                {inbound.type}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" />
                {inbound.totalDownloaded}
              </span>
              <span className="flex items-center gap-1">
                <Upload className="h-3 w-3" />
                {inbound.totalUploaded}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-mono text-lg font-semibold text-foreground">{inbound.totalUsage}</p>
            <p className="text-xs text-muted-foreground">{percentage}% of total</p>
          </div>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary/50">
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </button>

      {/* Mini usage bar */}
      <div className="px-4 pb-4">
        <div className="relative h-2 overflow-hidden rounded-full bg-secondary/50">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", barColor)}
          />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/50 p-4">
              <h4 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Usage per Config</h4>
              <div className="space-y-3">
                {inbound.configs.map((config, configIndex) => {
                  const configUsage = parseFloat(config.usage);
                  const configPercentage = ((configUsage / usageValue) * 100).toFixed(1);
                  return (
                    <div key={configIndex} className="rounded-lg bg-background/50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">{config.name}</span>
                        <span className="font-mono text-sm text-primary">{config.usage}</span>
                      </div>
                      <div className="mb-2 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Download className="h-3 w-3" />
                          {config.downloaded}
                        </span>
                        <span className="flex items-center gap-1">
                          <Upload className="h-3 w-3" />
                          {config.uploaded}
                        </span>
                        <span className="ml-auto">{configPercentage}% of inbound</span>
                      </div>
                      <div className="relative h-1.5 overflow-hidden rounded-full bg-secondary/50">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${configPercentage}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={cn("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", barColor)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function SubscriptionInfo() {
  const [activeTab, setActiveTab] = useState<"subscription" | "clash">("subscription");
  const totalQuotaValue = 1000; // 1GB in MB
  const usageValue = 198.89;
  const percentage = ((usageValue / totalQuotaValue) * 100).toFixed(1);

  const tabs = [
    { id: "subscription" as const, label: "Subscription" },
    { id: "clash" as const, label: "Clash / Mihomo" },
  ];

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-4xl"
      >
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Subscription Info</h1>
            <p className="font-mono text-sm text-muted-foreground">{mockData.id}</p>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg border border-border/50 bg-card/50 transition-colors hover:bg-secondary">
            <Settings className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Tabs */}
        <div className="mb-8 flex items-center justify-center">
          <div className="inline-flex rounded-xl border border-border/50 bg-card/30 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative rounded-lg px-6 py-2.5 text-sm font-medium transition-all duration-300",
                  activeTab === tab.id ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-lg bg-primary"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* QR Codes */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mb-8 flex flex-wrap items-center justify-center gap-6"
        >
          <div className="text-center">
            <div className="mb-2 rounded-2xl bg-white p-4">
              <QRCodeSVG value={mockData.inbounds.flatMap((i) => i.configs).map((c) => c.url).join("\n")} size={150} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">Subscription</p>
          </div>
          <div className="text-center">
            <div className="mb-2 rounded-2xl bg-white p-4">
              <QRCodeSVG value={`clash://install-config?url=${encodeURIComponent(mockData.id)}`} size={150} level="M" />
            </div>
            <p className="text-xs text-muted-foreground">Clash / Mihomo</p>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard icon={Download} label="Downloaded" value={mockData.downloaded} delay={0.2} />
          <StatCard icon={Upload} label="Uploaded" value={mockData.uploaded} delay={0.25} />
          <StatCard icon={Clock} label="Last Online" value={mockData.lastOnline.split(",")[0]} delay={0.3} />
          <StatCard icon={Shield} label="Expiry" value={mockData.expiry} delay={0.35} />
        </div>

        {/* Total Usage Progress */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mb-8 rounded-xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-foreground">Total Data Usage</h2>
            <div className="flex items-center gap-2">
              <span className="font-mono text-2xl font-bold text-foreground">{mockData.usage}</span>
              <span className="text-muted-foreground">/ {mockData.totalQuota}</span>
            </div>
          </div>
          <UsageBar used={usageValue} total={totalQuotaValue} />
          <div className="mt-4 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-medium capitalize text-primary">{mockData.status}</span>
            </div>
            <span className="text-muted-foreground">{percentage}% used | {mockData.remained} remaining</span>
          </div>
        </motion.div>

        {/* Data Usage by Inbound - DETAILED BREAKDOWN */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.45 }}
          className="mb-8"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Data Usage by Inbound</h2>
            <span className="text-sm text-muted-foreground">{mockData.inbounds.length} inbounds</span>
          </div>
          <div className="space-y-3">
            {mockData.inbounds.map((inbound, index) => (
              <InboundUsageCard key={index} inbound={inbound} index={index} totalQuota={totalQuotaValue} />
            ))}
          </div>
        </motion.div>

        {/* Config Links - SIMPLE SEPARATION BY INBOUND */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          className="mb-8"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Config Links</h2>
            <span className="text-sm text-muted-foreground">{mockData.inbounds.reduce((acc, i) => acc + i.configs.length, 0)} configs</span>
          </div>
          <div className="space-y-4">
            {mockData.inbounds.map((inbound, index) => (
              <InboundConfigGroup key={index} inbound={inbound} showQR={activeTab === "subscription"} />
            ))}
          </div>
        </motion.div>

        {/* Details Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.55 }}
          className="overflow-hidden rounded-xl border border-border/50 bg-card/50 backdrop-blur-sm"
        >
          <div className="border-b border-border/50 px-4 py-3">
            <h2 className="text-sm font-medium text-foreground">Subscription Details</h2>
          </div>
          <div className="divide-y divide-border/50">
            {[
              { label: "Subscription ID", value: mockData.id },
              { label: "Status", value: mockData.status, isStatus: true },
              { label: "Downloaded", value: mockData.downloaded },
              { label: "Uploaded", value: mockData.uploaded },
              { label: "Usage", value: mockData.usage },
              { label: "Total Quota", value: mockData.totalQuota },
              { label: "Remained", value: mockData.remained },
              { label: "Last Online", value: mockData.lastOnline },
              { label: "Expiry", value: mockData.expiry },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">{item.label}</span>
                {item.isStatus ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {item.value}
                  </span>
                ) : (
                  <span className="font-mono text-sm text-foreground">{item.value}</span>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
