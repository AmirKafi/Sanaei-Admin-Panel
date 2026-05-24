import { describe, expect, it } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import {
  findSettingsClient,
  preparePanelClientForUpdate,
} from "@/lib/panel-client-control"

describe("panel-client-control", () => {
  it("finds settings client by uuid and builds disable payload", () => {
    const raw = readFileSync(join(process.cwd(), "inbounds.json"), "utf-8")
    const inbound = JSON.parse(raw).obj[0]

    const settingsClient = findSettingsClient(inbound, {
      uuid: "18c9c8a2-dbb9-423c-9eac-dee75b4cb967",
    })
    expect(settingsClient).toBeTruthy()
    expect(settingsClient?.email).toBe("AmirKafi")

    const payload = preparePanelClientForUpdate(
      settingsClient as Record<string, unknown>,
      { enable: false }
    )
    expect(payload.enable).toBe(false)
    expect(payload.id).toBe("18c9c8a2-dbb9-423c-9eac-dee75b4cb967")
    expect(payload.totalGB).toBe(9663676416)
    expect(payload).not.toHaveProperty("up")
    expect(payload).not.toHaveProperty("total")
  })
})
