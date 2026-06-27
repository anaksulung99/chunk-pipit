export const DEVICE_OS_MAP: Record<string, string[]> = {
  desktop: ['windows', 'linux', 'macos'],
  mobile: ['android', 'ios'],
}

export const OS_VERSION_MAP: Record<string, string[]> = {
  windows: ['11', '10'],
  linux: ['Ubuntu 24.04', 'Ubuntu 22.04', 'Fedora 40', 'Debian 12'],
  macos: ['15', '14', '13'],
  android: ['15', '14', '13', '12'],
  ios: ['18', '17', '16'],
}

export const OS_BROWSER_COMPAT: Record<string, string[]> = {
  windows: ['chrome', 'firefox', 'edge'],
  linux: ['chrome', 'firefox'],
  macos: ['chrome', 'firefox', 'safari', 'edge'],
  android: ['chrome_mobile', 'firefox_mobile'],
  ios: ['safari_mobile', 'chrome_mobile'],
}

export const BROWSER_VERSION_MAP: Record<string, string[]> = {
  chrome: ['132', '131', '130', '129', '128', '127', '126', '124', '120'],
  firefox: ['134', '133', '131', '128', '125', '121', '120'],
  safari: ['18.3', '18.2', '18.1', '18.0', '17.6', '17.5', '17.4'],
  edge: ['132', '131', '130', '129', '128', '127', '124', '120'],
  chrome_mobile: ['132', '131', '130', '128', '126', '124', '120'],
  safari_mobile: ['18.3', '18.2', '18.1', '18.0', '17.6', '17.5'],
  firefox_mobile: ['134', '133', '131', '128', '125', '121'],
}

export const OS_LABELS: Record<string, string> = {
  windows: 'Windows',
  linux: 'Linux',
  macos: 'macOS',
  android: 'Android',
  ios: 'iOS',
}

export const BROWSER_LABELS: Record<string, string> = {
  chrome: 'Google Chrome',
  firefox: 'Mozilla Firefox',
  safari: 'Safari (macOS)',
  edge: 'Microsoft Edge',
  chrome_mobile: 'Chrome Mobile',
  safari_mobile: 'Safari Mobile',
  firefox_mobile: 'Firefox Mobile',
}

export const ENGINE_MAP: Record<string, string> = {
  chrome: 'chrome',
  firefox: 'firefox',
  safari: 'webkit',
  edge: 'chrome',
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
  firefox_mobile_android: {
    vendor: 'Qualcomm',
    renderer: 'Adreno (TM) 740',
  },
  firefox_macos: { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  safari_macos: { vendor: 'Apple Inc.', renderer: 'Apple M2' },
  edge_windows: {
    vendor: 'Google Inc. (NVIDIA)',
    renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
  },
}

export function getViewportPreset(deviceType: string, osName: string): [number, number, number] {
  const key = `${deviceType}_${osName}`
  return VIEWPORT_PRESETS[key] ?? (deviceType === 'mobile' ? [390, 844, 3] : [1920, 1080, 1])
}

export function getWebglPreset(browserName: string, osName: string) {
  const exact = WEBGL_PRESETS[`${browserName}_${osName}`]
  if (exact) return exact

  if (browserName === 'chrome_mobile' && osName === 'ios') return WEBGL_PRESETS.safari_mobile_ios
  if (browserName === 'firefox_mobile' && osName === 'ios') return WEBGL_PRESETS.safari_mobile_ios
  if (browserName === 'chrome_mobile' && osName === 'android') {
    return WEBGL_PRESETS.chrome_mobile_android
  }
  if (browserName === 'firefox_mobile' && osName === 'android') {
    return WEBGL_PRESETS.firefox_mobile_android
  }

  if (osName === 'macos') return WEBGL_PRESETS.safari_macos
  if (osName === 'linux') return WEBGL_PRESETS.chrome_linux
  return WEBGL_PRESETS.chrome_windows
}

export function getHardwarePreset(deviceType: string, osName: string) {
  if (deviceType === 'mobile') {
    return osName === 'ios'
      ? { hardwareConcurrency: 6, deviceMemory: 4 }
      : { hardwareConcurrency: 8, deviceMemory: 8 }
  }

  if (osName === 'macos') return { hardwareConcurrency: 8, deviceMemory: 8 }
  if (osName === 'linux') return { hardwareConcurrency: 8, deviceMemory: 8 }
  return { hardwareConcurrency: 12, deviceMemory: 16 }
}

export function buildUserAgent(
  osName: string,
  osVersion: string,
  browserName: string,
  browserVersion: string
): string {
  const bv = browserVersion || '120'

  switch (browserName) {
    case 'chrome': {
      const osStr =
        osName === 'windows'
          ? 'Windows NT 10.0; Win64; x64'
          : osName === 'macos'
            ? `Macintosh; Intel Mac OS X ${(osVersion || '14').replace(/\./g, '_')}_0`
            : 'X11; Linux x86_64'
      return `Mozilla/5.0 (${osStr}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv}.0.0.0 Safari/537.36`
    }
    case 'firefox': {
      const osStr =
        osName === 'windows'
          ? 'Windows NT 10.0; Win64; x64'
          : osName === 'macos'
            ? `Macintosh; Intel Mac OS X ${(osVersion || '14').replace(/\./g, '_')}`
            : 'X11; Linux x86_64'
      return `Mozilla/5.0 (${osStr}; rv:${bv}.0) Gecko/20100101 Firefox/${bv}.0`
    }
    case 'safari': {
      const macVer = (osVersion || '14').replace(/\./g, '_')
      return `Mozilla/5.0 (Macintosh; Intel Mac OS X ${macVer}) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${bv} Safari/605.1.15`
    }
    case 'edge': {
      return `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv}.0.0.0 Safari/537.36 Edg/${bv}.0.0.0`
    }
    case 'chrome_mobile': {
      const av = osVersion || '14'
      return `Mozilla/5.0 (Linux; Android ${av}; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${bv}.0.0.0 Mobile Safari/537.36`
    }
    case 'safari_mobile': {
      const iv = (osVersion || '17').replace(/\./g, '_')
      return `Mozilla/5.0 (iPhone; CPU iPhone OS ${iv}_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${bv} Mobile/15E148 Safari/605.1.15`
    }
    case 'firefox_mobile': {
      const av = osVersion || '14'
      return `Mozilla/5.0 (Android ${av}; Mobile; rv:${bv}.0) Gecko/${bv}.0 Firefox/${bv}.0`
    }
    default:
      return ''
  }
}
