import { NextResponse } from "next/server"
import type { ZodSchema } from "zod"

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    { success: false, error: message, ...(details != null ? { details } : {}) },
    { status }
  )
}

export function apiSuccess<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json({ success: true, ...data }, { status })
}

export async function parseJsonBody<T>(request: Request, schema: ZodSchema<T>) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return { ok: false as const, response: apiError("Invalid JSON body", 400) }
  }

  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return {
      ok: false as const,
      response: apiError("Validation failed", 400, parsed.error.flatten()),
    }
  }

  return { ok: true as const, data: parsed.data }
}
