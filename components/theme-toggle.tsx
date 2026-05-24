"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && (theme === "dark" || resolvedTheme === "dark")

  return (
    <div
      className={cn(
        "flex h-10 items-center gap-2 rounded-lg border border-border/50 bg-card/50 px-3",
        className
      )}
    >
      <Sun
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          mounted && !isDark ? "text-primary" : "text-muted-foreground"
        )}
      />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        disabled={!mounted}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      />
      <Moon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          mounted && isDark ? "text-primary" : "text-muted-foreground"
        )}
      />
    </div>
  )
}
