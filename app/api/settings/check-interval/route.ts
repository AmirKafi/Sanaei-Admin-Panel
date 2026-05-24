import { NextResponse } from 'next/server'
import { getCheckIntervalSeconds } from '@/lib/usageChecker'

export async function GET() {
  try {
    const intervalSeconds = await getCheckIntervalSeconds()
    return NextResponse.json({
      intervalSeconds,
      intervalMs: intervalSeconds * 1000,
    })
  } catch (error) {
    console.error('[check-interval] Error:', error)
    return NextResponse.json(
      {
        intervalSeconds: 60,
        intervalMs: 60000,
        error: 'Using default interval',
      },
      { status: 200 }
    )
  }
}
