import vine from '@vinejs/vine'

export const bulkProfileValidator = vine.create({
  action: vine.enum(['delete', 'add_tags', 'set_tags', 'remove_tags', 'clear_tags'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      source: vine.string().trim().optional(),
      profileTag: vine.string().trim().optional(),
    })
    .optional(),
  tagsText: vine.string().trim().maxLength(255).optional(),
})
