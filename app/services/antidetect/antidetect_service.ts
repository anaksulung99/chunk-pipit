import { chromium, firefox, webkit, type BrowserType } from 'playwright'
import { type BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import { FingerprintInjector } from 'fingerprint-injector'
import fs from 'node:fs'
import path from 'node:path'
import {
  type AntidetectSession,
  type AntiDetectOption,
  type AntidetectBrowserName,
  type AntidetectOsName,
  type AntidetectBrowserEngine,
  type AntiDetectProxy,
  getWebGLVendor,
} from '#services/antidetect/preset'

export class AntidetectService {
  private fingerprintInjector: FingerprintInjector
  private option: AntiDetectOption
  private session: Map<string, AntidetectSession> = new Map()

  constructor(option: AntiDetectOption) {
    this.option = option
    this.fingerprintInjector = new FingerprintInjector()
  }

  async launchBrowser(): Promise<AntidetectSession> {
    const isMobile =
      this.option?.isMobile ||
      this.option?.deviceType === 'mobile' ||
      this.isMobileDeviceFromFingerprint(this.option)
    const isWebKit = this.option?.engine === 'webkit'

    const browserVersion = this.option?.browserVersion

    const userAgent =
      this.option.userAgent || this.option.rawFingerprint?.fingerprint.navigator?.userAgent || ''
    const timezone = this.option?.timezone || 'Asia/Jakarta'

    const viewport = {
      width: this.option.screenWidth || (isMobile ? 390 : 1366),
      height: this.option.screenHeight || (isMobile ? 844 : 768),
    }

    const launcher = this.engineLauncher(this.option.engine as AntidetectBrowserEngine)

    const proxy = this.normalizeProxy(this.option.proxy)

    const browser = await launcher.launch({
      headless: false,
      executablePath: this.resolveExecutablePath(this.option.engine as AntidetectBrowserEngine),
      args:
        this.option.engine === 'chrome'
          ? this.getBrowserArgs(this.option.engine as AntidetectBrowserEngine)
          : [],
    })
    const extraHTTPHeaders: Record<string, string> = {
      'Accept-Language':
        this.option.rawFingerprint?.headers['accept-language'] ??
        `${this.option.language ?? 'en-US'},en;q=0.9`,
    }

    if (this.option.engine === 'chrome') {
      const majorVersion = browserVersion?.split('.')[0] ?? '120'
      extraHTTPHeaders['Sec-Ch-Ua'] =
        `"Google Chrome";v="${majorVersion}", "Chromium";v="${majorVersion}", "Not?A_Brand";v="24"`
      extraHTTPHeaders['Sec-Ch-Ua-Mobile'] = isMobile ? '?1' : '?0'
      extraHTTPHeaders['Sec-Ch-Ua-Platform'] = this.getSecChUaPlatform(
        this.option.osName as AntidetectOsName
      )
    }

    const context = await browser.newContext({
      viewport,
      userAgent,
      isMobile,
      hasTouch: this.option.hasTouch ?? isMobile,
      deviceScaleFactor: this.option.deviceScaleFactor ?? 1,
      locale: this.option.language ?? 'en-US',
      timezoneId: timezone,
      extraHTTPHeaders,
      ignoreHTTPSErrors: true,
      ...(proxy ? { proxy } : {}),
    })

    await this.fingerprintInjector
      .attachFingerprintToPlaywright(
        context,
        this.option.rawFingerprint as BrowserFingerprintWithHeaders
      )
      .catch(() => {})

    await context.addInitScript(
      this.getClientHintsScript(this.option, this.option.engine as AntidetectBrowserEngine)
    )

    const page = await context.newPage()

    const sessionId = `session_${Date.now()}_${Math.random()}`
    const supportsWheel = !isMobile

    const session: AntidetectSession = {
      browser,
      context,
      timezone,
      userAgent,
      isMobile,
      capabilities: {
        supportsWheel,
        isMobile,
        isWebKit,
      },
      close: async () => {
        await page.close().catch(() => {})
        await context.close().catch(() => {})
        await browser.close().catch(() => {})
        this.session.delete(sessionId)
      },
    }

    this.session.set(sessionId, session)
    return session
  }

  engineLauncher(engine: AntidetectBrowserEngine): BrowserType {
    if (engine === 'firefox') return firefox
    if (engine === 'webkit') return webkit
    return chromium
  }

  private resolveExecutablePath(engine: AntidetectBrowserEngine): string | undefined {
    const browsersDir = path.join(process.cwd(), 'resources', 'browsers')
    const fallbackCandidates =
      engine === 'firefox'
        ? [
            path.join(browsersDir, 'firefox-1522', 'firefox', 'firefox.exe'),
            path.join(browsersDir, 'firefox', 'firefox.exe'),
          ]
        : engine === 'webkit'
          ? [
              path.join(browsersDir, 'webkit-2287', 'Playwright.exe'),
              path.join(browsersDir, 'webkit', 'Playwright.exe'),
            ]
          : [
              path.join(browsersDir, 'chromium-1223', 'chrome-win64', 'chrome.exe'),
              path.join(browsersDir, 'chromium', 'chrome-win64', 'chrome.exe'),
            ]
    const candidates = [
      ...this.findBrowserExecutableCandidates(browsersDir, engine),
      ...fallbackCandidates,
    ]

    return candidates.find((candidate) => fs.existsSync(candidate))
  }

  private findBrowserExecutableCandidates(browsersDir: string, engine: AntidetectBrowserEngine) {
    if (!fs.existsSync(browsersDir)) return []

    const prefixes =
      engine === 'firefox' ? ['firefox-'] : engine === 'webkit' ? ['webkit-'] : ['chromium-']
    const executableParts =
      engine === 'firefox'
        ? ['firefox', 'firefox.exe']
        : engine === 'webkit'
          ? ['Playwright.exe']
          : ['chrome-win64', 'chrome.exe']

    return fs
      .readdirSync(browsersDir, { withFileTypes: true })
      .filter(
        (entry) => entry.isDirectory() && prefixes.some((prefix) => entry.name.startsWith(prefix))
      )
      .map((entry) => path.join(browsersDir, entry.name, ...executableParts))
  }

  private getClientHintsScript(hint: AntiDetectOption, engine: AntidetectBrowserEngine): string {
    const isMobile = hint.isMobile ?? hint.deviceType === 'mobile'
    const browserVersion = hint.browserVersion
    const chromeVersion = browserVersion?.split('.')[0]
    const browsserName = hint.browserName ?? 'chrome'
    const osName = hint.osName ?? 'windows'
    const osPlatform = this.getSecChUaPlatform(hint.osName as AntidetectOsName).replace(/"/g, '')
    const userAgentDataScript =
      engine === 'chrome'
        ? `
      try {
        Object.defineProperty(navigator, 'userAgentData', {
          get: () => ({
            brands: [
              { brand: 'Google Chrome', version: '${chromeVersion ?? '120'}' },
              { brand: 'chrome', version: '${chromeVersion ?? '120'}' },
              { brand: 'Not?A_Brand', version: '24' }
            ],
            mobile: ${isMobile},
            platform: '${osPlatform}',
            getHighEntropyValues: async (hints) => {
              const result = {};
              if (hints.includes('architecture')) result.architecture = 'x86';
              if (hints.includes('model')) result.model = '';
              if (hints.includes('platformVersion')) result.platformVersion = '${hint.osVersion ?? ''}';
              if (hints.includes('uaFullVersion')) result.uaFullVersion = '${browserVersion ?? chromeVersion ?? '120'}';
              if (hints.includes('bitness')) result.bitness = '64';
              if (hints.includes('fullVersionList')) result.fullVersionList = [];
              if (hints.includes('wow64')) result.wow64 = false;
              return result;
            }
          }),
          configurable: true
        });
      } catch(e) {}
    `
        : ''

    return `
      ${userAgentDataScript}

      // Override webdriver
      try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch(e) {}
      try { delete Object.getPrototypeOf(navigator).webdriver; } catch(e) {}

      // Override plugins
      try {
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [
              { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
              { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
              { name: 'Native Client', filename: 'internal-nacl-plugin' }
            ];
            plugins.item = (i) => plugins[i];
            plugins.namedItem = (name) => plugins.find(p => p.name === name);
            return plugins;
          },
          configurable: true
        });
      } catch(e) {}

      // Override languages
      try { Object.defineProperty(navigator, 'languages', { get: () => ['${hint.locale ?? hint.language ?? 'en-US'}', 'en'], configurable: true }); } catch(e) {}

      // Override hardware concurrency
      try { Object.defineProperty(navigator, 'hardwareConcurrency', { get: () => 8, configurable: true }); } catch(e) {}

      // Override device memory
      try { Object.defineProperty(navigator, 'deviceMemory', { get: () => 8, configurable: true }); } catch(e) {}

      // Override WebGL vendor
      try {
        if (typeof WebGLRenderingContext !== 'undefined') {
          const webglVendor = ${JSON.stringify(getWebGLVendor(osName as AntidetectOsName, browsserName as AntidetectBrowserName))};
          const getParameter = WebGLRenderingContext.prototype.getParameter;
          WebGLRenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 37445) return webglVendor.vendor;
            if (parameter === 37446) return webglVendor.renderer;
            return getParameter.call(this, parameter);
          };
        }
      } catch(e) {}

      // Canvas fingerprint noise
      try {
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function(type, quality) {
          try {
            if (this.width > 0 && this.height > 0) {
              const ctx = this.getContext('2d');
              if (ctx) {
                const imageData = ctx.getImageData(0, 0, this.width, this.height);
                for (let i = 0; i < imageData.data.length; i += 4) {
                  if (Math.random() < 0.01) {
                    imageData.data[i] = imageData.data[i] ^ (Math.random() * 4);
                  }
                }
                ctx.putImageData(imageData, 0, 0);
              }
            }
          } catch(e) {}
          return originalToDataURL.call(this, type, quality);
        };
      } catch(e) {}
    `
  }

  private getBrowserArgs(engine: AntidetectBrowserEngine): string[] {
    const commonArgs = [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--disable-features=IsolateOrigins,site-per-process',
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

    if (engine === 'chrome') {
      return commonArgs
    }

    return []
  }

  private getSecChUaPlatform(osName?: AntidetectOsName): string {
    switch (osName) {
      case 'windows':
        return '"Windows"'
      case 'macos':
        return '"macOS"'
      case 'linux':
        return '"Linux"'
      case 'android':
        return '"Android"'
      case 'ios':
        return '"iOS"'
      default:
        return '"Windows"'
    }
  }

  resolveOs(osName?: string): string[] {
    if (!osName) return ['windows', 'macos', 'linux']
    const n = osName.toLowerCase()
    if (n.includes('windows')) return ['windows']
    if (n.includes('mac') || n.includes('darwin')) return ['macos']
    if (n.includes('android')) return ['android']
    if (n.includes('ios')) return ['ios']
    return ['linux']
  }

  resolveBrowserEngine(browserName?: AntidetectBrowserName): AntidetectBrowserEngine {
    switch (browserName) {
      case 'chrome':
      case 'chrome_mobile':
      case 'edge':
        return 'chrome'
      case 'firefox':
      case 'firefox_mobile':
        return 'firefox'
      case 'safari':
      case 'safari_mobile':
        return 'webkit'
      default:
        return 'chrome'
    }
  }

  resolveBrowser(engine: AntidetectBrowserEngine, browserName?: string): string[] {
    if (browserName) {
      const b = browserName.toLowerCase()
      if (b.includes('firefox')) return ['firefox']
      if (b.includes('safari')) return ['safari']
      if (b.includes('edge')) return ['edge']
      return ['chrome']
    }
    if (engine === 'firefox') return ['firefox']
    if (engine === 'webkit') return ['safari']
    return ['chrome']
  }

  private normalizeProxy(proxy?: AntiDetectProxy) {
    if (!proxy?.host) return undefined
    return {
      server: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
      username: proxy.username ? encodeURIComponent(proxy.username) : undefined,
      password: proxy.password ? encodeURIComponent(proxy.password) : undefined,
    }
  }

  private isMobileDeviceFromFingerprint(fingerprint: any): boolean {
    return (
      fingerprint?.navigator?.userAgent?.includes('Mobile') ||
      fingerprint?.navigator?.userAgent?.includes('Android') ||
      fingerprint?.navigator?.userAgent?.includes('iPhone')
    )
  }

  async closeAll(): Promise<void> {
    const closePromises = Array.from(this.session.values()).map((s) => s.close())
    await Promise.all(closePromises)
    this.session.clear()
  }
}
