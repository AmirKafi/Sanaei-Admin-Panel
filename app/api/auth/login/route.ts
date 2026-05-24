import { NextResponse } from "next/server"
import { verifyAdminCredentials, hasAdminPasswordConfigured } from "@/lib/auth/credentials"
import { createSessionToken, sessionCookieOptions, isAuthConfigured } from "@/lib/auth/session"
import { apiError, parseJsonBody } from "@/lib/api-response"
import { loginSchema } from "@/lib/validations"

export async function POST(request: Request) {
  try {
    if (!isAuthConfigured()) {
      return apiError("Server auth is not configured (set AUTH_SECRET in environment)", 503)
    }

    if (!(await hasAdminPasswordConfigured())) {
      return apiError("Admin password is not configured (set ADMIN_PASSWORD or save in settings)", 503)
    }

    const parsed = await parseJsonBody(request, loginSchema)
    if (!parsed.ok) return parsed.response

    const { username, password } = parsed.data
    const valid = await verifyAdminCredentials(username, password)
    if (!valid) {
      return apiError("Invalid username or password", 401)
    }

    const token = await createSessionToken(username)
    const response = NextResponse.json({ success: true, username })
    response.cookies.set(sessionCookieOptions(token))
    return response
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Login failed", 500)
  }
}
