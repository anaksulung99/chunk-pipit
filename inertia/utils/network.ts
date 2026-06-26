export class NetworkHelper {
  /**
   * Cek apakah berjalan di environment Electron
   */
  private static isElectron(): boolean {
    return (
      typeof window !== 'undefined' && typeof window.electronAPI?.checkConnection === 'function'
    )
  }

  /**
   * Cek apakah device terhubung ke internet
   */
  static async checkConnection(): Promise<boolean> {
    if (this.isElectron()) {
      try {
        return Boolean(window.electronAPI?.checkConnection())
      } catch {
        return this.checkConnectionBrowser()
      }
    }

    return this.checkConnectionBrowser()
  }

  /**
   * Cek koneksi menggunakan browser API
   */
  private static async checkConnectionBrowser(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.onLine) {
      return false
    }

    return true
  }

  /**
   * Monitor perubahan status koneksi
   */
  static onConnectionChange(callback: (isOnline: boolean) => void): () => void {
    const handleOnline = (): void => {
      this.checkConnection().then(callback)
    }

    const handleOffline = (): void => {
      callback(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Return cleanup function
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }

  /**
   * Mendapatkan informasi jaringan detail (khusus Electron)
   */
  static async getNetworkInfo(): Promise<NetworkInfo> {
    const isOnline = await this.checkConnection()

    const info: NetworkInfo = {
      online: isOnline,
      type: isOnline ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    }

    if (this.isElectron()) {
      try {
        const result = await window.electronAPI?.getNetworkInfo()

        if (result) {
          info.online = result.online
          info.type = result.online ? 'connected' : 'disconnected'
          info.networkInterfaces = Object.entries(
            result.interfaces as Record<
              string,
              Array<{ family: string; address: string; mac: string }> | null
            >
          ).flatMap(([name, nets]) => {
            if (!nets) return []
            return nets
              .filter((net) => net.family === 'IPv4')
              .map((net) => ({
                name,
                address: net.address,
                mac: net.mac,
              }))
          })
        }
      } catch {
        // Ignore if not available
      }
    }

    return info
  }

  /**
   * Retry mechanism untuk operasi yang membutuhkan koneksi
   */
  static async withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2 } = options

    let lastError: Error | null = null

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const isOnline = await this.checkConnection()
        if (!isOnline) {
          throw new Error('No internet connection')
        }

        return await operation()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        if (attempt < maxRetries - 1) {
          const waitTime = delayMs * Math.pow(backoffMultiplier, attempt)
          await new Promise((resolve) => setTimeout(resolve, waitTime))
        }
      }
    }

    throw lastError
  }
}

export default NetworkHelper
