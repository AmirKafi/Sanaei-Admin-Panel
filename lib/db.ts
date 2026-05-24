import { prisma } from "./prisma"

// export prisma for direct access
export { prisma }

export async function getSetting(key: string): Promise<string | null> {
  const row = await prisma.setting.findUnique({ where: { key } })
  return row ? row.value : null
}

export async function upsertSetting(key: string, value: string) {
  await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  })
}
