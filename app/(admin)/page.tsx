"use client"

import { useEffect, useState } from "react"
import {
  Server,
  Users,
  ArrowUpDown,
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatBytes, getUsagePercent } from "@/lib/data"
import { fetchClients, fetchInbounds, syncInbounds } from "@/lib/api"
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"

function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string
  value: string | number
  subtitle: string
  icon: React.ComponentType<{ className?: string }>
  trend?: "up" | "down"
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">{title}</span>
            <span className="text-2xl font-bold text-card-foreground">
              {value}
            </span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {trend === "up" && (
                <TrendingUp className="h-3 w-3 text-primary" />
              )}
              {trend === "down" && (
                <TrendingDown className="h-3 w-3 text-destructive" />
              )}
              {subtitle}
            </span>
          </div>
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [inbounds, setInbounds] = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [inboundRows, clientRows] = await Promise.all([
        fetchInbounds(),
        fetchClients(),
      ])
      setInbounds(inboundRows)
      setClients(clientRows)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncInbounds()
      await loadData()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSyncing(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
        Loading dashboard data...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-destructive">
        {error}
      </div>
    )
  }

  const totalInbounds = inbounds.length
  const activeInbounds = inbounds.filter((i) => i.enable).length
  const totalClients = clients.length
  const activeClients = clients.filter((c) => c.enable).length

  const totalUpload = inbounds.reduce((acc, i) => acc + (i.up || 0), 0)
  const totalDownload = inbounds.reduce((acc, i) => acc + (i.down || 0), 0)

  const trafficData = inbounds.map((i) => ({
    name: i.remark.length > 14 ? `${i.remark.substring(0, 14)}...` : i.remark,
    upload: Number(((i.up || 0) / 1073741824).toFixed(1)),
    download: Number(((i.down || 0) / 1073741824).toFixed(1)),
  }))

  const topClients = [...clients]
    .sort((a, b) => b.usedGB - a.usedGB)
    .slice(0, 5)

  return (
    <div className="flex flex-col gap-6 pt-10 lg:pt-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your 3X-UI panel
          </p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || loading}
          variant="outline"
          className="gap-2 border-border text-foreground hover:bg-secondary"
        >
          <RefreshCw
            className={cn("h-4 w-4", syncing && "animate-spin")}
          />
          {syncing ? "Refreshing..." : "Refresh Traffic"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Inbounds"
          value={totalInbounds}
          subtitle={`${activeInbounds} active`}
          icon={Server}
          trend="up"
        />
        <StatsCard
          title="Total Clients"
          value={totalClients}
          subtitle={`${activeClients} active`}
          icon={Users}
          trend="up"
        />
        <StatsCard
          title="Total Upload"
          value={formatBytes(totalUpload)}
          subtitle="Across all inbounds"
          icon={ArrowUpDown}
        />
        <StatsCard
          title="Total Download"
          value={formatBytes(totalDownload)}
          subtitle="Across all inbounds"
          icon={Activity}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Traffic by Inbound
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Upload and download in GB
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trafficData} barGap={2}>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "oklch(0.6 0 0)" }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "oklch(0.17 0.005 260)",
                      border: "1px solid oklch(0.26 0.005 260)",
                      borderRadius: "8px",
                      color: "oklch(0.95 0 0)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value} GB`]}
                  />
                  <Bar
                    dataKey="upload"
                    fill="oklch(0.65 0.2 295)"
                    radius={[4, 4, 0, 0]}
                    name="Upload"
                  />
                  <Bar
                    dataKey="download"
                    fill="oklch(0.6 0.15 250)"
                    radius={[4, 4, 0, 0]}
                    name="Download"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Top Clients by Usage
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Highest data consumption
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-col gap-4">
              {topClients.map((client) => {
                const percent = getUsagePercent(client.usedGB, client.totalGB)
                return (
                  <div key={client.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-card-foreground">
                          {client.email}
                        </span>
                        <Badge
                          variant={client.enable ? "default" : "secondary"}
                          className={
                            client.enable
                              ? "bg-primary/15 text-primary hover:bg-primary/15"
                              : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                          }
                        >
                          {client.enable ? "Active" : "Disabled"}
                        </Badge>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatBytes(client.usedGB)} / {formatBytes(client.totalGB)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${percent}%`,
                          backgroundColor:
                            percent > 90
                              ? "oklch(0.55 0.22 25)"
                              : percent > 70
                              ? "oklch(0.75 0.15 70)"
                              : "oklch(0.65 0.2 295)",
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-card-foreground">
            Inbound Status
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Quick overview of all inbound connections
          </p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {inbounds.map((inbound) => (
              <div
                key={inbound.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3"
              >
                <div
                  className={`h-2 w-2 rounded-full ${
                    inbound.enable ? "bg-primary" : "bg-destructive"
                  }`}
                />
                <div className="flex-1 truncate">
                  <p className="truncate text-sm font-medium text-card-foreground">
                    {inbound.remark}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {inbound.protocol.toUpperCase()} :{inbound.port} &middot; {inbound.clientCount} clients
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-border text-muted-foreground"
                >
                  {formatBytes((inbound.up || 0) + (inbound.down || 0))}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
