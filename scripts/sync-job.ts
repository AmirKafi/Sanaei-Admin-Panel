import { runUsageCheck, getCheckIntervalSeconds } from "../lib/usageChecker"

async function scheduleNext() {
  try {
    console.log("[sync-job] Starting usage check...")
    await runUsageCheck()
    console.log("[sync-job] Usage check completed.")
  } catch (e) {
    console.error("[sync-job] Error in usage check:", e)
  }

  try {
    const interval = await getCheckIntervalSeconds()
    const waitTime = Math.max(10, interval)
    console.log(`[sync-job] Waiting ${waitTime} seconds for next run...`)
    setTimeout(scheduleNext, waitTime * 1000)
  } catch (e) {
    console.error("[sync-job] Failed to schedule next run:", e)
    setTimeout(scheduleNext, 60 * 1000) // retry in 1 min on error
  }
}

console.log("[sync-job] Background sync process started.")
scheduleNext()
