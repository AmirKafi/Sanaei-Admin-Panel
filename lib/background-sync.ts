import { runUsageCheck, getCheckIntervalSeconds } from "./usageChecker"

let syncInterval: NodeJS.Timeout | null = null

export async function startBackgroundSync() {
  if (syncInterval !== null) {
    console.log("[background-sync] Sync already running")
    return
  }

  console.log("[background-sync] Starting background sync...")

  async function runSync() {
    try {
      console.log("[background-sync] Running usage check at", new Date().toISOString())
      const result = await runUsageCheck()
      
      if ((result as any).error) {
        console.error("[background-sync] Error:", (result as any).error)
      } else {
        console.log("[background-sync] Sync completed successfully")
      }
    } catch (error) {
      console.error("[background-sync] Error during sync:", error)
    }

    // Schedule next run
    try {
      const interval = await getCheckIntervalSeconds()
      const waitTime = Math.max(10, interval)
      console.log(`[background-sync] Next sync in ${waitTime} seconds`)
      
      syncInterval = setTimeout(runSync, waitTime * 1000)
    } catch (error) {
      console.error("[background-sync] Failed to schedule next run:", error)
      syncInterval = setTimeout(runSync, 60 * 1000) // retry in 1 min on error
    }
  }

  // Run immediately first
  await runSync()
}

export function stopBackgroundSync() {
  if (syncInterval) {
    clearTimeout(syncInterval)
    syncInterval = null
    console.log("[background-sync] Background sync stopped")
  }
}

export function isBackgroundSyncRunning(): boolean {
  return syncInterval !== null
}
