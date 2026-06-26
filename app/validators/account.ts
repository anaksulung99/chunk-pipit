import vine from '@vinejs/vine'

const sessionStatus = vine.enum(['active', 'checkpoint', 'logged_out', 'banned'] as const)

export const createAccountValidator = vine.create({
  label: vine.string().trim().minLength(1).maxLength(100),
  fbUserId: vine.string().trim().maxLength(50).optional(),
  profileUrl: vine.string().trim().maxLength(500).optional(),
  notes: vine.string().trim().optional(),
  cookiesText: vine.string().trim().minLength(2),
})

export const updateAccountStatusValidator = vine.create({
  status: sessionStatus,
})

export const bulkAccountValidator = vine.create({
  action: vine.enum(['delete', 'set_status'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      status: vine.string().trim().optional(),
    })
    .optional(),
  status: sessionStatus.optional(),
})

export const updateAccountValidator = vine.create({
  label: vine.string().trim().minLength(1).maxLength(100),
  fbUserId: vine.string().trim().maxLength(50).optional(),
  profileUrl: vine.string().trim().maxLength(500).optional(),
  notes: vine.string().trim().optional(),
  cookiesText: vine.string().trim().minLength(2).optional(),
})
