import { contextBridge, ipcRenderer, net, clipboard } from 'electron'

type NetworkInterfaces = NodeJS.Dict<import('node:os').NetworkInterfaceInfo[]>

/**
 * The single, typed bridge exposed to the renderer as `window.electronAPI`.
 * Keep this surface small — only what the Inertia app actually consumes.
 */
const electronAPI = {
  isElectron: true as const,

  // Connectivity (consumed by inertia/utils/network.ts).
  checkConnection: (): boolean => net.isOnline(),
  getNetworkInfo: async (): Promise<{ online: boolean; interfaces: NetworkInterfaces }> => {
    let interfaces: NetworkInterfaces = {}
    try {
      const os = await import('node:os')
      interfaces = os.networkInterfaces()
    } catch {
      interfaces = {}
    }
    return { online: net.isOnline(), interfaces }
  },

  // Device & app info.
  getDeviceInfo: (): Promise<{ deviceId: string; deviceName: string }> =>
    ipcRenderer.invoke('get-device-info'),
  getAppInfo: (): Promise<{ version: string; platform: string; isDev: boolean }> =>
    ipcRenderer.invoke('app:get-info'),
  checkRuntimeRequirements: () => ipcRenderer.invoke('check-runtime-requirements'),

  // Activation credential store (license key) for online verify each launch.
  activation: {
    getStored: (): Promise<{ licenseKey?: string }> => ipcRenderer.invoke('activation:get-stored'),
    setStored: (data: { licenseKey?: string }): Promise<{ licenseKey?: string }> =>
      ipcRenderer.invoke('activation:set-stored', data),
    clearStored: (): Promise<unknown> => ipcRenderer.invoke('activation:clear-stored'),
  },

  copyToClipboard: (text: string): void => clipboard.writeText(text),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Expose the stable device identity synchronously so the activation page can
// read window.__APP_DEVICE__ immediately on mount.
try {
  contextBridge.exposeInMainWorld('__APP_DEVICE__', ipcRenderer.sendSync('get-device-info-sync'))
} catch {
  contextBridge.exposeInMainWorld('__APP_DEVICE__', null)
}
