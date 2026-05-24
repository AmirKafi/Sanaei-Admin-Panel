import { describe, expect, it } from "vitest"
import {
  decodeSubscriptionBody,
  parseSubscriptionConfigs,
  buildPanelSubscriptionUrls,
} from "@/lib/subscription"

describe("subscription", () => {
  it("decodes base64 subscription bodies", () => {
    const line = "vless://uuid@host:443#Test"
    const encoded = Buffer.from(`${line}\n`, "utf8").toString("base64")
    expect(decodeSubscriptionBody(encoded)).toContain("vless://")
  })

  it("parses config lines with labels", () => {
    const body = [
      "vless://a@host:8080?type=ws#GothKafi",
      "vless://b@host:443?security=tls#SOS-ib6-GothKafi",
    ].join("\n")
    const configs = parseSubscriptionConfigs(body)
    expect(configs).toHaveLength(2)
    expect(configs[0].label).toBe("GothKafi")
    expect(configs[1].label).toBe("SOS-ib6-GothKafi")
  })

  it("builds panel subscription urls", () => {
    const urls = buildPanelSubscriptionUrls("https://panel.example.com/xui", "abc123")
    expect(urls.subscriptionUrl).toBe("https://panel.example.com/xui/sub/abc123")
    expect(urls.clashSubscriptionUrl).toContain("target=clash")
  })
})
