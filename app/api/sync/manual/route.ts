import { NextRequest, NextResponse } from 'next/server'
import { runUsageCheck } from '@/lib/usageChecker'

/**
 * Manual trigger for usage check
 * Can be called from:
 * - Dashboard "Sync Now" button
 * - External cron service
 * - Admin interface
 */
export async function POST(req: NextRequest) {
  try {
    console.log('[manual-sync] Manual sync triggered')
    
    const result = await runUsageCheck()
    
    if ((result as any).error) {
      return NextResponse.json(
        { error: (result as any).error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Usage check completed',
      result,
    })
  } catch (error) {
    console.error('[manual-sync] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to trigger sync (for external cron services)
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  
  // Optional: verify token for security
  // const expectedToken = process.env.SYNC_TOKEN
  // if (token !== expectedToken && process.env.SYNC_TOKEN) {
  //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // }

  try {
    console.log('[manual-sync] GET sync triggered')
    
    const result = await runUsageCheck()
    
    if ((result as any).error) {
      return NextResponse.json(
        { error: (result as any).error },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Usage check completed',
      result,
    })
  } catch (error) {
    console.error('[manual-sync] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
