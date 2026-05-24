import { getSessionFromCookies } from "@/lib/auth/session"
import { apiError, apiSuccess } from "@/lib/api-response"

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session) {
    return apiError("Unauthorized", 401)
  }
  return apiSuccess({ username: session.sub })
}
