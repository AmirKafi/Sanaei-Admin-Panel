import { NextRequest, NextResponse } from "next/server"
import { runUsageCheck } from "@/lib/usageChecker"

export async function POST(req: NextRequest) {
  try {
    const res = await runUsageCheck()
    if ((res as any).error) {
      return NextResponse.json(res, { status: 400 })
    }
    return NextResponse.json(res)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
