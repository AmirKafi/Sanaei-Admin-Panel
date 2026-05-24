import { NextRequest, NextResponse } from 'next/server'
import { startBackgroundSync, stopBackgroundSync, isBackgroundSyncRunning } from '@/lib/background-sync'

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action')

  switch (action) {
    case 'start':
      try {
        if (!isBackgroundSyncRunning()) {
          await startBackgroundSync()
          return NextResponse.json({ status: 'started', message: 'Background sync started' })
        } else {
          return NextResponse.json({ status: 'already_running', message: 'Background sync is already running' })
        }
      } catch (error) {
        return NextResponse.json(
          { error: error instanceof Error ? error.message : 'Failed to start sync' },
          { status: 500 }
        )
      }

    case 'stop':
      stopBackgroundSync()
      return NextResponse.json({ status: 'stopped', message: 'Background sync stopped' })

    case 'status':
      return NextResponse.json({
        running: isBackgroundSyncRunning(),
        status: isBackgroundSyncRunning() ? 'running' : 'stopped',
      })

    default:
      return NextResponse.json(
        { error: 'Invalid action. Use ?action=start, ?action=stop, or ?action=status' },
        { status: 400 }
      )
  }
}
