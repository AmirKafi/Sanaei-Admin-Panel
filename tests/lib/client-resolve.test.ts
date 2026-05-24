import { describe, expect, it } from "vitest"
import { stripPanelEmailAffix } from "@/lib/client-resolve"

describe("stripPanelEmailAffix", () => {
  it("strips postfix migration email", () => {
    expect(stripPanelEmailAffix("miti_to_Inbound_2")).toBe("miti")
    expect(stripPanelEmailAffix("user@test_to_ib5")).toBe("user@test")
  })

  it("strips prefix when token is known", () => {
    expect(stripPanelEmailAffix("Inbound_2_miti", ["Inbound_2", "ib5"])).toBe("miti")
  })

  it("returns unchanged when no affix", () => {
    expect(stripPanelEmailAffix("miti")).toBe("miti")
    expect(stripPanelEmailAffix("user@example.com")).toBe("user@example.com")
  })
})
