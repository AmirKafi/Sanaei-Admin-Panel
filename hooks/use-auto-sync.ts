import { useEffect, useRef } from 'react'

/**
 * Hook to perform periodic sync checks
 * Can be used in any component to enable background syncing
 */
export function useAutoSync(
  onSync?: () => Promise<void>,
  interval?: number
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isSyncingRef = useRef(false)

  useEffect(() => {
    const syncInterval = interval || 60000 // default 60 seconds

    const performSync = async () => {
      if (isSyncingRef.current) {
        console.log('[useAutoSync] Sync already in progress, skipping...')
        return
      }

      try {
        isSyncingRef.current = true
        console.log('[useAutoSync] Performing automatic sync...')

        if (onSync) {
          await onSync()
        } else {
          // Default: call the API directly
          const response = await fetch('/api/sync/manual', {
            method: 'POST',
          })

          if (!response.ok) {
            const error = await response.json()
            console.error('[useAutoSync] Sync failed:', error)
          } else {
            console.log('[useAutoSync] Sync completed successfully')
          }
        }
      } catch (error) {
        console.error('[useAutoSync] Error during sync:', error)
      } finally {
        isSyncingRef.current = false
      }
    }

    // Start interval
    intervalRef.current = setInterval(performSync, syncInterval)

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [onSync, interval])
}
