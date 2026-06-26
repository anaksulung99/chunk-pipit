import vine from '@vinejs/vine'

export const sessionStatus = vine.enum(['success', 'failed', 'skipped', 'checkpoint'] as const)

export const bulkSessionLogValidator = vine.create({
  action: vine.enum(['delete'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      status: vine.string().trim().optional(),
      startDate: vine.string().trim().optional(),
      endDate: vine.string().trim().optional(),
    })
    .optional(),
  status: sessionStatus.optional(),
})
