import vine from '@vinejs/vine'

const notificationTypes = ['telegram', 'email', 'slack', 'webhook'] as const
const notificationEvents = [
  'campaign_start',
  'campaign_end',
  'campaign_failed',
  'account_issue',
  'checkpoint',
  'scrape_success',
] as const

export const updatePersonalSettingValidator = vine.compile(
  vine.object({
    enableNotification: vine.boolean(),
    typeNotification: vine.enum(notificationTypes).nullable(),
    notificationEvents: vine.array(vine.enum(notificationEvents)).optional(),
    telegramConfig: vine
      .object({
        botToken: vine.string().trim().maxLength(255).optional(),
        chatId: vine.string().trim().maxLength(100).optional(),
        threadId: vine.string().trim().maxLength(100).optional(),
      })
      .optional(),
    emailConfig: vine
      .object({
        smtpHost: vine.string().trim().maxLength(255).optional(),
        smtpPort: vine.number().min(1).max(65535).optional(),
        smtpUsername: vine.string().trim().maxLength(255).optional(),
        smtpPassword: vine.string().trim().maxLength(255).optional(),
        smtpSecure: vine.boolean().optional(),
        fromAddress: vine.string().trim().maxLength(255).optional(),
        fromName: vine.string().trim().maxLength(255).optional(),
        toAddress: vine.string().trim().maxLength(255).optional(),
      })
      .optional(),
    slackConfig: vine
      .object({
        webhookUrl: vine.string().trim().maxLength(2000).optional(),
        channel: vine.string().trim().maxLength(100).optional(),
        username: vine.string().trim().maxLength(100).optional(),
      })
      .optional(),
    webhookUrl: vine.string().trim().maxLength(2000).optional(),
  })
)
