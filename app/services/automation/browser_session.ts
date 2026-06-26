import fs from 'node:fs'
import path from 'node:path'
import {
  chromium as playwrightChromium,
  type Browser,
  type BrowserContext,
  type Page,
} from 'playwright'
import { chromium } from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'
import { FingerprintInjector } from 'fingerprint-injector'
import type { Fingerprint, Headers, BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import type { PlaywrightCookie } from '#services/automation/cookie_loader'

// Anti-detection evasions (navigator.webdriver, chrome runtime, plugins, …).
chromium.use(StealthPlugin())

export type ProxyConfig = {
  protocol: string
  host: string
  port: number
  username?: string | null
  password?: string | null
}

export type LaunchOptions = {
  cookies: PlaywrightCookie[]
  /** Raw fingerprint-generator output `{ fingerprint, headers }` (jsonb). */
  rawFingerprint?: { fingerprint?: Fingerprint; headers?: Headers } | null
  proxy?: ProxyConfig | null
  headless?: boolean
  osType?: 'windows' | 'linux' | 'macos'
  browserType?: 'chrome' | 'firefox' | 'safari' | 'edge'
  advanceMode?: boolean
  locale?: string
  timezone?: string
}

export type Session = { browser: Browser; context: BrowserContext; page: Page }

/**
 * Resolve a bundled chromium executable. The Playwright npm version may expect
 * a different browser revision than what is bundled in resources/browsers, so
 * we scan for any bundled "chromium-<rev>" dir and use its chrome binary. Returns
 * undefined to fall back to Playwright's own resolution.
 */
export function resolveChromiumPath(): string | undefined {
  // Prefer Playwright's own installed browser — it matches the expected revision.
  try {
    const ep = playwrightChromium.executablePath()
    if (ep && fs.existsSync(ep)) return undefined
  } catch {
    // not installed — fall through to a bundled binary
  }

  const root = process.env.APP_ROOT || process.cwd()
  const browsersDir = path.join(root, 'resources', 'browsers')
  try {
    const dirs = fs
      .readdirSync(browsersDir)
      .filter((d) => d.startsWith('chromium-'))
      .sort()
      .reverse()
    for (const dir of dirs) {
      for (const candidate of [
        path.join(browsersDir, dir, 'chrome-win64', 'chrome.exe'),
        path.join(browsersDir, dir, 'chrome-linux', 'chrome'),
        path.join(browsersDir, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
      ]) {
        if (fs.existsSync(candidate)) return candidate
      }
    }
  } catch {
    // resources/browsers not present — fall back to default
  }
  return undefined
}

function proxyServer(proxy: ProxyConfig): { server: string; username?: string; password?: string } {
  return {
    server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
    username: proxy.username ?? undefined,
    password: proxy.password ?? undefined,
  }
}

/**
 * Launch an isolated browser session with cookies + fingerprint + proxy
 * injected. Throws if no usable chromium binary is available (caller decides
 * how to surface that).
 */
export async function launchSession(options: LaunchOptions): Promise<Session> {
  const executablePath = resolveChromiumPath()

  const { fingerprint, headers } = options.rawFingerprint || {}

  const userAgent = fingerprint?.navigator?.userAgent || headers?.['user-agent']

  const browser = await chromium.launch({
    headless: options.headless ?? true,
    executablePath,
    args: getBrowserArgs(options.advanceMode ?? false),
    proxy: options.proxy ? proxyServer(options.proxy) : undefined,
  })

  const extraHTTPHeaders: Record<string, string> = {
    'Accept-Language': headers?.['accept-language'] ?? 'id-ID,en;q=0.9',
    'Sec-Ch-Ua': 'Google Chrome";v="141", "Chromium";v="141", "Not?A_Brand";v="8"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': options.osType ? getSecChUaPlatform(options.osType) : '"Windows"',
  }

  const context = await browser.newContext({
    userAgent,
    locale: options.locale ?? 'id-ID',
    timezoneId: options.timezone ?? 'Asia/Jakarta',
    viewport: { width: 1366, height: 768 },
    extraHTTPHeaders,
    proxy: options.proxy ? proxyServer(options.proxy) : undefined,
  })

  // Fingerprint injection (UA, screen, webGL, canvas, client hints).
  if (options.rawFingerprint?.fingerprint) {
    try {
      await new FingerprintInjector().attachFingerprintToPlaywright(
        context,
        options.rawFingerprint as BrowserFingerprintWithHeaders
      )
    } catch {
      // non-fatal — continue without fingerprint override
    }
  }

  // Minimal stealth (stealth plugin not installed): hide webdriver flag.
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined })
  })

  if (options.cookies.length) {
    await context.addCookies(options.cookies as any)
  }

  const page = await context.newPage()
  return { browser, context, page }
}

export type SessionState = 'active' | 'checkpoint' | 'logged_out'

/**
 * Best-effort Facebook session check. Navigates to facebook.com and inspects
 * the resulting URL/markup. Selectors are intentionally loose — validate
 * against a live (throwaway) account, Facebook's DOM changes often.
 */
export async function verifySession(page: Page): Promise<SessionState> {
  await page.goto('https://www.facebook.com/', { waitUntil: 'domcontentloaded', timeout: 60000 })
  const url = page.url()

  if (url.includes('/checkpoint') || url.includes('checkpoint.facebook.com')) return 'checkpoint'
  if (url.includes('/login') || (await page.locator('input[name="pass"]').count()) > 0) {
    return 'logged_out'
  }
  return 'active'
}

export async function closeSession(session: Session): Promise<void> {
  try {
    await session.context.close()
  } catch {
    // ignore
  }
  try {
    await session.browser.close()
  } catch {
    // ignore
  }
}
function getBrowserArgs(isAdvanceMode: boolean): string[] {
  if (isAdvanceMode) {
    return [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-features=BlockInsecurePrivateNetworkRequests',
      '--disable-features=PasswordImport',
      '--disable-sync',
      '--disable-default-apps',
      '--disable-translate',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-component-update',
      '--disable-domain-reliability',
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-notifications',
      '--disable-offer-store-unmasked-wallet-cards',
      '--disable-popup-blocking',
      '--disable-print-preview',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-setuid-sandbox',
      '--disable-speech-api',
      '--disable-wake-on-wifi',
      '--enable-features=NetworkService,NetworkServiceInProcess',
      '--force-color-profile=srgb',
      '--metrics-recording-only',
      '--no-first-run',
      '--no-pings',
      '--no-zygote',
      '--password-store=basic',
      '--use-mock-keychain',
    ]
  }

  return [
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--disable-features=IsolateOrigins,site-per-process',
    '--disable-ipc-flooding-protection',
    '--disable-renderer-backgrounding',
    '--metrics-recording-only',
    '--no-first-run',
  ]
}
function getSecChUaPlatform(osName?: 'windows' | 'linux' | 'macos'): string {
  switch (osName) {
    case 'windows':
      return '"Windows"'
    case 'linux':
      return '"macOS"'
    case 'macos':
      return '"macOS"'
    default:
      return '"Windows"'
  }
}
