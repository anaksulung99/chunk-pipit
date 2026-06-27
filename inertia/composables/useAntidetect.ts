import { useForm } from '@inertiajs/vue3'
import {
  BROWSER_VERSION_MAP,
  DEVICE_OS_MAP,
  ENGINE_MAP,
  OS_BROWSER_COMPAT,
  OS_VERSION_MAP,
  buildUserAgent,
  getHardwarePreset,
  getViewportPreset,
  getWebglPreset,
} from '~/utils/fingerprint'

type AntidetectForm = {
  name: string
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
  screenHeight: number
  screenWidth: number
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
  canvasMode: string
  canvasSeed: number | null
  webglVendor: string
  webglRenderer: string
  hardwareConcurrency: number
  deviceMemory: number | null
}
export const useAntidetectForm = () => {
  const form = useForm<AntidetectForm>({
    name: '',
    engine: 'chrome',
    deviceType: 'desktop',
    osName: 'windows',
    osVersion: '11',
    browserName: 'chrome',
    browserVersion: '132',
    userAgent: '',
    language: 'en-US',
    timezone: 'Asia/Jakarta',
    locale: 'id-ID',
    proxyId: null,
    screenHeight: 1080,
    screenWidth: 1920,
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    canvasMode: 'noise',
    canvasSeed: null,
    webglVendor: '',
    webglRenderer: '',
    hardwareConcurrency: 8,
    deviceMemory: 8,
  })

  const availableOsOptions = computed(() => DEVICE_OS_MAP[form.deviceType] ?? [])
  const availableOsVersionOptions = computed(() => OS_VERSION_MAP[form.osName] ?? [])
  const availableBrowserOptions = computed(() => OS_BROWSER_COMPAT[form.osName] ?? [])
  const availableBrowserVersionOptions = computed(() => BROWSER_VERSION_MAP[form.browserName] ?? [])

  watch(
    () => form.deviceType,
    (dev) => {
      const validOs = DEVICE_OS_MAP[dev] ?? []
      if (!validOs.includes(form.osName)) {
        form.osName = validOs[0] ?? 'windows'
        ensureOsVersion()
      }
      form.isMobile = dev === 'mobile'
      form.hasTouch = dev === 'mobile'
      ensureBrowserCompat()
      applyPresets()
    }
  )
  watch(
    () => form.osName,
    () => {
      ensureOsVersion()
      ensureBrowserCompat()
      applyPresets()
    }
  )
  watch(
    () => form.browserName,
    () => {
      const versions = BROWSER_VERSION_MAP[form.browserName] ?? []
      if (versions.length && !versions.includes(form.browserVersion)) {
        form.browserVersion = versions[0]
      }
      form.engine = ENGINE_MAP[form.browserName] ?? 'chrome'
      applyPresets()
    }
  )
  watch(
    () => [form.osVersion, form.browserVersion],
    () => applyPresets()
  )

  function ensureOsVersion() {
    const versions = OS_VERSION_MAP[form.osName] ?? []
    if (versions.length && !versions.includes(form.osVersion)) {
      form.osVersion = versions[0]
    }
  }
  function ensureBrowserCompat() {
    const valid = OS_BROWSER_COMPAT[form.osName] ?? []
    if (!valid.includes(form.browserName)) {
      form.browserName = valid[0] ?? 'chrome'
    }
    const versions = BROWSER_VERSION_MAP[form.browserName] ?? []
    if (versions.length && !versions.includes(form.browserVersion)) {
      form.browserVersion = versions[0]
    }
  }
  function applyPresets() {
    form.engine = ENGINE_MAP[form.browserName] ?? form.engine
    form.userAgent = buildUserAgent(
      form.osName,
      form.osVersion,
      form.browserName,
      form.browserVersion
    )

    const [w, h, dpr] = getViewportPreset(form.deviceType, form.osName)
    form.screenWidth = w
    form.screenHeight = h
    form.deviceScaleFactor = dpr
    form.isMobile = form.deviceType === 'mobile'
    form.hasTouch = form.deviceType === 'mobile'

    const webgl = getWebglPreset(form.browserName, form.osName)
    if (webgl) {
      form.webglVendor = webgl.vendor
      form.webglRenderer = webgl.renderer
    }

    const hardware = getHardwarePreset(form.deviceType, form.osName)
    form.hardwareConcurrency = hardware.hardwareConcurrency
    form.deviceMemory = hardware.deviceMemory
    form.canvasSeed ??= Math.floor(Math.random() * 1_000_000_000)

    form.language = 'id-ID'
    form.timezone = 'Asia/Jakarta'
    form.locale = 'id-ID'
  }
  function generateUa() {
    form.userAgent = buildUserAgent(
      form.osName,
      form.osVersion,
      form.browserName,
      form.browserVersion
    )
  }
  function toPayload() {
    return {
      name: form.name,
      engine: form.engine,
      deviceType: form.deviceType,
      osName: form.osName,
      osVersion: form.osVersion,
      browserName: form.browserName,
      browserVersion: form.browserVersion,
      userAgent: form.userAgent,
      language: form.language,
      timezone: form.timezone,
      locale: form.locale,
      proxyId: form.proxyId,
      screenHeight: Number(form.screenHeight),
      screenWidth: Number(form.screenWidth),
      deviceScaleFactor: Number(form.deviceScaleFactor),
      isMobile: form.isMobile,
      hasTouch: form.hasTouch,
      canvasMode: form.canvasMode,
      canvasSeed: form.canvasSeed === null ? undefined : Number(form.canvasSeed),
      webglVendor: form.webglVendor,
      webglRenderer: form.webglRenderer,
      hardwareConcurrency: Number(form.hardwareConcurrency),
      deviceMemory: form.deviceMemory === null ? undefined : Number(form.deviceMemory),
    }
  }

  applyPresets()

  return {
    form,
    availableOsOptions,
    availableOsVersionOptions,
    availableBrowserOptions,
    availableBrowserVersionOptions,
    ensureOsVersion,
    ensureBrowserCompat,
    applyPresets,
    generateUa,
    toPayload,
  }
}
