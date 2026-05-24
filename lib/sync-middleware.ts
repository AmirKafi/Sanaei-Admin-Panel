import { type NextRequest, NextResponse } from 'next/server'
import { runUsageCheck, getCheckIntervalSeconds } from '@/lib/usageChecker'

// Store the last sync timestamp and interval in a simple in-memory cache
let lastSyncTime = 0
let lastCheckInterval = 60

/**
 * Middleware to periodically trigger usage checks
 * This is called on every request, so we use a simple interval check
 */
export async function syncMiddleware(request: NextRequest) {
  // Only run on certain paths to avoid excessive checks
  if (!request.nextUrl.pathname.startsWith('/app')) {
    return
  }

  const now = Date.now()
  const timeSinceLastSync = now - lastSyncTime

  try {
    const checkInterval = await getCheckIntervalSeconds()
    lastCheckInterval = checkInterval
    const intervalMs = checkInterval * 1000

    // If enough time has passed, trigger a sync
    if (timeSinceLastSync >= intervalMs && lastSyncTime > 0) {
      console.log(`[sync-middleware] Triggering sync (${timeSinceLastSync}ms since last sync)`)
      
      // Run sync in background (don't await to not block the request)
      runUsageCheck().catch((error) => {
        console.error('[sync-middleware] Error in background sync:', error)
      })

      lastSyncTime = now
    } else if (lastSyncTime === 0) {
      // First time - initialize and run sync
      console.log('[sync-middleware] First sync initialization')
      lastSyncTime = now
      
      runUsageCheck().catch((error) => {
        console.error('[sync-middleware] Error in initial sync:', error)
      })
    }
  } catch (error) {
    console.error('[sync-middleware] Error getting check interval:', error)
  }
}
