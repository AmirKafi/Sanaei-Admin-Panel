import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { generateInboundLinks } from "@/lib/panel-link"

describe("generateInboundLinks", () => {
  it("builds vless ws links with externalProxy from inbounds.json", () => {
    const raw = readFileSync(join(process.cwd(), "inbounds.json"), "utf-8")
    const inbound = JSON.parse(raw).obj[0]

    const links = generateInboundLinks(
      inbound,
      { email: "GothKafi" },
      "panel.example.com"
    )

    expect(links.length).toBeGreaterThanOrEqual(1)
    const first = links[0]
    expect(first.uri).toMatch(/^vless:\/\//)
    expect(first.label).toContain("GothKafi")
    expect(first.meta.protocol).toBe("vless")
    expect(first.meta.network).toBe("ws")
    expect(first.meta.port).toBe(8080)
  })

  it("builds tls xhttp link for SOS inbound", () => {
    const raw = readFileSync(join(process.cwd(), "inbounds.json"), "utf-8")
    const inbound = JSON.parse(raw).obj.find(
      (i: { remark?: string }) => i.remark === "SOS"
    )

    const links = generateInboundLinks(
      inbound,
      { email: "LimitedEdition2" },
      "panel.example.com"
    )

    expect(links.length).toBe(1)
    expect(links[0].uri).toMatch(/^vless:\/\//)
    expect(links[0].meta.security).toBe("tls")
    expect(links[0].meta.network).toBe("xhttp")
    expect(links[0].uri).toContain("security=tls")
  })
})
