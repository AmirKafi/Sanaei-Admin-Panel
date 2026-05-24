"use client"

import { useEffect, useState } from "react"
import { Save, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Settings } from "@/lib/data"
import { fetchSettings, saveSettings } from "@/lib/api"

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [adminUsername, setAdminUsername] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)
        const data = await fetchSettings()
        setSettings(data)
      } catch (error) {
        setStatus((error as Error).message)
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async () => {
    if (!settings) return
    try {
      setSaving(true)
      setStatus(null)
      await saveSettings({
        ...settings,
        ...(adminUsername.trim() ? { adminUsername: adminUsername.trim() } : {}),
        ...(adminPassword ? { adminPassword } : {}),
      })
      if (adminPassword) setAdminPassword("")
      setStatus("Settings saved successfully.")
    } catch (error) {
      setStatus((error as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 pt-10 lg:pt-0">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="h-40 animate-pulse rounded-lg bg-muted" />
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-destructive">
        Unable to load settings.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 pt-10 lg:pt-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure your panel settings
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">
              Check Interval
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              How often the panel syncs inbound and client status
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="check-interval" className="text-sm text-foreground">
                Interval (seconds)
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="check-interval"
                  type="number"
                  min="10"
                  max="3600"
                  value={settings.checkIntervalSeconds}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      checkIntervalSeconds: Number(e.target.value),
                    })
                  }
                  className="w-32 bg-input border-border text-foreground"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum: 10s, Maximum: 3600s (1 hour)
              </p>
            </div>

            <div className="rounded-lg border border-border bg-secondary/30 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Current setting
                </span>
                <span className="font-mono text-lg font-bold text-primary">
                  {settings.checkIntervalSeconds}s
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{
                      width: `${Math.min(100, (settings.checkIntervalSeconds / 3600) * 100)}%`,
                    }}
                  />
                </div>
                <span className="w-12 text-right text-xs text-muted-foreground">
                  3600s
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold text-card-foreground">
              Panel Configuration
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Connection settings for the 3X-UI panel
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="panel-url" className="text-sm text-foreground">
                Panel URL
              </Label>
              <Input
                id="panel-url"
                type="url"
                value={settings.panelUrl}
                onChange={(e) => setSettings({ ...settings, panelUrl: e.target.value })}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                placeholder="https://panel.example.com"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold text-card-foreground">
              Panel Credentials
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            Username and password used to authenticate with the 3X-UI panel API
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="panel-username" className="text-sm text-foreground">
                Username
              </Label>
              <Input
                id="panel-username"
                type="text"
                value={settings.username}
                onChange={(e) => setSettings({ ...settings, username: e.target.value })}
                className="bg-input border-border text-foreground placeholder:text-muted-foreground"
                placeholder="admin"
                autoComplete="off"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="panel-password" className="text-sm text-foreground">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="panel-password"
                  type={showPassword ? "text" : "password"}
                  value={settings.password}
                  onChange={(e) => setSettings({ ...settings, password: e.target.value })}
                  className="bg-input border-border pr-10 text-foreground placeholder:text-muted-foreground"
                  placeholder="Enter password"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            These credentials are stored locally and used for API calls to your panel.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold text-card-foreground">
            Admin Login
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Credentials for this admin panel (optional — leave password blank to keep current)
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-username">Admin username</Label>
            <Input
              id="admin-username"
              value={adminUsername}
              onChange={(e) => setAdminUsername(e.target.value)}
              placeholder="admin"
              autoComplete="off"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="admin-password">Admin password</Label>
            <div className="relative">
              <Input
                id="admin-password"
                type={showAdminPassword ? "text" : "password"}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowAdminPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label={showAdminPassword ? "Hide password" : "Show password"}
              >
                {showAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Separator className="bg-border" />

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Changes will be applied immediately after saving.
        </p>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
      {status && (
        <p className="text-sm text-muted-foreground">{status}</p>
      )}
    </div>
  )
}
