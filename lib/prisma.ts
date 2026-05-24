import { PrismaClient } from "@prisma/client"

const _global = globalThis as unknown as { __prisma?: PrismaClient }

export const prisma: PrismaClient = _global.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === "development" 
    ? ["query", "info", "warn", "error"]
    : ["warn", "error"],
})

if (process.env.NODE_ENV !== "production") _global.__prisma = prisma

export default prisma
