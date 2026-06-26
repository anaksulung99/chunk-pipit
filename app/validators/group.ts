import vine from '@vinejs/vine'

const groupType = vine.enum(['public', 'private'] as const)

export const importGroupsValidator = vine.create({
  text: vine.string().trim().minLength(1),
  groupType,
  tagsText: vine.string().trim().optional(),
})

export const updateGroupTypeValidator = vine.create({
  groupType,
})

export const bulkGroupValidator = vine.create({
  action: vine.enum(['delete', 'set_type', 'add_tags', 'set_tags', 'remove_tags', 'clear_tags'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      type: vine.string().trim().optional(),
      source: vine.string().trim().optional(),
      groupTag: vine.string().trim().optional(),
    })
    .optional(),
  groupType: groupType.optional(),
  tagsText: vine.string().trim().maxLength(255).optional(),
})
