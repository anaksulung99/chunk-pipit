import net from 'node:net'

/**
 * Find a free TCP port on 127.0.0.1. Tries `preferred` first; if it's taken,
 * falls back to an OS-assigned random port.
 */
export function findFreePort(preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const attempt = (port: number, allowFallback: boolean) => {
      const server = net.createServer()
      server.unref()
      server.once('error', () => {
        if (allowFallback) attempt(0, false)
        else reject(new Error('No free port available'))
      })
      server.listen(port, '127.0.0.1', () => {
        const address = server.address()
        const resolved = typeof address === 'object' && address ? address.port : 0
        server.close(() => resolve(resolved))
      })
    }
    attempt(preferred ?? 0, preferred !== undefined)
  })
}
