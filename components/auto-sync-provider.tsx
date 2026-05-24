'use client'

import { useEffect, useState } from 'react'
import { useAutoSync } from '@/hooks/use-auto-sync'

/**
 * Component to enable background auto-sync
 * Should be placed in the main admin layout
 */
export function AutoSyncProvider({ children }: { children: React.ReactNode }) {
  const [interval, setInterval] = useState<number>(60000) // default 60 seconds

  // Fetch the configured sync interval
  useEffect(() => {
    const fetchInterval = async () => {
      try {
        const response = await fetch('/api/settings/check-interval')
        if (response.ok) {
          const data = await response.json()
          // Convert seconds to milliseconds
          const ms = (data.intervalSeconds || 60) * 1000
          setInterval(Math.max(10000, ms)) // minimum 10 seconds
        }
      } catch (error) {
        console.error('[AutoSyncProvider] Failed to fetch check interval:', error)
      }
    }

    fetchInterval()
  }, [])

  // Use the hook with the fetched interval
  useAutoSync(undefined, interval)

  return <>{children}</>
}
