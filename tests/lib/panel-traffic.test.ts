import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { parsePanelInbound, matchPanelClientToLink } from "@/lib/panel-traffic"

describe("parsePanelInbound", () => {
  it("parses clientStats traffic from inbounds.json sample", () => {
    const raw = readFileSync(join(process.cwd(), "inbounds.json"), "utf-8")
    const body = JSON.parse(raw)
    const inbound = body.obj[0]
    const parsed = parsePanelInbound(inbound)

    expect(parsed.panelId).toBe("1")
    expect(parsed.trafficUp).toBeGreaterThan(0)
    expect(parsed.trafficDown).toBeGreaterThan(0)
    expect(parsed.clients.length).toBeGreaterThan(0)

    const amir = parsed.clients.find((c) => c.email === "AmirKafi")
    expect(amir).toBeDefined()
    expect(amir!.up).toBe(1252969143)
    expect(amir!.down).toBe(8506255821)
    expect(amir!.allTime).toBe(9759224964)
    expect(amir!.quotaBytes).toBe(9663676416)
    expect(amir!.subId).toBeTruthy()
    expect(amir!.lastOnline).toBe(1778389520009)
  })

  it("matches link by email", () => {
    const client = {
      email: "AmirKafi",
      uuid: "18c9c8a2-dbb9-423c-9eac-dee75b4cb967",
      panelClientId: "2",
      subId: "6x4vpt72pkxg9fb5",
      up: 1,
      down: 2,
      allTime: 3,
      quotaBytes: 0,
      enabled: true,
      expiryTime: null,
      lastOnline: null,
    }
    expect(
      matchPanelClientToLink(
        { remoteEmail: "AmirKafi", remoteId: "wrong-uuid" },
        client
      )
    ).toBe(true)
  })
})
