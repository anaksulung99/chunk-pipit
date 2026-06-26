import vine from '@vinejs/vine'

const protocol = vine.enum(['http', 'https', 'socks4', 'socks5'] as const)
const proxyStatus = vine.enum(['unchecked', 'healthy', 'slow', 'dead'] as const)

export const createProxyValidator = vine.create({
  protocol,
  host: vine.string().trim().maxLength(255),
  port: vine.number().min(1).max(65535),
  username: vine.string().trim().maxLength(100).optional(),
  password: vine.string().trim().maxLength(255).optional(),
})

export const importProxiesValidator = vine.create({
  text: vine.string().trim().minLength(1),
})

export const bulkProxyValidator = vine.create({
  action: vine.enum(['delete', 'health_check', 'set_status'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      status: vine.string().trim().optional(),
      protocol: vine.string().trim().optional(),
    })
    .optional(),
  status: proxyStatus.optional(),
})
