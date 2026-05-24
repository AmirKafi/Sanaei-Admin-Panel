import { describe, expect, it } from "vitest"
import {
  buildMigratedClientEmail,
  bytesToPanelTotalGB,
  normalizeQuotaToBytes,
  resolvePanelClientQuotaBytes,
} from "@/lib/quota"

describe("normalizeQuotaToBytes", () => {
  it("treats small values as gigabytes", () => {
    expect(normalizeQuotaToBytes(1)).toBe(1024 ** 3)
    expect(normalizeQuotaToBytes(5)).toBe(5 * 1024 ** 3)
  })

  it("treats large values as bytes", () => {
    expect(normalizeQuotaToBytes(1024 ** 3)).toBe(1024 ** 3)
  })
})

describe("quotaBytesToPanelTotalField", () => {
  it("passes quota through as bytes for the panel totalGB field", () => {
    expect(bytesToPanelTotalGB(500 * 1024 ** 2)).toBe(500 * 1024 ** 2)
    expect(bytesToPanelTotalGB(2 * 1024 ** 3)).toBe(2 * 1024 ** 3)
  })

  it("returns 0 for zero bytes", () => {
    expect(bytesToPanelTotalGB(0)).toBe(0)
  })
})

describe("buildMigratedClientEmail", () => {
  it("appends short inbound id when postfix enabled", () => {
    expect(buildMigratedClientEmail("user@test", "Inbound 2", 5, "postfix")).toBe("user@test-ib5")
    expect(buildMigratedClientEmail("user@test", "Inbound 2", 5, true)).toBe("user@test-ib5")
  })

  it("prepends short inbound id when prefix mode", () => {
    expect(buildMigratedClientEmail("miti", "Inbound 2", 5, "prefix")).toBe("ib5-miti")
  })

  it("returns base email when affix is none", () => {
    expect(buildMigratedClientEmail("user@test", "Inbound 2", 5, "none")).toBe("user@test")
    expect(buildMigratedClientEmail("user@test", "Inbound 2", 5, false)).toBe("user@test")
  })
})

describe("resolvePanelClientQuotaBytes", () => {
  it("prefers stats.total as bytes", () => {
    expect(resolvePanelClientQuotaBytes({ total: 1024 ** 3 }, {})).toBe(1024 ** 3)
  })

  it("reads totalGB from settings as bytes", () => {
    expect(resolvePanelClientQuotaBytes({}, { totalGB: 2 * 1024 ** 3 })).toBe(2 * 1024 ** 3)
  })
})
