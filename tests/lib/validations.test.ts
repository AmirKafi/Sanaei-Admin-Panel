import { describe, expect, it } from "vitest"
import { createClientSchema, migrateClientsSchema, loginSchema } from "@/lib/validations"

describe("loginSchema", () => {
  it("requires username and password", () => {
    expect(loginSchema.safeParse({ username: "", password: "x" }).success).toBe(false)
    expect(loginSchema.safeParse({ username: "admin", password: "secret" }).success).toBe(true)
  })
})

describe("createClientSchema", () => {
  it("requires name, quota, and inbounds", () => {
    expect(
      createClientSchema.safeParse({ name: "a", totalQuota: 1024, inboundIds: [1] }).success
    ).toBe(true)
    expect(createClientSchema.safeParse({ name: "", totalQuota: 0, inboundIds: [] }).success).toBe(
      false
    )
  })
})

describe("migrateClientsSchema", () => {
  it("allows sync without target inbound", () => {
    expect(
      migrateClientsSchema.safeParse({ sourceInboundId: 1, action: "sync" }).success
    ).toBe(true)
  })

  it("requires target for migrate", () => {
    expect(
      migrateClientsSchema.safeParse({ sourceInboundId: 1, action: "migrate" }).success
    ).toBe(false)
  })

  it("accepts multiple target inbounds", () => {
    expect(
      migrateClientsSchema.safeParse({
        sourceInboundId: 1,
        targetInboundIds: [2, 3],
        action: "sync-and-migrate",
      }).success
    ).toBe(true)
  })
})
