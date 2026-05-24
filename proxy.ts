import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getSessionFromRequest } from "@/lib/auth/session"

const PUBLIC_PATHS = ["/login", "/sub"]
const PUBLIC_API_PREFIXES = ["/api/auth/", "/api/sub/"]

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true
  }
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return true
  }
  return false
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next()
  }

  if (isPublicPath(pathname)) {
    // Handle /sub/[subId] requests for clients (v2ray, etc.)
    if (pathname.startsWith("/sub/") && !pathname.includes("/", 5)) {
      const userAgent = request.headers.get("user-agent")?.toLowerCase() || ""
      const accept = request.headers.get("accept")?.toLowerCase() || ""
      const searchParams = request.nextUrl.searchParams
      const target = searchParams.get("target")

      // Detect if it's a client request (v2ray, shadowrocket, etc.)
      // A request is a browser request ONLY if it explicitly asks for text/html
      const isBrowser = accept.includes("text/html")
      const isClient =
        target ||
        !isBrowser ||
        userAgent.includes("v2ray") ||
        userAgent.includes("shadowrocket") ||
        userAgent.includes("stash") ||
        userAgent.includes("clash") ||
        userAgent.includes("surge") ||
        userAgent.includes("quantumult") ||
        userAgent.includes("sing-box") ||
        userAgent.includes("v2rayng") ||
        userAgent.includes("v2rayn") ||
        userAgent.includes("kitsunebi")

      if (isClient) {
        const url = request.nextUrl.clone()
        url.pathname = `/api${pathname}`
        
        // Add a header to help the API route distinguish between a direct API call 
        // and a rewritten subscription link request.
        const requestHeaders = new Headers(request.headers)
        requestHeaders.set("x-sub-client-request", "true")
        
        return NextResponse.rewrite(url, {
          request: {
            headers: requestHeaders,
          },
        })
      }
    }

    const session = await getSessionFromRequest(request)
    if (session && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url))
    }
    return NextResponse.next()
  }

  const session = await getSessionFromRequest(request)

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
}
