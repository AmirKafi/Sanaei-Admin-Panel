"use client"

import { FormEvent, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Eye,
  Link as LinkIcon,
  Copy,
  FileCode,
  Check,
  Pencil,
  Users,
  HardDrive,
  Activity,
  RefreshCw,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  formatBytes,
  formatDate,
  getRemainingBytes,
  getUsageBarColor,
  getUsagePercent,
} from "@/lib/data"
import { Skeleton } from "@/components/ui/skeleton"
import { createClient, fetchClients, fetchInbounds, syncInbounds, updateClient } from "@/lib/api"
import type { ClientSummary, InboundSummary } from "@/lib/api"
import { cn } from "@/lib/utils"

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

type StatusFilter = "all" | "active" | "disabled"
type UsageFilter = "all" | "high" | "warning" | "ok"
type SortOption = "name" | "used-desc" | "remaining-asc" | "expiry"

function ClientUsageBar({ used, total }: { used: number; total: number }) {
  const percent = getUsagePercent(used, total)
  return (
    <div className="h-2 w-full min-w-[120px] overflow-hidden rounded-full bg-secondary">
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{
          width: `${percent}%`,
          backgroundColor: getUsageBarColor(percent),
        }}
      />
    </div>
  )
}

function matchesUsageFilter(
  used: number,
  total: number,
  filter: UsageFilter
): boolean {
  if (filter === "all") return true
  const percent = getUsagePercent(used, total)
  if (filter === "high") return percent >= 90
  if (filter === "warning") return percent >= 70 && percent < 90
  return percent < 70
}

function NewClientForm({
  inbounds,
  clients,
  onClose,
  onCreate,
}: {
  inbounds: InboundSummary[]
  clients: ClientSummary[]
  onClose: () => void
  onCreate: (payload: {
    name: string
    totalQuota: number
    inboundIds: number[]
  }) => Promise<void>
}) {
  const [name, setName] = useState("")
  const [quota, setQuota] = useState("")
  const [quotaUnit, setQuotaUnit] = useState("GB")
  const [selectedInbounds, setSelectedInbounds] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)

  const toggleInbound = (id: number) => {
    setSelectedInbounds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const convertToBytes = (value: number) => {
    switch (quotaUnit) {
      case "TB":
        return value * 1024 * 1024 * 1024 * 1024
      case "GB":
        return value * 1024 * 1024 * 1024
      case "MB":
      default:
        return value * 1024 * 1024
    }
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)
    const quotaValue = Number(quota)
    if (!quotaValue || selectedInbounds.length === 0) {
      setError("Name, quota, and at least one inbound are required.")
      return
    }
    if (duplicate) {
      setError("Client name is already used in one of the selected inbounds.")
      return
    }

    const totalQuota = convertToBytes(quotaValue)
    setLoading(true)
    try {
      await onCreate({ name, totalQuota, inboundIds: selectedInbounds })
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!name) return setDuplicate(false)
    const lower = name.toLowerCase()
    const exists = clients.some((c) => {
      if (c.email.toLowerCase() !== lower) return false
      return c.inboundIds.some((id) => selectedInbounds.includes(id))
    })
    setDuplicate(exists)
  }, [name, selectedInbounds, clients])

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="client-name" className="text-sm text-foreground">
          Client Name
        </Label>
        <Input
          id="client-name"
          placeholder="e.g. user_john"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-input border-border text-foreground placeholder:text-muted-foreground"
          required
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label className="text-sm text-foreground">Total Quota</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="1"
            placeholder="e.g. 10"
            value={quota}
            onChange={(e) => setQuota(e.target.value)}
            className="flex-1 bg-input border-border text-foreground placeholder:text-muted-foreground"
            min="1"
            required
          />
          <Select value={quotaUnit} onValueChange={setQuotaUnit}>
            <SelectTrigger className="w-24 bg-input border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border text-popover-foreground">
              <SelectItem value="MB">MB</SelectItem>
              <SelectItem value="GB">GB</SelectItem>
              <SelectItem value="TB">TB</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Label className="text-sm text-foreground">Active Inbounds</Label>
        <div className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/30 p-3">
          {inbounds.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active inbounds available.
            </p>
          ) : (
            inbounds.map((inbound) => (
              <label
                key={inbound.id}
                className="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary/50"
              >
                <Checkbox
                  checked={selectedInbounds.includes(inbound.id)}
                  onCheckedChange={() => toggleInbound(inbound.id)}
                />
                <div className="flex flex-1 items-center justify-between">
                  <span className="text-sm text-foreground">
                    {inbound.remark}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {inbound.protocol.toUpperCase()} :{inbound.port}
                  </span>
                </div>
              </label>
            ))
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {duplicate && (
        <p className="text-sm text-yellow-600">
          This client name is already used in one of the selected inbounds.
        </p>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          className="border-border text-foreground hover:bg-secondary"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading || inbounds.length === 0 || duplicate}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? "Creating..." : "Create Client"}
        </Button>
      </div>
    </form>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all")
  const [sortBy, setSortBy] = useState<SortOption>("name")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [inbounds, setInbounds] = useState<InboundSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copyingId, setCopyingId] = useState<string | null>(null)
  const [copiedType, setCopiedType] = useState<"sub" | "configs" | null>(null)

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [clientsData, inboundsData] = await Promise.all([
        fetchClients(),
        fetchInbounds(),
      ])
      setClients(clientsData)
      setInbounds(inboundsData.filter((inbound) => inbound.enable))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setSyncing(true)
    setError(null)
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

  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, usageFilter, sortBy, pageSize])

  const handleCreateClient = async (payload: {
    name: string
    totalQuota: number
    inboundIds: number[]
  }) => {
    await createClient(payload)
    await loadData()
  }

  const handleCopySubLink = async (client: ClientSummary) => {
    const subLink = `${window.location.origin}/sub/${encodeURIComponent(client.uuid)}`
    await navigator.clipboard.writeText(subLink)
    setCopyingId(client.id)
    setCopiedType("sub")
    setTimeout(() => {
      setCopyingId(null)
      setCopiedType(null)
    }, 2000)
  }

  const handleCopyConfigs = async (client: ClientSummary) => {
    setCopyingId(client.id)
    setCopiedType("configs")
    try {
      const res = await fetch(`/api/sub/${encodeURIComponent(client.uuid)}`)
      if (!res.ok) throw new Error("Failed to fetch configs")
      const data = await res.json()
      const allConfigs = data.inbounds
        .flatMap((i: any) => i.configs)
        .map((c: any) => c.url)
        .join("\n")
      await navigator.clipboard.writeText(allConfigs)
      setTimeout(() => {
        setCopyingId(null)
        setCopiedType(null)
      }, 2000)
    } catch (err) {
      console.error(err)
      setCopyingId(null)
      setCopiedType(null)
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = clients.filter((client) => {
      if (query && !client.email.toLowerCase().includes(query)) return false
      if (statusFilter === "active" && !client.enable) return false
      if (statusFilter === "disabled" && client.enable) return false
      if (!matchesUsageFilter(client.usedGB, client.totalGB, usageFilter))
        return false
      return true
    })

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "used-desc":
          return b.usedGB - a.usedGB
        case "remaining-asc":
          return (
            getRemainingBytes(a.totalGB, a.usedGB) -
            getRemainingBytes(b.totalGB, b.usedGB)
          )
        case "expiry": {
          if (a.expiryTime === 0 && b.expiryTime === 0) return 0
          if (a.expiryTime === 0) return 1
          if (b.expiryTime === 0) return -1
          return a.expiryTime - b.expiryTime
        }
        case "name":
        default:
          return a.email.localeCompare(b.email)
      }
    })

    return result
  }, [clients, search, statusFilter, usageFilter, sortBy])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize
    return filtered.slice(start, start + pageSize)
  }, [filtered, safePage, pageSize])

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1
  const rangeEnd = Math.min(safePage * pageSize, filtered.length)

  const activeCount = clients.filter((c) => c.enable).length
  const totalQuota = clients.reduce((acc, c) => acc + c.totalGB, 0)
  const totalUsed = clients.reduce((acc, c) => acc + c.usedGB, 0)
  const totalRemaining = getRemainingBytes(totalQuota, totalUsed)

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    usageFilter !== "all" ||
    sortBy !== "name"

  const clearFilters = () => {
    setSearch("")
    setStatusFilter("all")
    setUsageFilter("all")
    setSortBy("name")
  }

  return (
    <div className="flex flex-col gap-6 pt-10 lg:pt-0">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Manage and monitor your VPN clients
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || loading}
            className="gap-2 border-border text-foreground hover:bg-secondary"
          >
            <RefreshCw
              className={cn("h-4 w-4", syncing && "animate-spin")}
            />
            {syncing ? "Refreshing..." : "Refresh Traffic"}
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={loading}
              >
                <Plus className="h-4 w-4" />
                New Client
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border text-card-foreground sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-foreground">
                  Create New Client
                </DialogTitle>
              </DialogHeader>
              <NewClientForm
                inbounds={inbounds}
                clients={clients}
                onClose={() => setDialogOpen(false)}
                onCreate={handleCreateClient}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && clients.length === 0 ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {activeCount}
                    <span className="text-base font-normal text-muted-foreground">
                      {" / "}
                      {clients.length}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Active / Total Clients
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-chart-2/10 p-2.5">
                  <HardDrive className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {formatBytes(totalQuota)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Quota</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-warning/10 p-2.5">
                  <Activity className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {formatBytes(totalUsed)}
                    <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                      ({getUsagePercent(totalUsed, totalQuota)}%)
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">Total Used</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="rounded-lg bg-primary/10 p-2.5">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-card-foreground">
                    {formatBytes(totalRemaining)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total Remaining
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="space-y-1 pb-0">
              <CardTitle className="text-base font-semibold text-card-foreground">
                All Clients
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Search, filter, and browse client traffic usage
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1 lg:max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search by client name..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-input border-border pl-9 text-foreground"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={statusFilter}
                      onValueChange={(v) => setStatusFilter(v as StatusFilter)}
                    >
                      <SelectTrigger className="w-[130px] bg-input border-border">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={usageFilter}
                      onValueChange={(v) => setUsageFilter(v as UsageFilter)}
                    >
                      <SelectTrigger className="w-[150px] bg-input border-border">
                        <SelectValue placeholder="Usage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All usage</SelectItem>
                        <SelectItem value="high">Critical (≥90%)</SelectItem>
                        <SelectItem value="warning">Warning (70–89%)</SelectItem>
                        <SelectItem value="ok">Normal (&lt;70%)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={sortBy}
                      onValueChange={(v) => setSortBy(v as SortOption)}
                    >
                      <SelectTrigger className="w-[160px] bg-input border-border">
                        <SelectValue placeholder="Sort" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="name">Name (A–Z)</SelectItem>
                        <SelectItem value="used-desc">Most used</SelectItem>
                        <SelectItem value="remaining-asc">
                          Least remaining
                        </SelectItem>
                        <SelectItem value="expiry">Expiry (soonest)</SelectItem>
                      </SelectContent>
                    </Select>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearFilters}
                        className="gap-1 text-muted-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {loading
                    ? "Loading clients..."
                    : `${filtered.length} of ${clients.length} clients`}
                  {filtered.length > 0 &&
                    !loading &&
                    ` · showing ${rangeStart}–${rangeEnd}`}
                </p>
              </div>

              <div className="overflow-x-auto pt-4">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="text-muted-foreground">
                        Client
                      </TableHead>
                      <TableHead className="min-w-[200px] text-muted-foreground">
                        Usage
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Remaining
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Quota
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Status
                      </TableHead>
                      <TableHead className="text-muted-foreground">
                        Expires
                      </TableHead>
                      <TableHead className="text-right text-muted-foreground">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((client) => {
                      const percent = getUsagePercent(
                        client.usedGB,
                        client.totalGB
                      )
                      const remaining = getRemainingBytes(
                        client.totalGB,
                        client.usedGB
                      )
                      return (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer border-border hover:bg-secondary/30"
                          onClick={() => router.push(`/clients/${client.id}`)}
                        >
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-card-foreground">
                                {client.email}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {client.inboundIds.length} inbound
                                {client.inboundIds.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex max-w-xs flex-col gap-1.5">
                              <ClientUsageBar
                                used={client.usedGB}
                                total={client.totalGB}
                              />
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <span className="font-mono text-card-foreground">
                                  {formatBytes(client.usedGB)} /{" "}
                                  {formatBytes(client.totalGB)}
                                </span>
                                <span
                                  className={cn(
                                    "shrink-0 font-medium",
                                    percent >= 90
                                      ? "text-destructive"
                                      : percent >= 70
                                        ? "text-warning"
                                        : "text-muted-foreground"
                                  )}
                                >
                                  {percent}%
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "font-medium",
                                remaining === 0
                                  ? "text-destructive"
                                  : "text-card-foreground"
                              )}
                            >
                              {formatBytes(remaining)}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatBytes(client.totalGB)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={
                                client.enable
                                  ? "bg-primary/15 text-primary hover:bg-primary/15"
                                  : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                              }
                            >
                              {client.enable ? "Active" : "Disabled"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {formatDate(client.expiryTime)}
                          </TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                title="Copy subscription link"
                                onClick={() => handleCopySubLink(client)}
                              >
                                {copyingId === client.id && copiedType === "sub" ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <LinkIcon className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                                title="Copy all configs"
                                onClick={() => handleCopyConfigs(client)}
                              >
                                {copyingId === client.id && copiedType === "configs" ? (
                                  <Check className="h-4 w-4 text-green-600" />
                                ) : (
                                  <FileCode className="h-4 w-4" />
                                )}
                              </Button>
                              <Link href={`/clients/${client.id}`}>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:bg-secondary hover:text-foreground"
                                  title="View details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {paginated.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-12 text-center"
                        >
                          <p className="text-sm text-muted-foreground">
                            {hasActiveFilters
                              ? "No clients match your filters."
                              : "No clients found."}
                          </p>
                          {hasActiveFilters && (
                            <Button
                              variant="link"
                              size="sm"
                              onClick={clearFilters}
                              className="mt-1"
                            >
                              Clear filters
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              {filtered.length > 0 && (
                <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Rows per page</span>
                    <Select
                      value={String(pageSize)}
                      onValueChange={(v) => setPageSize(Number(v))}
                    >
                      <SelectTrigger className="h-8 w-[72px] bg-input border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <span className="min-w-[100px] px-2 text-center text-sm text-muted-foreground">
                      Page {safePage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
