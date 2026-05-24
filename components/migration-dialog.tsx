"use client"

import { useState } from "react"
import { AlertCircle, CheckCircle2, XCircle, Download } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Spinner } from "@/components/ui/spinner"
import { useToast } from "@/hooks/use-toast"
import { getMigrationPreview, syncAndMigrateInboundClients } from "@/lib/api"
import type { NameAffixMode } from "@/lib/quota"

interface MigrationDialogProps {
  sourceInbound: any
  allInbounds: any[]
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

function formatGb(bytes: number) {
  return (bytes / 1024 / 1024 / 1024).toFixed(2)
}

export function MigrationDialog({
  sourceInbound,
  allInbounds,
  isOpen,
  onClose,
  onSuccess,
}: MigrationDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<"select" | "sync" | "preview">("select")
  const [targetInboundIds, setTargetInboundIds] = useState<number[]>([])
  const [nameAffix, setNameAffix] = useState<NameAffixMode>("postfix")
  const [skipExisting, setSkipExisting] = useState(true)
  const [loading, setLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)

  const availableTargets = allInbounds.filter((ib) => ib.id !== sourceInbound.id)

  const toggleTarget = (inboundId: number, checked: boolean) => {
    setTargetInboundIds((prev) =>
      checked ? [...prev, inboundId] : prev.filter((id) => id !== inboundId)
    )
  }

  const selectedTargetLabels = availableTargets
    .filter((ib) => targetInboundIds.includes(ib.id))
    .map((ib) => ib.remark)
    .join(", ")

  const handleLoadSync = async () => {
    if (targetInboundIds.length === 0) {
      toast({
        title: "Error",
        description: "Select at least one target inbound",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setSyncError(null)
    try {
      const response = await syncAndMigrateInboundClients(
        sourceInbound.id,
        targetInboundIds,
        { nameAffix, skipExisting }
      )
      setSyncResult(response.result)
      setStep("sync")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Migration failed"
      setSyncError(message)
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleLoadPreview = async () => {
    if (targetInboundIds.length === 0) {
      toast({
        title: "Error",
        description: "Select at least one target inbound",
        variant: "destructive",
      })
      return
    }

    setLoading(true)
    setPreviewError(null)
    try {
      const result = await getMigrationPreview(sourceInbound.id, targetInboundIds[0])
      setPreview(result.preview)
      setStep("preview")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load preview"
      setPreviewError(message)
      toast({ title: "Error", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep("select")
    setTargetInboundIds([])
    setNameAffix("postfix")
    setSkipExisting(true)
    setSyncResult(null)
    setSyncError(null)
    setPreview(null)
    setPreviewError(null)
    onClose()
  }

  const handleSuccess = () => {
    onSuccess?.()
    handleClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Migrate Inbound Clients</DialogTitle>
          <DialogDescription>
            Copy clients from {sourceInbound?.remark} to one or more target inbounds — same quota,
            zero usage on each target. Source clients are left unchanged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {step === "select" && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Source inbound</label>
                <div className="mt-2 flex items-center gap-2 rounded-md bg-muted p-3">
                  <span>{sourceInbound?.remark}</span>
                  <Badge variant="outline">{sourceInbound?.protocol}</Badge>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Target inbounds</label>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border p-3">
                  {availableTargets.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No target inbounds available</p>
                  ) : (
                    availableTargets.map((inbound) => (
                      <label
                        key={inbound.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/60"
                      >
                        <Checkbox
                          checked={targetInboundIds.includes(inbound.id)}
                          onCheckedChange={(checked) =>
                            toggleTarget(inbound.id, checked === true)
                          }
                        />
                        <span className="text-sm">
                          {inbound.remark}{" "}
                          <span className="text-muted-foreground">({inbound.protocol})</span>
                        </span>
                      </label>
                    ))
                  )}
                </div>
                {targetInboundIds.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {targetInboundIds.length} inbound(s) selected
                  </p>
                )}
              </div>

              <div className="space-y-3 rounded-lg border p-4">
                <label className="text-sm font-medium">Client name on target</label>
                <Select
                  value={nameAffix}
                  onValueChange={(v) => setNameAffix(v as NameAffixMode)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postfix">Suffix (e.g. miti-ib5)</SelectItem>
                    <SelectItem value="prefix">Prefix (e.g. ib5-miti)</SelectItem>
                    <SelectItem value="none">No change</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  One client in the admin panel with a link per inbound (source + targets). The name
                  shown in VPN apps uses the suffix/prefix above.
                </p>

                <label className="flex items-center gap-2 pt-2">
                  <Checkbox
                    checked={skipExisting}
                    onCheckedChange={(checked) => setSkipExisting(checked === true)}
                  />
                  <span className="text-sm font-medium">Skip existing clients</span>
                </label>
              </div>

              <Alert>
                <Download className="h-4 w-4" />
                <AlertTitle>Process</AlertTitle>
                <AlertDescription>
                  Clients are synced from the Sanaei panel, then copied to each selected target
                  {selectedTargetLabels ? ` (${selectedTargetLabels})` : ""} with full quota and zero
                  usage.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {step === "preview" && preview && (
            <div className="space-y-4">
              <Alert className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-900 dark:text-blue-100">Migration preview</AlertTitle>
                <AlertDescription className="text-blue-800 dark:text-blue-200">
                  {preview.clientDetails?.length || 0} client(s) × {targetInboundIds.length} target
                  inbound(s) — full quota with zero usage on each target
                </AlertDescription>
              </Alert>

              {preview.clientDetails && preview.clientDetails.length > 0 && (
                <div className="max-h-96 overflow-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Quota (source)</TableHead>
                        <TableHead>Used (source)</TableHead>
                        <TableHead>On target</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.clientDetails.map((client: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">{client.clientName}</TableCell>
                          <TableCell className="text-sm">
                            {formatGb(Number(client.totalQuota ?? 0))} GB
                          </TableCell>
                          <TableCell className="text-sm">
                            {formatGb(Number(client.usedBytes ?? 0))} GB
                          </TableCell>
                          <TableCell>
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                              {formatGb(Number(client.totalQuota ?? 0))} GB / 0 used
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {step === "sync" && syncResult && (
            <div className="space-y-4">
              <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-900 dark:text-green-100">Complete</AlertTitle>
                <AlertDescription className="text-green-800 dark:text-green-200">
                  {syncResult.syncResult.summary.totalFromPanel} client(s) synced —{" "}
                  {syncResult.migrationResult.summary.migrated} created on target(s)
                  {targetInboundIds.length > 1
                    ? ` across ${targetInboundIds.length} inbounds`
                    : ""}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {syncResult.migrationResult.summary.migrated}
                  </div>
                  <div className="text-xs text-muted-foreground">Migrated</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {syncResult.migrationResult.summary.skipped}
                  </div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">
                    {syncResult.migrationResult.summary.failed}
                  </div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>

              {syncResult.migrationResults?.length > 1 && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-medium">Per inbound</p>
                  {syncResult.migrationResults.map((mr: any) => (
                    <div
                      key={mr.summary.targetInboundId}
                      className="flex justify-between text-sm"
                    >
                      <span>Inbound #{mr.summary.targetInboundId}</span>
                      <span className="text-muted-foreground">
                        {mr.summary.migrated} migrated, {mr.summary.failed} failed
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {syncError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{syncError}</AlertDescription>
            </Alert>
          )}

          {previewError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{previewError}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>
            {step === "sync" && syncResult?.migrationResult ? "Close" : "Cancel"}
          </Button>

          {step === "select" && (
            <Button
              onClick={handleLoadPreview}
              disabled={targetInboundIds.length === 0 || loading}
            >
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Loading...
                </>
              ) : (
                "Show preview"
              )}
            </Button>
          )}

          {step === "preview" && preview && (
            <Button onClick={handleLoadSync} disabled={loading}>
              {loading ? (
                <>
                  <Spinner className="mr-2 h-4 w-4" />
                  Processing...
                </>
              ) : (
                "Start sync & migrate"
              )}
            </Button>
          )}

          {step === "sync" && syncResult?.migrationResult && (
            <Button onClick={handleSuccess}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
