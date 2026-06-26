const PROTOCOLS = ['http', 'https', 'socks4', 'socks5'] as const

export type ParsedProxy = {
  protocol: (typeof PROTOCOLS)[number]
  host: string
  port: number
  username: string | null
  password: string | null
}

/**
 * Parse one proxy line. Accepts:
 *
 * - proto://user:pass@host:port
 * - proto://host:port
 * - host:port (defaults http)
 * - proto://host:port:user:pass
 * - host:port:user:pass (defaults http)
 *
 * Returns null for blank/invalid lines.
 */
export function parseProxyLine(line: string): ParsedProxy | null {
  let value = line.trim()
  if (!value) return null

  const protocolMatch = value.match(/^([a-z0-9]+):\/\//i)
  const protocol = protocolMatch
    ? (protocolMatch[1].toLowerCase() as ParsedProxy['protocol'])
    : 'http'

  if (!(PROTOCOLS as readonly string[]).includes(protocol)) return null

  const valueWithoutProtocol = protocolMatch ? value.slice(protocolMatch[0].length) : value

  /**
   * Supports proxy provider format:
   *
   *   protocol://host:port:username:password
   *
   * This is not a valid URL because credentials are not placed before "@",
   * so it must be parsed before using the URL constructor.
   */
  if (!valueWithoutProtocol.includes('@')) {
    const parts = valueWithoutProtocol.split(':')

    if (parts.length >= 4) {
      const [host, portValue, username, ...passwordParts] = parts
      const port = Number(portValue)

      if (
        host &&
        username &&
        passwordParts.length &&
        Number.isInteger(port) &&
        port >= 1 &&
        port <= 65535
      ) {
        return {
          protocol,
          host,
          port,
          username,
          password: passwordParts.join(':'),
        }
      }

      return null
    }
  }

  if (!/:\/\//.test(value)) value = `http://${value}`

  try {
    const url = new URL(value)
    const urlProtocol = url.protocol.replace(':', '') as ParsedProxy['protocol']
    if (!(PROTOCOLS as readonly string[]).includes(urlProtocol)) return null
    if (!url.hostname || !url.port) return null

    const port = Number(url.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) return null

    return {
      protocol: urlProtocol,
      host: url.hostname,
      port,
      username: url.username ? decodeURIComponent(url.username) : null,
      password: url.password ? decodeURIComponent(url.password) : null,
    }
  } catch {
    return null
  }
}
