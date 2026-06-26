import User from '#models/user'
import { DateTime } from 'luxon'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'

export type NotificationChannel = 'telegram' | 'email' | 'slack' | 'webhook'
export type NotificationEventKey =
  | 'campaign_start'
  | 'campaign_end'
  | 'campaign_failed'
  | 'account_issue'
  | 'checkpoint'
  | 'scrape_success'

export const DEFAULT_NOTIFICATION_EVENTS: NotificationEventKey[] = [
  'campaign_start',
  'campaign_end',
  'campaign_failed',
  'account_issue',
  'checkpoint',
  'scrape_success',
]

export type TelegramConfig = {
  botToken: string | null
  chatId: string | null
  threadId: string | null
}

export type EmailConfig = {
  smtpHost: string | null
  smtpPort: number | null
  smtpUsername: string | null
  smtpPassword: string | null
  smtpSecure: boolean
  fromAddress: string | null
  fromName: string | null
  toAddress: string | null
}

export type SlackConfig = {
  webhookUrl: string | null
  channel: string | null
  username: string | null
}

function prepareJson<T>(value: T | null) {
  return value === null ? null : JSON.stringify(value)
}

function consumeJson<T>(value: unknown): T | null {
  if (typeof value === 'string') return JSON.parse(value) as T
  return (value as T | null) ?? null
}

export default class PersonalSetting extends BaseModel {
  static table = 'personal_settings'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare userId: string

  @column()
  declare enableNotification: boolean

  @column()
  declare typeNotification: NotificationChannel | null

  @column({
    prepare: (value: TelegramConfig | null) => prepareJson(value),
    consume: (value: unknown) => consumeJson<TelegramConfig>(value),
  })
  declare telegramConfig: TelegramConfig | null

  @column({
    prepare: (value: EmailConfig | null) => prepareJson(value),
    consume: (value: unknown) => consumeJson<EmailConfig>(value),
  })
  declare emailConfig: EmailConfig | null

  @column({
    prepare: (value: SlackConfig | null) => prepareJson(value),
    consume: (value: unknown) => consumeJson<SlackConfig>(value),
  })
  declare slackConfig: SlackConfig | null

  @column({
    prepare: (value: NotificationEventKey[] | null) => prepareJson(value),
    consume: (value: unknown) => consumeJson<NotificationEventKey[]>(value),
  })
  declare notificationEvents: NotificationEventKey[] | null

  @column()
  declare webhookUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
