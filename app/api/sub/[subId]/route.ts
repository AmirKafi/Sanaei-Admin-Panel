import { NextRequest, NextResponse } from "next/server"
import { getSubscriptionBySubId } from "@/lib/subscription"
import { serializeForJson } from "@/lib/json-serialize"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ subId: string }> }
) {
  try {
    const { subId } = await context.params
    const data = await getSubscriptionBySubId(subId)

    if (!data) {
      return NextResponse.json({ error: "Subscription not found" }, { status: 404 })
    }

    const searchParams = request.nextUrl.searchParams
    const format = searchParams.get("format")
    const target = searchParams.get("target")
    const userAgent = request.headers.get("user-agent")?.toLowerCase() || ""
    const accept = request.headers.get("accept")?.toLowerCase() || ""
    const isSubClientHeader = request.headers.get("x-sub-client-request") === "true"

    // Detect if it's a client request (v2ray, shadowrocket, etc.)
    const isBrowser = accept.includes("text/html")
    const isJsonRequest = accept.includes("application/json")
    
    const isClient =
      isSubClientHeader ||
      target ||
      format === "text" ||
      userAgent.includes("v2ray") ||
      userAgent.includes("shadowrocket") ||
      userAgent.includes("stash") ||
      userAgent.includes("clash") ||
      userAgent.includes("surge") ||
      userAgent.includes("quantumult") ||
      userAgent.includes("sing-box") ||
      userAgent.includes("v2rayng") ||
      userAgent.includes("v2rayn") ||
      userAgent.includes("kitsunebi") ||
      (!isBrowser && !isJsonRequest && accept !== "*/*")

    if (isClient) {
      const configLinks = data.configs.map((c) => c.uri).join("\n")
      const base64Config = Buffer.from(configLinks).toString("base64")
      
      // Standard V2Ray Subscription Userinfo Header
      // upload=<bytes>; download=<bytes>; total=<bytes>; expire=<unix_timestamp>
      const upload = data.uploaded || 0
      const download = data.downloaded || 0
      const total = data.totalQuota || 0
      const expire = data.expiryTime ? Math.floor(data.expiryTime / 1000) : 0
      
      const userInfo = `upload=${upload}; download=${download}; total=${total}; expire=${expire}`

      return new Response(base64Config, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
          "Subscription-Userinfo": userInfo,
        },
      })
    }

    // Return JSON for our own UI components
    return NextResponse.json(serializeForJson(data))
  } catch (err) {
    console.error("[Subscription API] GET error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Request failed" },
      { status: 500 }
    )
  }
}