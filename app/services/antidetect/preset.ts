import { type Browser, type BrowserContext } from 'playwright'
import { type DateTime } from 'luxon'
import type { BrowserFingerprintWithHeaders } from 'fingerprint-generator'

export type AntiDetectOption = {
  id: string
  name: string
  userId: string
  engine: string
  deviceType: string
  osName: string
  osVersion: string
  browserName: string
  browserVersion: string
  userAgent: string
  language: string
  timezone: string
  locale: string
  proxyId: string | null
  screenHeight: number | null
  screenWidth: number | null
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
  canvasMode: string
  canvasSeed: number | null
  webglVendor: string | null
  webglRenderer: string | null
  hardwareConcurrency: number
  deviceMemory: number | null
  rawFingerprint: BrowserFingerprintWithHeaders | null
  createdAt: DateTime
  updatedAt: DateTime | null
  proxy?: AntiDetectProxy
}

export type AntiDetectProxy = {
  id: string
  userId: string
  host: string
  port: number
  username: string | null
  password: string | null
  protocol: string
  asn: string | null
  country: string | null
  lastCheckedAt: DateTime | null
  responseMs: number | null
  status: string
  createdAt: DateTime
  updatedAt: DateTime | null
}

export type AntidetectSession = {
  browser: Browser
  context: BrowserContext
  timezone: string
  userAgent: string
  isMobile?: boolean
  capabilities?: {
    supportsWheel: boolean
    isMobile: boolean
    isWebKit: boolean
  }
  close: () => Promise<void>
}
export type AntidetectDeviceType = 'desktop' | 'mobile'
export type AntidetectBrowserName =
  | 'firefox'
  | 'chrome'
  | 'safari'
  | 'edge'
  | 'chrome_mobile'
  | 'safari_mobile'
  | 'firefox_mobile'
export type AntidetectOsName = 'windows' | 'linux' | 'macos' | 'android' | 'ios'
export type AntidetectBrowserEngine = 'chrome' | 'firefox' | 'webkit'

export type BrowserCapabilities = {
  supportsWheel: boolean
  isMobile: boolean
  isWebKit: boolean
  isFirefox: boolean
  isChromium: boolean
}

export const DEVICE_OS_MAP: Record<AntidetectDeviceType, AntidetectOsName[]> = {
  desktop: ['windows', 'linux', 'macos'],
  mobile: ['android', 'ios'],
}

export const OS_VERSION_MAP: Record<AntidetectOsName, string[]> = {
  windows: ['11', '10'],
  linux: ['Ubuntu 24.04', 'Ubuntu 22.04', 'Fedora 40', 'Debian 12'],
  macos: ['15', '14', '13'],
  android: ['15', '14', '13', '12'],
  ios: ['18', '17', '16'],
}

export const OS_BROWSER_COMPAT: Record<AntidetectOsName, AntidetectBrowserName[]> = {
  windows: ['chrome', 'firefox', 'edge'],
  linux: ['chrome', 'firefox'],
  macos: ['chrome', 'firefox', 'safari', 'edge'],
  android: ['chrome_mobile', 'firefox_mobile'],
  ios: ['safari_mobile', 'chrome_mobile'],
}

export const BROWSER_VERSION_MAP: Record<AntidetectBrowserName, string[]> = {
  chrome: ['132', '131', '130', '129', '128', '127', '126', '124', '120'],
  firefox: ['134', '133', '131', '128', '125', '121', '120'],
  safari: ['18.3', '18.2', '18.1', '18.0', '17.6', '17.5', '17.4'],
  edge: ['132', '131', '130', '129', '128', '127', '124', '120'],
  chrome_mobile: ['132', '131', '130', '128', '126', '124', '120'],
  safari_mobile: ['18.3', '18.2', '18.1', '18.0', '17.6', '17.5'],
  firefox_mobile: ['134', '133', '131', '128', '125', '121'],
}

export const OS_LABELS: Record<AntidetectOsName, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
  android: 'Android',
  ios: 'iOS',
}

export const BROWSER_LABELS: Record<AntidetectBrowserName, string> = {
  chrome: 'Google Chrome',
  firefox: 'Mozilla Firefox',
  safari: 'Safari (macOS)',
  edge: 'Microsoft Edge',
  chrome_mobile: 'Chrome Mobile',
  safari_mobile: 'Safari Mobile',
  firefox_mobile: 'Firefox Mobile',
}

export const ENGINE_MAP: Record<AntidetectBrowserName, AntidetectBrowserEngine> = {
  chrome: 'chrome',
  firefox: 'firefox',
  safari: 'webkit',
  edge: 'webkit',
  chrome_mobile: 'chrome',
  safari_mobile: 'webkit',
  firefox_mobile: 'firefox',
}

export const VIEWPORT_PRESETS: Record<string, [number, number, number]> = {
  desktop_windows: [1920, 1080, 1],
  desktop_linux: [1920, 1080, 1],
  desktop_macos: [2560, 1600, 2],
  mobile_android: [412, 915, 2.625],
  mobile_ios: [390, 844, 3],
}

export const WEBGL_PRESETS: Record<string, { vendor: string; renderer: string }> = {
  chrome_windows: {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
  chrome_linux: {
    vendor: 'Google Inc. (Mesa)',
    renderer: 'ANGLE (Mesa, AMD Radeon RX 580, OpenGL 4.6)',
  },
  chrome_macos: { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  chrome_mobile_android: {
    vendor: 'Qualcomm',
    renderer: 'Adreno (TM) 740',
  },
  safari_mobile_ios: { vendor: 'Apple Inc.', renderer: 'Apple A16 GPU' },
  firefox_windows: {
    vendor: 'NVIDIA Corporation',
    renderer: 'GeForce RTX 3060/PCIe/SSE2',
  },
  firefox_linux: {
    vendor: 'Mesa/X.org',
    renderer: 'AMD Radeon RX 580 (POLARIS10, DRM 3.42.0)',
  },
  firefox_macos: { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  safari_macos: { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  edge_windows: {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
}

export function getViewport(
  deviceType: AntidetectDeviceType,
  osName: AntidetectOsName
): { width: number; height: number; deviceScaleFactor: number } {
  let presetKey = `${deviceType}_${osName}`

  if (deviceType === 'desktop') {
    if (osName === 'windows') presetKey = 'desktop_windows'
    else if (osName === 'linux') presetKey = 'desktop_linux'
    else presetKey = 'desktop_macos'
  } else {
    if (osName === 'android') presetKey = 'mobile_android'
    else presetKey = 'mobile_ios'
  }

  const preset = VIEWPORT_PRESETS[presetKey]
  return {
    width: preset?.[0] ?? 1366,
    height: preset?.[1] ?? 768,
    deviceScaleFactor: preset?.[2] ?? 1,
  }
}

export function getWebGLVendor(
  osName: AntidetectOsName,
  browserName: AntidetectBrowserName
): { vendor: string; renderer: string } {
  let key = `${browserName}_${osName}`

  if (browserName === 'chrome' && osName === 'windows') key = 'chrome_windows'
  else if (browserName === 'chrome' && osName === 'linux') key = 'chrome_linux'
  else if (browserName === 'chrome' && osName === 'macos') key = 'chrome_macos'
  else if (browserName === 'chrome_mobile' && osName === 'android') key = 'chrome_mobile_android'
  else if (browserName === 'safari_mobile' && osName === 'ios') key = 'safari_mobile_ios'
  else if (browserName === 'firefox' && osName === 'windows') key = 'firefox_windows'
  else if (browserName === 'firefox' && osName === 'linux') key = 'firefox_linux'
  else if (browserName === 'firefox' && osName === 'macos') key = 'firefox_macos'
  else if (browserName === 'safari' && osName === 'macos') key = 'safari_macos'
  else if (browserName === 'edge' && osName === 'windows') key = 'edge_windows'

  return (
    WEBGL_PRESETS[key] || {
      vendor: 'Google Inc.',
      renderer: 'ANGLE (Generic)',
    }
  )
}

export function generateUserAgent(
  browserName: AntidetectBrowserName,
  browserVersion: string,
  osName: AntidetectOsName,
  osVersion: string
): string {
  const platformMap: Record<AntidetectOsName, string> = {
    windows: `Windows NT ${osVersion === '11' ? '10.0' : '10.0'}`,
    linux: 'X11; Linux x86_64',
    macos: `Macintosh; Intel Mac OS X ${osVersion.replace('.', '_')}`,
    android: `Linux; Android ${osVersion}`,
    ios: `iPhone; CPU iPhone OS ${osVersion.replace('.', '_')} like Mac OS X`,
  }

  const platform = platformMap[osName]

  const chromeVersion = browserVersion.split('.')[0]

  switch (browserName) {
    case 'chrome':
      return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Safari/537.36`
    case 'chrome_mobile':
      return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${browserVersion}.0.0.0 Mobile Safari/537.36`
    case 'firefox':
      return `Mozilla/5.0 (${platform}; rv:${browserVersion}.0) Gecko/20100101 Firefox/${browserVersion}.0`
    case 'firefox_mobile':
      return `Mozilla/5.0 (Android ${osVersion}; Mobile; rv:${browserVersion}.0) Gecko/${browserVersion}.0 Firefox/${browserVersion}.0`
    case 'safari':
      return `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${browserVersion}.0 Safari/605.1.15`
    case 'safari_mobile':
      return `Mozilla/5.0 (${platform}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${browserVersion}.0 Mobile/15E148 Safari/604.1`
    case 'edge':
      return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion}.0.0.0 Safari/537.36 Edg/${browserVersion}.0.0.0`
    default:
      return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36`
  }
}
