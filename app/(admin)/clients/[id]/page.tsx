"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, ExternalLink, Pencil } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatBytes, formatDate, getUsagePercent } from "@/lib/data"
import { fetchClientDetail, disableClient, updateClient, fetchInbounds, migrateClient } from "@/lib/api"
import type { ClientSummary } from "@/lib/api"
import type { ClientSummary, InboundSummary } from "@/lib/api"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts"

export default function ClientDetailPage(_props: any) {
  const params = useParams() as { id?: string }
  const [client, setClient] = useState<ClientSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [migrateDialogOpen, setMigrateDialogOpen] = useState(false)
  const [inbounds, setInbounds] = useState<InboundSummary[]>([])
  const [selectedTargetInboundId, setSelectedTargetInboundId] = useState<string>("")
  const [editName, setEditName] = useState("")
  const [migrateError, setMigrateError] = useState<string | null>(null)
  const [editQuota, setEditQuota] = useState("")
  const [editQuotaUnit, setEditQuotaUnit] = useState("GB")

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        const id = params?.id
        if (!id) throw new Error("missing client id")
        const [detail, inboundsData] = await Promise.all([
          fetchClientDetail(id),
          fetchInbounds(),
        ])
        setClient(detail)
        setInbounds(inboundsData)
        setEditName(detail.email)
        
        // Initial quota display
        if (detail.totalGB >= 1024 * 1024 * 1024) {
          setEditQuota((detail.totalGB / (1024 * 1024 * 1024)).toString())
          setEditQuotaUnit("GB")
        } else {
          setEditQuota((detail.totalGB / (1024 * 1024)).toString())
          setEditQuotaUnit("MB")
        }
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [params.id])

  useEffect(() => {
    if (!migrateDialogOpen) return
    let mounted = true
    ;(async () => {
      try {
        const ibs = await fetchInbounds()
        if (!mounted) return
        setInbounds(ibs)
        // preselect first inbound that's not already linked
        if (client) {
          const linked = new Set(client.inboundIds.map(String))
          const candidate = ibs.find((i) => !linked.has(String(i.id)))
          if (candidate) setSelectedTargetInboundId(String(candidate.id))
        }
      } catch (err) {
        console.error("[ClientDetail] failed to load inbounds", err)
      }
    })()
    return () => {
      mounted = false
    }
  }, [migrateDialogOpen, client])

  const handleDisable = async () => {
    if (!client) return
    setActionLoading(true)
    try {
      await disableClient(client.id)
      const id = params?.id
      if (!id) throw new Error("missing client id")
      const detail = await fetchClientDetail(id)
      setClient(detail)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!client) return
    setActionLoading(true)
    try {
      let quotaBytes = parseFloat(editQuota)
      if (editQuotaUnit === "GB") quotaBytes *= 1024 * 1024 * 1024
      else if (editQuotaUnit === "MB") quotaBytes *= 1024 * 1024
      else if (editQuotaUnit === "TB") quotaBytes *= 1024 * 1024 * 1024 * 1024

      await updateClient(client.id, {
        name: editName,
        totalQuota: quotaBytes,
      })
      setEditDialogOpen(false)
      const id = params?.id
      if (!id) throw new Error("missing client id")
      const detail = await fetchClientDetail(id)
      setClient(detail)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 pt-10 lg:pt-0">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-sm text-destructive">{error}</p>
        <Link href="/clients">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-secondary"
          >
            Back to Clients
          </Button>
        </Link>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <h2 className="text-xl font-semibold text-foreground">Client not found</h2>
        <Link href="/clients">
          <Button
            variant="outline"
            className="border-border text-foreground hover:bg-secondary"
          >
            Back to Clients
          </Button>
        </Link>
      </div>
    )
  }

  const percent = getUsagePercent(client.usedGB, client.totalGB)

  const chartData = client.usagePerInbound.map((usage) => ({
    name: `Inbound #${usage.inboundId}`,
    upload: Number((usage.up / 1073741824).toFixed(2)),
    download: Number((usage.down / 1073741824).toFixed(2)),
  }))

  return (
    <div className="flex flex-col gap-6 pt-10 lg:pt-0">
      <div className="flex items-center justify-between">
        <Link href="/clients">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditDialogOpen(true)}
            className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
          >
            <Pencil className="h-4 w-4" />
            Edit Client
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMigrateDialogOpen(true)}
            className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
          >
            Migrate to Inbound
          </Button>
          <Link href={`/sub/${encodeURIComponent(client.uuid)}`} target="_blank">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 border-primary/20 text-primary hover:bg-primary/5 hover:text-primary"
            >
              <ExternalLink className="h-4 w-4" />
              Subscription Page
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDisable}
            disabled={!client.enable || actionLoading}
            className="gap-1.5 border-destructive/20 text-destructive hover:bg-destructive/5 hover:text-destructive"
          >
            {client.enable ? "Disable Client" : "Disabled"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">{client.email}</h1>
          <Badge
            className={
              client.enable
                ? "bg-primary/15 text-primary hover:bg-primary/15"
                : "bg-destructive/15 text-destructive hover:bg-destructive/15"
            }
          >
            {client.enable ? "Active" : "Disabled"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">ID: {client.id}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Quota</p>
            <p className="text-xl font-bold text-card-foreground">{formatBytes(client.totalGB)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Used</p>
            <p className="text-xl font-bold text-card-foreground">
              {formatBytes(client.usedGB)}
              <span className="ml-1.5 text-sm font-normal text-muted-foreground">({percent}%)</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Remaining</p>
            <p className="text-xl font-bold text-card-foreground">
              {formatBytes(Math.max(0, client.totalGB - client.usedGB))}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Expires</p>
            <p className="text-xl font-bold text-card-foreground">{formatDate(client.expiryTime)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between pb-3">
            <span className="text-sm text-muted-foreground">Overall Usage</span>
            <span className="font-mono text-sm text-card-foreground">
              {formatBytes(client.usedGB)} / {formatBytes(client.totalGB)}
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-secondary">
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
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Traffic per Inbound
            </CardTitle>
            <p className="text-xs text-muted-foreground">Upload and download in GB</p>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
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
                  <Bar dataKey="upload" fill="oklch(0.65 0.2 295)" radius={[4, 4, 0, 0]} name="Upload" />
                  <Bar dataKey="download" fill="oklch(0.6 0.15 250)" radius={[4, 4, 0, 0]} name="Download" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-card-foreground">
              Inbound Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">Inbound</TableHead>
                  <TableHead className="text-muted-foreground">Upload</TableHead>
                  <TableHead className="text-muted-foreground">Download</TableHead>
                  <TableHead className="text-muted-foreground">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {client.usagePerInbound.map((usage) => (
                  <TableRow key={usage.inboundId} className="border-border hover:bg-secondary/30">
                    <TableCell>Inbound #{usage.inboundId}</TableCell>
                    <TableCell>{formatBytes(usage.up)}</TableCell>
                    <TableCell>{formatBytes(usage.down)}</TableCell>
                    <TableCell>{formatBytes(usage.up + usage.down)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Client</DialogTitle>
            <DialogDescription>
              Update client details. Changes will be synced to all connected inbounds.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name / Email</Label>
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Client Name"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="quota">Total Quota</Label>
                <div className="flex gap-2">
                  <Input
                    id="quota"
                    type="number"
                    step="0.01"
                    value={editQuota}
                    onChange={(e) => setEditQuota(e.target.value)}
                    placeholder="Quota value"
                    className="flex-1"
                    required
                  />
                  <Select value={editQuotaUnit} onValueChange={setEditQuotaUnit}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MB">MB</SelectItem>
                      <SelectItem value="GB">GB</SelectItem>
                      <SelectItem value="TB">TB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={migrateDialogOpen} onOpenChange={setMigrateDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Migrate Client</DialogTitle>
            <DialogDescription>
              Add this client to another inbound. This will create a new link; it will not remove existing links.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="targetInbound">Target Inbound</Label>
              <Select
                value={selectedTargetInboundId}
                onValueChange={(val) => setSelectedTargetInboundId(val)}
              >
                <SelectTrigger id="targetInbound" className="w-full">
                  <SelectValue placeholder="Select an inbound..." />
                </SelectTrigger>
                <SelectContent>
                  {inbounds
                    .filter((ib) => !client?.inboundIds.includes(ib.id))
                    .map((ib) => (
                      <SelectItem key={ib.id} value={String(ib.id)}>
                        {ib.remark} (#{ib.id})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {migrateError && <p className="text-sm text-destructive">{migrateError}</p>}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setMigrateDialogOpen(false)}
              disabled={actionLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={async () => {
                if (!client) return
                if (!selectedTargetInboundId) {
                  setMigrateError("Please select a target inbound")
                  return
                }
                setActionLoading(true)
                setMigrateError(null)
                try {
                  await migrateClient(client.id, Number(selectedTargetInboundId))
                  setMigrateDialogOpen(false)
                  const id = params?.id
                  if (!id) throw new Error("missing client id")
                  const detail = await fetchClientDetail(id)
                  setClient(detail)
                } catch (err) {
                  setMigrateError((err as Error).message)
                } finally {
                  setActionLoading(false)
                }
              }}
              disabled={actionLoading}
            >
              {actionLoading ? "Migrating..." : "Migrate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
