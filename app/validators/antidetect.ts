import vine from '@vinejs/vine'

export const createAntidetectValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(100),
  engine: vine
    .enum(['chrome', 'firefox', 'webkit'])
    .optional()
    .transform((val) => val ?? 'chrome'),
  deviceType: vine
    .enum(['desktop', 'mobile'])
    .optional()
    .transform((val) => val ?? 'desktop'),
  osName: vine
    .enum(['windows', 'macos', 'linux', 'android', 'ios'])
    .optional()
    .transform((val) => val ?? 'windows'),
  osVersion: vine.string().optional(),
  browserName: vine
    .enum([
      'chrome',
      'firefox',
      'safari',
      'edge',
      'chrome_mobile',
      'safari_mobile',
      'firefox_mobile',
    ])
    .optional()
    .transform((val) => val ?? 'chrome'),
  browserVersion: vine.string().minLength(1).maxLength(100),
  userAgent: vine.string().minLength(1).maxLength(1000),
  language: vine.string().minLength(1).maxLength(100),
  timezone: vine.string().minLength(1).maxLength(100),
  locale: vine.string().minLength(1).maxLength(100),
  proxyId: vine
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((val) => val || null),
  screenHeight: vine.number().optional(),
  screenWidth: vine.number().optional(),
  deviceScaleFactor: vine
    .number()
    .optional()
    .transform((val) => val ?? 1.0),
  isMobile: vine
    .boolean()
    .optional()
    .transform((val) => val ?? false),
  hasTouch: vine
    .boolean()
    .optional()
    .transform((val) => val ?? false),
  canvasMode: vine
    .enum(['off', 'noise', 'block'] as const)
    .optional()
    .transform((val) => val ?? 'noise'),
  canvasSeed: vine.number().nullable().optional(),
  webglVendor: vine.string().maxLength(255).optional(),
  webglRenderer: vine.string().maxLength(500).optional(),
  hardwareConcurrency: vine.number().optional(),
  deviceMemory: vine.number().optional(),
})
export const updateAntidetectValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(100),
  engine: vine
    .enum(['chrome', 'firefox', 'webkit'])
    .optional()
    .transform((val) => val ?? 'chrome'),
  deviceType: vine
    .enum(['desktop', 'mobile'])
    .optional()
    .transform((val) => val ?? 'desktop'),
  osName: vine
    .enum(['windows', 'macos', 'linux', 'android', 'ios'])
    .optional()
    .transform((val) => val ?? 'windows'),
  browserName: vine
    .enum([
      'chrome',
      'firefox',
      'safari',
      'edge',
      'chrome_mobile',
      'safari_mobile',
      'firefox_mobile',
    ])
    .optional()
    .transform((val) => val ?? 'chrome'),
  browserVersion: vine.string().minLength(1).maxLength(100),
  userAgent: vine.string().minLength(1).maxLength(1000),
  language: vine.string().minLength(1).maxLength(100),
  timezone: vine.string().minLength(1).maxLength(100),
  locale: vine.string().minLength(1).maxLength(100),
  proxyId: vine
    .string()
    .uuid()
    .nullable()
    .optional()
    .transform((val) => val || null),
  screenHeight: vine.number().optional(),
  screenWidth: vine.number().optional(),
  deviceScaleFactor: vine
    .number()
    .optional()
    .transform((val) => val ?? 1.0),
  isMobile: vine
    .boolean()
    .optional()
    .transform((val) => val ?? false),
  hasTouch: vine
    .boolean()
    .optional()
    .transform((val) => val ?? false),
  canvasMode: vine
    .enum(['off', 'noise', 'block'] as const)
    .optional()
    .transform((val) => val ?? 'noise'),
  canvasSeed: vine.number().nullable().optional(),
  webglVendor: vine.string().maxLength(255).optional(),
  webglRenderer: vine.string().maxLength(500).optional(),
  hardwareConcurrency: vine.number().optional(),
  deviceMemory: vine.number().optional(),
})
export const bulkDeleteAntidetectValidator = vine.create({
  action: vine.enum(['delete'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      engine: vine.string().trim().optional(),
      deviceType: vine.string().trim().optional(),
      osName: vine.string().trim().optional(),
      browserName: vine.string().trim().optional(),
      language: vine.string().trim().optional(),
      timezone: vine.string().trim().optional(),
      startDate: vine.string().trim().optional(),
      endDate: vine.string().trim().optional(),
    })
    .optional(),
})
