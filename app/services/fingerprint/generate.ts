import { FingerprintGenerator } from 'fingerprint-generator'

export type GeneratedFingerprint = {
  userAgent: string | null
  platform: string | null
  screenWidth: number | null
  screenHeight: number | null
  webglVendor: string | null
  webglRenderer: string | null
  browserVersion: string | null
  osVersion: string | null
  clientHints: unknown
  raw: unknown
}

/**
 * Run fingerprint-generator for a desktop OS + browser combo and pull out the
 * fields we surface in the UI. The full output is returned as `raw` so the
 * exact profile can be replayed/injected later. Throws if the combo has no
 * matching fingerprint (e.g. safari + windows).
 */
export function generateFingerprint(
  osType: string,
  browserType: string,
  locale?: string
): GeneratedFingerprint {
  const generator = new FingerprintGenerator()
  const { fingerprint, headers } = generator.getFingerprint({
    devices: ['desktop'],
    operatingSystems: [osType] as never,
    browsers: [browserType] as never,
    locales: locale ? [locale] : ['id-ID'],
  })

  const nav = fingerprint.navigator
  const uaData = nav.userAgentData
  const browserVersion =
    uaData?.uaFullVersion ||
    uaData?.brands?.find((b) => new RegExp(browserType, 'i').test(b.brand))?.version ||
    null

  return {
    userAgent: nav.userAgent ?? null,
    platform: nav.platform ?? null,
    screenWidth: fingerprint.screen?.width ?? null,
    screenHeight: fingerprint.screen?.height ?? null,
    webglVendor: fingerprint.videoCard?.vendor ?? null,
    webglRenderer: fingerprint.videoCard?.renderer ?? null,
    browserVersion,
    osVersion: uaData?.platformVersion ?? null,
    clientHints: uaData ?? null,
    raw: { fingerprint, headers },
  }
}
