import PersonalSetting, {
  DEFAULT_NOTIFICATION_EVENTS,
  type EmailConfig,
  type NotificationChannel,
  type NotificationEventKey,
  type SlackConfig,
  type TelegramConfig,
} from '#models/personal_setting'
import { PersonalNotificationService } from '#services/notifier/personal_notification_service'
import { updatePersonalSettingValidator } from '#validators/personal_setting'
import type { HttpContext } from '@adonisjs/core/http'

function text(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''
  return normalized.length ? normalized : null
}

function sanitizeTelegramConfig(value?: Partial<TelegramConfig> | null): TelegramConfig {
  return {
    botToken: text(value?.botToken),
    chatId: text(value?.chatId),
    threadId: text(value?.threadId),
  }
}

function sanitizeEmailConfig(value?: Partial<EmailConfig> | null): EmailConfig {
  const smtpPort =
    typeof value?.smtpPort === 'number' && Number.isFinite(value.smtpPort) ? value.smtpPort : null

  return {
    smtpHost: text(value?.smtpHost),
    smtpPort,
    smtpUsername: text(value?.smtpUsername),
    smtpPassword: text(value?.smtpPassword),
    smtpSecure: Boolean(value?.smtpSecure),
    fromAddress: text(value?.fromAddress),
    fromName: text(value?.fromName),
    toAddress: text(value?.toAddress),
  }
}

function sanitizeSlackConfig(value?: Partial<SlackConfig> | null): SlackConfig {
  return {
    webhookUrl: text(value?.webhookUrl),
    channel: text(value?.channel),
    username: text(value?.username),
  }
}

type SanitizedSetting = {
  enableNotification: boolean
  typeNotification: NotificationChannel | null
  notificationEvents: NotificationEventKey[]
  telegramConfig: TelegramConfig
  emailConfig: EmailConfig
  slackConfig: SlackConfig
  webhookUrl: string | null
}

function sanitizeNotificationEvents(value?: NotificationEventKey[] | null): NotificationEventKey[] {
  const events = value?.length ? value : DEFAULT_NOTIFICATION_EVENTS
  return Array.from(new Set(events)).filter((item): item is NotificationEventKey =>
    DEFAULT_NOTIFICATION_EVENTS.includes(item)
  )
}

function serializeSetting(setting: PersonalSetting | null) {
  return {
    enableNotification: setting?.enableNotification ?? false,
    typeNotification: setting?.typeNotification ?? null,
    notificationEvents: sanitizeNotificationEvents(setting?.notificationEvents),
    telegramConfig: sanitizeTelegramConfig(setting?.telegramConfig),
    emailConfig: sanitizeEmailConfig(setting?.emailConfig),
    slackConfig: sanitizeSlackConfig(setting?.slackConfig),
    webhookUrl: text(setting?.webhookUrl),
  }
}

function validateSelectedChannel(
  typeNotification: NotificationChannel | null,
  values: SanitizedSetting
) {
  if (!typeNotification) {
    return 'Pilih tipe notifikasi terlebih dahulu.'
  }

  if (
    typeNotification === 'telegram' &&
    (!values.telegramConfig.botToken || !values.telegramConfig.chatId)
  ) {
    return 'Telegram membutuhkan Bot Token dan Chat ID.'
  }

  if (
    typeNotification === 'email' &&
    (!values.emailConfig.smtpHost ||
      !values.emailConfig.smtpPort ||
      !values.emailConfig.smtpUsername ||
      !values.emailConfig.smtpPassword ||
      !values.emailConfig.fromAddress ||
      !values.emailConfig.toAddress)
  ) {
    return 'Email membutuhkan SMTP host, port, username, password, from address, dan to address.'
  }

  if (typeNotification === 'slack' && !values.slackConfig.webhookUrl) {
    return 'Slack membutuhkan webhook URL.'
  }

  if (typeNotification === 'webhook' && !values.webhookUrl) {
    return 'Custom webhook membutuhkan URL webhook.'
  }

  return null
}

export default class PersonalSettingsController {
  async index({ inertia, auth }: HttpContext) {
    const setting = await PersonalSetting.query().where('user_id', auth.user!.id).first()

    return inertia.render('settings/personal-setting', {
      personalSetting: serializeSetting(setting),
    })
  }

  async update({ auth, request, response, session }: HttpContext) {
    const payload = await request.validateUsing(updatePersonalSettingValidator)
    const values = {
      enableNotification: payload.enableNotification,
      typeNotification: payload.enableNotification ? payload.typeNotification : null,
      notificationEvents: sanitizeNotificationEvents(payload.notificationEvents),
      telegramConfig: sanitizeTelegramConfig(payload.telegramConfig),
      emailConfig: sanitizeEmailConfig(payload.emailConfig),
      slackConfig: sanitizeSlackConfig(payload.slackConfig),
      webhookUrl: text(payload.webhookUrl),
    }

    const error = values.enableNotification
      ? validateSelectedChannel(values.typeNotification, values)
      : null

    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }

    await PersonalSetting.updateOrCreate(
      { userId: auth.user!.id },
      {
        userId: auth.user!.id,
        enableNotification: values.enableNotification,
        typeNotification: values.typeNotification,
        notificationEvents: values.notificationEvents,
        telegramConfig: values.telegramConfig,
        emailConfig: values.emailConfig,
        slackConfig: values.slackConfig,
        webhookUrl: values.webhookUrl,
      }
    )

    session.flash('success', 'Personal notification settings updated.')
    return response.redirect().toRoute('settings.personal-setting')
  }

  async test({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(updatePersonalSettingValidator)
    const values: SanitizedSetting = {
      enableNotification: payload.enableNotification,
      typeNotification: payload.enableNotification ? payload.typeNotification : null,
      notificationEvents: sanitizeNotificationEvents(payload.notificationEvents),
      telegramConfig: sanitizeTelegramConfig(payload.telegramConfig),
      emailConfig: sanitizeEmailConfig(payload.emailConfig),
      slackConfig: sanitizeSlackConfig(payload.slackConfig),
      webhookUrl: text(payload.webhookUrl),
    }

    const error = values.enableNotification
      ? validateSelectedChannel(values.typeNotification, values)
      : 'Aktifkan notification dan pilih channel sebelum test notification.'

    if (error) {
      session.flash('error', error)
      return response.redirect().back()
    }

    const notifier = PersonalNotificationService.fromConfig(values)

    try {
      await notifier.sendTestNotification()
      session.flash('success', 'Test notification berhasil dikirim.')
    } catch (cause) {
      session.flash('error', `Test notification gagal: ${(cause as Error).message}`)
    }

    return response.redirect().back()
  }
}
