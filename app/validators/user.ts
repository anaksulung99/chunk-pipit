import vine from '@vinejs/vine'

const email = () => vine.string().trim().toLowerCase().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(32)

export const signupValidator = vine.create({
  fullName: vine.string().nullable(),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password().confirmed({
    confirmationField: 'passwordConfirmation',
  }),
})
export const inviteTeamValidator = vine.create({
  fullName: vine.string().trim().minLength(1).maxLength(100),
  email: email().unique({
    table: 'users',
    column: 'email',
    caseInsensitive: true,
  }),
  password: password(),
  role: vine.enum(['superadmin', 'team'] as const),
  maxDevices: vine.number().min(1).max(10).optional(),
  expiresAt: vine
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const updateUserValidator = (userId: string) =>
  vine.create({
    fullName: vine.string().trim().nullable(),
    email: email().unique({
      table: 'users',
      column: 'email',
      caseInsensitive: true,
      filter(query) {
        query.whereNot('id', userId)
      },
    }),
    role: vine.enum(['superadmin', 'team'] as const),
    maxDevices: vine.number().min(1).max(10).optional(),
    expiresAt: vine
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
export const deleteUsersValidator = vine.create({
  ids: vine.array(vine.string().uuid()).minLength(1),
})

export const updateOwnProfiileValidator = (userId: string) =>
  vine.create({
    fullName: vine.string().trim().nullable(),
    email: email().unique({
      table: 'users',
      column: 'email',
      caseInsensitive: true,
      filter(query) {
        query.whereNot('id', userId)
      },
    }),
  })

export const updateProfilePasswordValidator = vine.create({
  password: password().confirmed({ confirmationField: 'passwordConfirmation' }),
})

const userRole = vine.enum(['all', 'superadmin', 'team'] as const)
const userStatus = vine.enum(['all', 'active', 'inactive'] as const)

export const bulkTeamValidator = vine.create({
  action: vine.enum(['delete', 'set_status'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      role: vine.string().trim().optional(),
      status: vine.string().trim().optional(),
      startDate: vine.string().trim().optional(),
      endDate: vine.string().trim().optional(),
    })
    .optional(),
  role: userRole.optional(),
  status: userStatus.optional(),
  tag: vine.string().trim().maxLength(50).optional(),
})

export const setStatusTeamValidator = vine.create({
  status: vine.enum(['active', 'inactive'] as const),
})
