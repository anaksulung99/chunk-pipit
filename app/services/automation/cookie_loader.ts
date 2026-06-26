import AccountCookie from '#models/account_cookie'
import encryption from '@adonisjs/core/services/encryption'

export type PlaywrightCookie = {
  name: string
  value: string
  domain?: string
  path?: string
  expires?: number
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

function normalizeSameSite(value: string | null): 'Strict' | 'Lax' | 'None' | undefined {
  if (!value) return undefined
  const s = value.toLowerCase()
  if (s.includes('strict')) return 'Strict'
  if (s.includes('lax')) return 'Lax'
  if (s.includes('none') || s === 'no_restriction') return 'None'
  return undefined
}

/**
 * Load an account's cookies from the DB, decrypt each value (AES, at rest),
 * and shape them for Playwright's `context.addCookies()`.
 */
export async function loadPlaywrightCookies(accountId: string): Promise<PlaywrightCookie[]> {
  const rows = await AccountCookie.query().where('account_id', accountId)

  const cookies: PlaywrightCookie[] = []
  for (const row of rows) {
    let value: string | null
    try {
      value = encryption.decrypt<string>(row.value)
    } catch {
      value = null
    }
    if (value === null) continue

    const cookie: PlaywrightCookie = { name: row.key, value }
    if (row.domain) cookie.domain = row.domain
    if (row.path) cookie.path = row.path
    if (row.expires !== null && row.expires !== undefined) cookie.expires = Number(row.expires)
    if (row.httpOnly !== null) cookie.httpOnly = row.httpOnly
    if (row.secure !== null) cookie.secure = row.secure
    const sameSite = normalizeSameSite(row.sameSite)
    if (sameSite) cookie.sameSite = sameSite

    cookies.push(cookie)
  }

  return cookies
}
