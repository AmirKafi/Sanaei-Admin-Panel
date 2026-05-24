import { getSetting } from "@/lib/db"

const ADMIN_USERNAME_KEY = "adminUsername"
const ADMIN_PASSWORD_KEY = "adminPassword"

export async function getAdminUsername(): Promise<string> {
  const fromDb = await getSetting(ADMIN_USERNAME_KEY)
  if (fromDb?.trim()) return fromDb.trim()
  return process.env.ADMIN_USERNAME?.trim() || "admin"
}

export async function getAdminPassword(): Promise<string> {
  const fromDb = await getSetting(ADMIN_PASSWORD_KEY)
  if (fromDb) return fromDb
  return process.env.ADMIN_PASSWORD?.trim() || ""
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  const expectedUser = await getAdminUsername()
  const expectedPass = await getAdminPassword()
  if (!expectedPass) return false
  return username === expectedUser && password === expectedPass
}

export async function hasAdminPasswordConfigured(): Promise<boolean> {
  const pass = await getAdminPassword()
  return pass.length > 0
}
