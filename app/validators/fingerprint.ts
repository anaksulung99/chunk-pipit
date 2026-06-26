import vine from '@vinejs/vine'

export const createFingerprintValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(100),
  osType: vine.enum(['windows', 'linux', 'macos'] as const),
  browserType: vine.enum(['chrome', 'firefox', 'safari', 'edge'] as const),
  locale: vine
    .string()
    .optional()
    .transform((value) => value ?? 'en-US'),
  timezone: vine
    .string()
    .optional()
    .transform((value) => value ?? 'Asia/Jakarta'),
})

export const bulkFingerprintValidator = vine.create({
  action: vine.enum(['delete'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      osType: vine.string().trim().optional(),
      browserType: vine.string().trim().optional(),
      startDate: vine.string().trim().optional(),
      endDate: vine.string().trim().optional(),
    })
    .optional(),
})

export const updateFingerprintValidator = vine.create({
  name: vine.string().trim().minLength(1).maxLength(100),
  osType: vine.enum(['windows', 'linux', 'macos'] as const),
  browserType: vine.enum(['chrome', 'firefox', 'safari', 'edge'] as const),
  locale: vine.string().optional(),
  timezone: vine.string().optional(),
})
