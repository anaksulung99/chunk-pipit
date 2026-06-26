export type ParsedCookie = {
  key: string
  value: string
  domain: string | null
  path: string | null
  expires: number | null
  httpOnly: boolean | null
  secure: boolean | null
  sameSite: string | null
}

/**
 * Parse a pasted cookie JSON. Accepts a raw array, a `{ cookies: [...] }`
 * wrapper, EditThisCookie / Cookie-Editor exports, and Playwright's format —
 * normalising `name|key`, `expirationDate|expires`, casing of httpOnly/sameSite.
 */
export function parseCookies(input: string): ParsedCookie[] {
  let data: unknown
  try {
    data = JSON.parse(input)
  } catch {
    return []
  }

  const arr: any[] = Array.isArray(data)
    ? data
    : Array.isArray((data as any)?.cookies)
      ? (data as any).cookies
      : []

  const out: ParsedCookie[] = []
  for (const c of arr) {
    const key = c?.name ?? c?.key
    if (!key || c?.value === null) continue
    const expiresRaw = c.expirationDate ?? c.expires ?? null
    out.push({
      key: String(key),
      value: String(c.value),
      domain: c.domain ?? null,
      path: c.path ?? null,
      expires:
        expiresRaw !== null && !Number.isNaN(Number(expiresRaw))
          ? Math.floor(Number(expiresRaw))
          : null,
      httpOnly: c.httpOnly ?? c.httponly ?? null,
      secure: c.secure ?? null,
      sameSite: c.sameSite ?? c.samesite ?? null,
    })
  }
  return out
}

/** Facebook user id lives in the `c_user` cookie. */
export function extractFbUserId(cookies: ParsedCookie[]): string | null {
  return cookies.find((c) => c.key === 'c_user')?.value ?? null
}
