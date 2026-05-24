import { cookies } from "next/headers"
import type { NextRequest } from "next/server"

export const SESSION_COOKIE = "sanaei_admin_session"
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7

export type SessionPayload = {
  sub: string
  exp: number
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET must be set (min 16 characters)")
  }
  return secret
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/")
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4))
  const binary = atob(padded + pad)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))
  return toBase64Url(new Uint8Array(signature))
}

async function hmacVerify(message: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )
  try {
    return await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(message)
    )
  } catch {
    return false
  }
}

export async function createSessionToken(username: string): Promise<string> {
  const secret = getSecret()
  const payload: SessionPayload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  }
  const payloadPart = toBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await hmacSign(payloadPart, secret)
  return `${payloadPart}.${signature}`
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null
  const [payloadPart, signature] = token.split(".")
  if (!payloadPart || !signature) return null

  let secret: string
  try {
    secret = getSecret()
  } catch {
    return null
  }

  const valid = await hmacVerify(payloadPart, signature, secret)
  if (!valid) return null

  try {
    const json = new TextDecoder().decode(fromBase64Url(payloadPart))
    const payload = JSON.parse(json) as SessionPayload
    if (!payload?.sub || !payload?.exp) return null
    if (payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  }
}

export async function getSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  return verifySessionToken(token)
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const store = await cookies()
  return verifySessionToken(store.get(SESSION_COOKIE)?.value)
}

export function isAuthConfigured(): boolean {
  try {
    getSecret()
    return true
  } catch {
    return false
  }
}
