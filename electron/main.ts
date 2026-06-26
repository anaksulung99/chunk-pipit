import { app, BrowserWindow, ipcMain, shell, nativeImage, session } from 'electron'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'
import { execFile } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const appName = process.env['VITE_APP_NAME'] || 'Facebook Automation'
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
const isLocalDev = !app.isPackaged

if (isLocalDev) {
  process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'
}

/* -------------------------------------------------------------------------- */
/* Paths & app data                                                           */
/* -------------------------------------------------------------------------- */

app.setName(appName)

const appDataRoot = isLocalDev
  ? path.join(process.env.APP_ROOT, '.electron')
  : process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, app.getName())
    : path.join(app.getPath('temp'), app.getName())
const logsRoot = path.join(appDataRoot, 'logs')

fs.mkdirSync(appDataRoot, { recursive: true })
fs.mkdirSync(logsRoot, { recursive: true })

app.setPath('userData', appDataRoot)
app.setPath('logs', logsRoot)

const publicDir = isLocalDev ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST
const appIcon = nativeImage.createFromPath(path.join(publicDir, 'favicon.ico'))

let win: BrowserWindow | null = null
let services: { apiUrl: string; stop: () => Promise<void> } | null = null

/* -------------------------------------------------------------------------- */
/* Environment                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Loads env so the main process knows where the AdonisJS server is (APP_URL).
 * Prod: bundled `app.env` in resources. Dev: the repo root `.env`.
 */
function loadAppEnv() {
  const envFile = app.isPackaged
    ? path.join(process.resourcesPath, 'app.env')
    : path.join(process.env.APP_ROOT, '.env')

  if (!fs.existsSync(envFile)) return

  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

function appServerUrl(): string {
  const rawUrl = process.env.APP_SERVER_URL || process.env.APP_URL || 'http://127.0.0.1:3333'

  try {
    const url = new URL(rawUrl)
    if (url.hostname === 'localhost') {
      url.hostname = '127.0.0.1'
    }
    return url.toString().replace(/\/$/, '')
  } catch {
    return rawUrl
  }
}

/* -------------------------------------------------------------------------- */
/* Device identity (license binding)                                          */
/* -------------------------------------------------------------------------- */

function getDeviceSalt(): string {
  const deviceFile = path.join(appDataRoot, 'device.json')
  try {
    const existing = JSON.parse(fs.readFileSync(deviceFile, 'utf8')) as { salt?: string }
    if (existing.salt) return existing.salt
  } catch {
    // fall through and regenerate
  }
  const salt = crypto.randomBytes(16).toString('hex')
  fs.writeFileSync(deviceFile, JSON.stringify({ salt }, null, 2))
  return salt
}

function mapOs(platform: string): string {
  if (platform === 'win32') return 'windows'
  if (platform === 'darwin') return 'macos'
  if (platform === 'linux') return 'linux'
  return platform
}

/**
 * Stable per-machine identity: hashes hardware/user signals + a persisted salt.
 * Survives restarts, changes on a different machine — the basis for the
 * "1 license · 1 device" binding.
 */
function computeDevice() {
  const base = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.cpus()?.[0]?.model ?? '',
    os.userInfo().username,
  ].join('|')

  return {
    id: crypto.createHash('sha256').update(`${base}|${getDeviceSalt()}`).digest('hex'),
    name: `${os.hostname()} (${os.platform()} ${os.arch()})`,
    os: mapOs(os.platform()),
    osVersion: os.release(),
    appVersion: app.getVersion(),
  }
}

/* -------------------------------------------------------------------------- */
/* Activation credential store (license key)                                  */
/* -------------------------------------------------------------------------- */

const activationFile = path.join(appDataRoot, 'activation.json')

function readActivationStore(): { licenseKey?: string } {
  try {
    return JSON.parse(fs.readFileSync(activationFile, 'utf8')) as { licenseKey?: string }
  } catch {
    return {}
  }
}

/* -------------------------------------------------------------------------- */
/* Playwright runtime                                                         */
/* -------------------------------------------------------------------------- */

function playwrightBrowsersPath(): string {
  return isLocalDev
    ? path.join(process.env.APP_ROOT, 'resources', 'browsers')
    : path.join(process.resourcesPath, 'browsers')
}

/* -------------------------------------------------------------------------- */
/* IPC handlers                                                               */
/* -------------------------------------------------------------------------- */

ipcMain.handle('app:get-info', () => ({
  version: app.getVersion(),
  platform: process.platform,
  isDev: isLocalDev,
}))

// Back-compat shape used by window.electronAPI.getDeviceInfo().
ipcMain.handle('get-device-info', () => {
  const device = computeDevice()
  return { deviceId: device.id, deviceName: device.name }
})

// Synchronous variant so the preload can expose window.__APP_DEVICE__ before
// the renderer's scripts run (used by the activation page).
ipcMain.on('get-device-info-sync', (event) => {
  event.returnValue = computeDevice()
})

ipcMain.handle('activation:get-stored', () => readActivationStore())
ipcMain.handle('activation:set-stored', (_event, data: { licenseKey?: string }) => {
  const next = { ...readActivationStore(), ...(data ?? {}) }
  fs.writeFileSync(activationFile, JSON.stringify(next, null, 2))
  return next
})
ipcMain.handle('activation:clear-stored', () => {
  try {
    fs.rmSync(activationFile, { force: true })
  } catch {
    // ignore
  }
  return {}
})

ipcMain.handle('check-runtime-requirements', async () => {
  const node = await new Promise<{ installed: boolean; version?: string; message?: string }>(
    (resolve) => {
      execFile('node', ['--version'], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
        if (error) resolve({ installed: false, message: 'Node.js is not available in PATH.' })
        else resolve({ installed: true, version: stdout.trim() })
      })
    }
  )

  const browsers = { chromium: false, firefox: false, webkit: false }
  let playwrightInstalled = false
  let playwrightMessage: string | undefined

  try {
    process.env.PLAYWRIGHT_BROWSERS_PATH = playwrightBrowsersPath()
    const pw = await import('playwright')
    playwrightInstalled = true
    browsers.chromium = fs.existsSync(pw.chromium.executablePath())
    browsers.firefox = fs.existsSync(pw.firefox.executablePath())
    browsers.webkit = fs.existsSync(pw.webkit.executablePath())
  } catch (error) {
    playwrightMessage = error instanceof Error ? error.message : String(error)
  }

  return {
    node,
    playwright: {
      installed: playwrightInstalled,
      browsers,
      allBrowsersInstalled: browsers.chromium && browsers.firefox && browsers.webkit,
      message: playwrightMessage,
    },
  }
})

/* -------------------------------------------------------------------------- */
/* Window                                                                     */
/* -------------------------------------------------------------------------- */

function isSafeExternalUrl(value: string): boolean {
  try {
    return ['https:', 'http:', 'mailto:', 'tel:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function createWindow() {
  const targetUrl = appServerUrl()

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 640,
    icon: appIcon,
    backgroundColor: '#020617',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      webSecurity: true,
      webviewTag: false,
      devTools: isLocalDev,
    },
  })

  // Open external links in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    const appUrl = appServerUrl()
    if (!url.startsWith(appUrl)) {
      event.preventDefault()
      if (isSafeExternalUrl(url)) void shell.openExternal(url)
    }
  })
  win.webContents.on('will-attach-webview', (event) => event.preventDefault())

  win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(['media', 'notifications'].includes(permission))
  })

  // The renderer is the AdonisJS + Inertia app served over HTTP, so sessions,
  // cookies and the activation gate work. Dev: `ace serve` on :3333.
  // Prod: the local sidecar API port (wired in a later step).
  void win.loadURL(targetUrl)
}

/* -------------------------------------------------------------------------- */
/* App lifecycle                                                              */
/* -------------------------------------------------------------------------- */

// Single instance: focus the existing window instead of spawning a second one.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    loadAppEnv()

    // In dev we preserve cookies so route/server reloads do not appear as
    // surprise logouts. Packaged builds may still enforce a fresh online
    // verification cycle on launch.
    if (app.isPackaged) {
      try {
        await session.defaultSession.clearStorageData({ storages: ['cookies'] })
      } catch (err) {
        console.error('[main] Failed to clear session cookies:', (err as Error).message)
      }
    }

    // Production: boot the local sidecar (portable Redis + AdonisJS API + worker)
    // and point the window at its API port. Dev uses `ace serve` on :3333.
    if (app.isPackaged) {
      try {
        const { startServices } = await import('./services/service_supervisor.js')
        const started = await startServices()
        services = started
        process.env.APP_SERVER_URL = started.apiUrl
      } catch (err) {
        console.error('[main] Failed to start sidecar services:', (err as Error).message)
      }
    }

    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('before-quit', async (event) => {
  // Graceful shutdown of the sidecar (worker → API → Redis) before quitting.
  if (services) {
    event.preventDefault()
    const pending = services
    services = null
    try {
      await pending.stop()
    } catch (err) {
      console.error('[main] Sidecar shutdown error:', (err as Error).message)
    }
    app.quit()
  }
})
