import vine from '@vinejs/vine'

const licenseStatus = vine.enum(['active', 'suspended', 'revoked'] as const)

/** Per-row: change a single license's status. */
export const updateLicenseStatusValidator = vine.create({
  status: licenseStatus,
})

/** Bulk: apply an action to selected rows or to all rows matching the filters. */
export const bulkLicenseValidator = vine.create({
  action: vine.enum(['suspend', 'reactivate'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      status: vine.string().trim().optional(),
    })
    .optional(),
})
