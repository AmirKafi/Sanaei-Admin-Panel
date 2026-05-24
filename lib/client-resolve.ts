import { prisma } from "./prisma"
import type { Client } from "@prisma/client"
import { sanitizeInboundToken } from "./quota"

/** Legacy migration postfix: `user@x_to_InboundName` */
const LEGACY_POSTFIX_AFFIX_RE = /^(.+)_to_[a-zA-Z0-9_-]+$/
/** Current migration postfix: `user-ib5` */
const SHORT_POSTFIX_AFFIX_RE = /^(.+)-ib\d+$/
/** Manual create postfix: `user_0` */
const MANUAL_POSTFIX_AFFIX_RE = /^(.+)_\d+$/
/** Current migration prefix: `ib5-user` */
const SHORT_PREFIX_AFFIX_RE = /^ib\d+-(.+)$/

/**
 * Strip inbound affix from a panel email (postfix or prefix) to get the logical base email.
 */
export function stripPanelEmailAffix(
  email: string,
  inboundTokens?: string[]
): string {
  const trimmed = email.trim()
  if (!trimmed) return trimmed

  const manualPostfix = trimmed.match(MANUAL_POSTFIX_AFFIX_RE)
  if (manualPostfix?.[1]) return manualPostfix[1]

  const shortPostfix = trimmed.match(SHORT_POSTFIX_AFFIX_RE)
  if (shortPostfix?.[1]) return shortPostfix[1]

  const shortPrefix = trimmed.match(SHORT_PREFIX_AFFIX_RE)
  if (shortPrefix?.[1]) return shortPrefix[1]

  const legacyPostfix = trimmed.match(LEGACY_POSTFIX_AFFIX_RE)
  if (legacyPostfix?.[1]) return legacyPostfix[1]

  if (inboundTokens?.length) {
    for (const token of inboundTokens) {
      if (!token) continue
      const prefix = `${token}_`
      if (trimmed.startsWith(prefix)) {
        return trimmed.slice(prefix.length)
      }
    }
  }

  return trimmed
}

async function loadInboundTokens(tx?: any): Promise<string[]> {
  const db = tx || prisma
  const inbounds = await db.inbound.findMany({
    select: { id: true, remark: true },
  })
  return inbounds.map((ib) => sanitizeInboundToken(ib.remark, ib.id))
}

/**
 * Find the single logical Client for a panel identity (uuid / email / affixed variant).
 * Never creates a row — callers use this before create.
 */
export async function findLogicalClientForPanel(params: {
  uuid?: string | null
  email?: string | null
}, tx?: any): Promise<Client | null> {
  const db = tx || prisma
  const panelUuid = String(params.uuid ?? "").trim()
  const panelEmail = String(params.email ?? "").trim()

  if (panelUuid) {
    const byUuid = await db.client.findUnique({ where: { uuid: panelUuid } })
    if (byUuid) return byUuid
  }

  if (!panelEmail) return null

  const byName = await db.client.findFirst({ where: { name: panelEmail } })
  if (byName) return byName

  const linkByRemote = await db.clientInbound.findFirst({
    where: { remoteEmail: panelEmail },
    include: { client: true },
  })
  if (linkByRemote) return linkByRemote.client

  const tokens = await loadInboundTokens(tx)
  const baseEmail = stripPanelEmailAffix(panelEmail, tokens)
  if (baseEmail && baseEmail !== panelEmail) {
    const byBaseName = await db.client.findFirst({ where: { name: baseEmail } })
    if (byBaseName) return byBaseName

    const linkByBase = await db.clientInbound.findFirst({
      where: {
        OR: [
          { remoteEmail: baseEmail },
          { remoteEmail: { startsWith: `${baseEmail}_` } },
          { remoteEmail: { startsWith: `${baseEmail}-` } },
          { remoteEmail: { endsWith: `_${baseEmail}` } },
          { remoteEmail: { endsWith: `-${baseEmail}` } },
        ],
      },
      include: { client: true },
    })
    if (linkByBase) return linkByBase.client
  }

  return null
}
