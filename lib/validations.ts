import { z } from "zod"

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
})

export const settingsPatchSchema = z.object({
  panelUrl: z.string().min(1, "panelUrl is required").url("panelUrl must be a valid URL"),
  username: z.string().min(1, "username is required"),
  password: z.string().min(1, "password is required"),
  checkIntervalSeconds: z.coerce.number().int().min(10, "checkIntervalSeconds must be at least 10"),
  adminUsername: z.string().min(1).optional(),
  adminPassword: z.string().min(8).optional(),
})

export const createClientSchema = z.object({
  name: z.string().min(1, "name is required"),
  email: z.string().optional(),
  totalQuota: z.coerce.number().positive("totalQuota must be positive"),
  inboundIds: z.array(z.coerce.number().int().positive()).min(1, "at least one inbound is required"),
})

const nameAffixSchema = z.enum(["none", "prefix", "postfix"])

export const migrateClientsSchema = z
  .object({
    sourceInboundId: z.coerce.number().int().positive(),
    targetInboundId: z.coerce.number().int().positive().optional(),
    targetInboundIds: z.array(z.coerce.number().int().positive()).min(1).optional(),
    action: z
      .enum(["migrate", "sync", "sync-and-migrate", "preview", "dry-run"])
      .optional()
      .default("migrate"),
    nameAffix: nameAffixSchema.optional().default("postfix"),
    addPostfix: z.boolean().optional(),
    skipExisting: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    const needsTarget = data.action !== "sync"
    const hasTarget =
      !!data.targetInboundId || (data.targetInboundIds && data.targetInboundIds.length > 0)
    if (needsTarget && !hasTarget) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "targetInboundId or targetInboundIds is required for this action",
        path: ["targetInboundId"],
      })
    }
  })

export const clientPatchSchema = z
  .object({
    name: z.string().min(1).optional(),
    totalQuota: z.coerce.number().nonnegative().optional(),
    enabled: z.boolean().optional(),
    expiryTime: z.string().nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  })

export const clientActionSchema = z.object({
  action: z.enum(["disable", "migrate"]),
})

export const clientMigrateSchema = z.object({
  targetInboundId: z.coerce.number().int().positive("targetInboundId must be a positive integer"),
})
