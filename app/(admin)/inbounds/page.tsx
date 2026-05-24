"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { RefreshCw, CheckCircle2, XCircle, Shield, ArrowRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatBytes } from "@/lib/data"
import { fetchInbounds, normalizeInboundRows, syncInbounds } from "@/lib/api"
import { MigrationDialog } from "@/components/migration-dialog"

export default function InboundsPage() {
  const [inbounds, setInbounds] = useState<any[]>([])
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncStatus, setSyncStatus] = useState<Record<number, "ok" | "error">>({})
  const [error, setError] = useState<string | null>(null)
  const [migrationOpen, setMigrationOpen] = useState(false)
  const [selectedInbound, setSelectedInbound] = useState<any>(null)
  const [, startTransition] = useTransition()

  const loadInbounds = useCallback(async () => {
    try {
      const rows = await fetchInbounds()
      setInbounds(rows)
      return rows
    } catch (err) {
      setError((err as Error).message)
      return []
    }
  }, [])

  useEffect(() => {
    loadInbounds()
  }, [loadInbounds])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setError(null)

    try {
      const result = await syncInbounds()
      startTransition(() => {
        if (result.inbounds?.length) {
          setInbounds(normalizeInboundRows(result.inbounds))
        }
        if (result.inboundSyncStatus) {
          setSyncStatus(result.inboundSyncStatus)
        }
        setLastSync(new Date().toLocaleTimeString())
      })
    } catch (err) {
      setError((err as Error).message)
      setSyncStatus((prev) => {
        const failedStatus: Record<number, "ok" | "error"> = { ...prev }
        inbounds.forEach((inbound) => {
          failedStatus[inbound.id] = "error"
        })
        return failedStatus
      })
    } finally {
      setSyncing(false)
    }
  }, [inbounds, startTransition])

  const protocolColors: Record<string, string> = {
    vless: "bg-primary/15 text-primary",
    vmess: "bg-chart-2/15 text-chart-2",
    trojan: "bg-warning/15 text-warning",
    shadowsocks: "bg-chart-5/15 text-chart-5",
  }

  return (
    <div className="flex flex-col gap-6 pt-10 lg:pt-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inbounds</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your inbound connections
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSync && (
            <span className="text-xs text-muted-foreground">
              Last synced: {lastSync}
            </span>
          )}
          <Button
            onClick={handleSync}
            disabled={syncing}
            className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <RefreshCw
              className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing ? "Syncing..." : "Sync Status"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {inbounds.filter((i) => i.enable).length}
              </p>
              <p className="text-xs text-muted-foreground">Active Inbounds</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-destructive/10 p-2.5">
              <XCircle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {inbounds.filter((i) => !i.enable).length}
              </p>
              <p className="text-xs text-muted-foreground">Disabled Inbounds</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="rounded-lg bg-chart-2/10 p-2.5">
              <CheckCircle2 className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground">
                {inbounds.reduce((acc, i) => acc + i.clientCount, 0)}
              </p>
              <p className="text-xs text-muted-foreground">Total Client Slots</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base font-semibold text-card-foreground">
            All Inbounds
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Remark</TableHead>
                  <TableHead className="text-muted-foreground">Tag</TableHead>
                  <TableHead className="text-muted-foreground">Protocol</TableHead>
                  <TableHead className="text-muted-foreground">Port</TableHead>
                  <TableHead className="text-muted-foreground">Network</TableHead>
                  <TableHead className="text-muted-foreground">TLS</TableHead>
                  <TableHead className="text-muted-foreground">Clients</TableHead>
                  <TableHead className="text-muted-foreground">Traffic</TableHead>
                  <TableHead className="text-muted-foreground">All-time Traffic</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Sync</TableHead>
                  <TableHead className="text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbounds.map((inbound) => (
                  <TableRow
                    key={inbound.id}
                    className="border-border hover:bg-secondary/30"
                  >
                    <TableCell className="font-medium text-card-foreground">
                      {inbound.remark}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inbound.tag || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          protocolColors[inbound.protocol] || "bg-secondary"
                        }
                      >
                        {inbound.protocol.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {inbound.port}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inbound.network}
                    </TableCell>
                    <TableCell>
                      {inbound.tls ? (
                        <span className="text-primary">Enabled</span>
                      ) : (
                        <span className="text-muted-foreground">Off</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {inbound.clientCount}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-xs text-primary">
                          {"Up: " + formatBytes(inbound.up || 0)}
                        </span>
                        <span className="text-xs text-chart-2">
                          {"Dn: " + formatBytes(inbound.down || 0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {formatBytes(inbound.allTime || (Number(inbound.up) || 0) + (Number(inbound.down) || 0))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={inbound.enable ? "default" : "secondary"}
                        className={
                          inbound.enable
                            ? "bg-primary/15 text-primary hover:bg-primary/15"
                            : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                        }
                      >
                        {inbound.enable ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {syncStatus[inbound.id] === "ok" && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                      {syncStatus[inbound.id] === "error" && (
                        <XCircle className="h-4 w-4 text-destructive" />
                      )}
                      {!syncStatus[inbound.id] && (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedInbound(inbound)
                          setMigrationOpen(true)
                        }}
                        className="gap-1"
                      >
                        <ArrowRight className="h-4 w-4" />
                        Migrate
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedInbound && (
        <MigrationDialog
          sourceInbound={selectedInbound}
          allInbounds={inbounds}
          isOpen={migrationOpen}
          onClose={() => {
            setMigrationOpen(false)
            setSelectedInbound(null)
          }}
          onSuccess={() => {
            loadInbounds()
          }}
        />
      )}
    </div>
  )
}
