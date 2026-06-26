export type ParsedGroup = {
  groupId: string
  groupName: string | null
  groupUrl: string | null
}
export type ParsedProfile = {
  profileId: string
  profileName: string | null
  profileUrl: string | null
}

/**
 * Parse one pasted group line. Accepts:
 *   - a Facebook group URL (…facebook.com/groups/<id-or-slug>)
 *   - a bare group id / slug
 *   - "id|name" or "id,name" (pipe / comma / tab separated)
 */
export function parseGroupLine(line: string): ParsedGroup | null {
  const s = line.trim()
  if (!s) return null

  const url = s.match(/facebook\.com\/groups\/([^/?#\s]+)/i)
  if (url) {
    return {
      groupId: decodeURIComponent(url[1]),
      groupName: null,
      groupUrl: s.startsWith('http') ? s : `https://${s}`,
    }
  }

  const parts = s.split(/[|,\t]/).map((p) => p.trim())
  const id = parts[0]
  if (/^[a-zA-Z0-9._-]+$/.test(id)) {
    return { groupId: id, groupName: parts[1] || null, groupUrl: null }
  }
  return null
}

export function parseProfileLine(line: string): ParsedProfile | null {
  const s = line.trim()
  if (!s) return null

  const parts = s.split(/[|,\t]/).map((p) => p.trim())
  const id = parts[0]
  if (/^[a-zA-Z0-9._-]+$/.test(id)) {
    return { profileId: id, profileName: parts[1] || null, profileUrl: null }
  }
  return null
}
