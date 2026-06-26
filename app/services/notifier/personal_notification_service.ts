import PersonalSetting from '#models/personal_setting'
import {
  DEFAULT_NOTIFICATION_EVENTS,
  type EmailConfig,
  type NotificationChannel,
  type NotificationEventKey,
  type SlackConfig,
  type TelegramConfig,
} from '#models/personal_setting'
import { EmailNotifierService } from '#services/notifier/email_service'
import { SlackNotifierService } from '#services/notifier/slack_service'
import { TelegramNotifierService } from '#services/notifier/telegram_service'
import { WebhookNotifierService } from '#services/notifier/webhook_service'

type CampaignNotificationEvent = {
  action: string
  status: 'success' | 'failed' | 'skipped' | 'checkpoint'
  message: string
  campaignId: string
  campaignName: string
  campaignType: string
  campaignStatus?: string | null
  accountId?: string | null
  accountLabel?: string | null
  groupId?: string | null
  groupName?: string | null
}

type NotifierChannel =
  | { type: 'telegram'; service: TelegramNotifierService; threadId: string | null | undefined }
  | { type: 'email'; service: EmailNotifierService }
  | { type: 'slack'; service: SlackNotifierService }
  | { type: 'webhook'; service: WebhookNotifierService }

type PersonalNotificationConfig = {
  enableNotification: boolean
  typeNotification: NotificationChannel | null
  telegramConfig: TelegramConfig
  emailConfig: EmailConfig
  slackConfig: SlackConfig
  notificationEvents: NotificationEventKey[]
  webhookUrl: string | null
}

function normalizeEventSelection(
  events: NotificationEventKey[] | null | undefined
): NotificationEventKey[] {
  const source = events?.length ? events : DEFAULT_NOTIFICATION_EVENTS
  return Array.from(new Set(source)).filter((item): item is NotificationEventKey =>
    DEFAULT_NOTIFICATION_EVENTS.includes(item)
  )
}

export class PersonalNotificationService {
  constructor(
    private readonly channel: NotifierChannel | null,
    private readonly enabledEvents: NotificationEventKey[] = DEFAULT_NOTIFICATION_EVENTS
  ) {}

  static async forUser(userId: string) {
    const setting = await PersonalSetting.query().where('user_id', userId).first()
    if (!setting?.enableNotification || !setting.typeNotification) {
      return new PersonalNotificationService(null)
    }

    const config: PersonalNotificationConfig = {
      enableNotification: setting.enableNotification,
      typeNotification: setting.typeNotification,
      telegramConfig: setting.telegramConfig ?? {
        botToken: null,
        chatId: null,
        threadId: null,
      },
      emailConfig: setting.emailConfig ?? {
        smtpHost: null,
        smtpPort: null,
        smtpUsername: null,
        smtpPassword: null,
        smtpSecure: false,
        fromAddress: null,
        fromName: null,
        toAddress: null,
      },
      slackConfig: setting.slackConfig ?? {
        webhookUrl: null,
        channel: null,
        username: null,
      },
      notificationEvents: normalizeEventSelection(setting.notificationEvents),
      webhookUrl: setting.webhookUrl,
    }

    return this.fromConfig(config)
  }

  static fromConfig(config: PersonalNotificationConfig) {
    if (!config.enableNotification || !config.typeNotification) {
      return new PersonalNotificationService(null)
    }

    return new PersonalNotificationService(
      this.resolveChannel(
        config.typeNotification,
        config.telegramConfig,
        config.emailConfig,
        config.slackConfig,
        config.webhookUrl
      ),
      normalizeEventSelection(config.notificationEvents)
    )
  }

  private static resolveChannel(
    type: NotificationChannel,
    telegramConfig: PersonalSetting['telegramConfig'],
    emailConfig: PersonalSetting['emailConfig'],
    slackConfig: PersonalSetting['slackConfig'],
    webhookUrl: string | null
  ): NotifierChannel | null {
    if (type === 'telegram') {
      const service = TelegramNotifierService.fromConfig(telegramConfig)
      return service ? { type, service, threadId: telegramConfig?.threadId } : null
    }

    if (type === 'email') {
      const service = EmailNotifierService.fromConfig(emailConfig)
      return service ? { type, service } : null
    }

    if (type === 'slack') {
      const service = SlackNotifierService.fromConfig(slackConfig)
      return service ? { type, service } : null
    }

    const service = WebhookNotifierService.fromUrl(webhookUrl)
    return service ? { type: 'webhook', service } : null
  }

  shouldNotify(event: CampaignNotificationEvent) {
    if (!this.channel) return false

    const eventKey = this.resolveEventKey(event)
    if (!eventKey) return false

    return this.enabledEvents.includes(eventKey)
  }

  private resolveEventKey(event: CampaignNotificationEvent): NotificationEventKey | null {
    if (event.action === 'campaign_start') return 'campaign_start'
    if (event.action === 'campaign_end') return 'campaign_end'
    if (event.action === 'campaign_error') return 'campaign_failed'
    if (event.action === 'account_error') return 'account_issue'
    if (event.action === 'session_launch' && event.status === 'failed') return 'account_issue'
    if (event.action === 'session_verify' && event.status === 'checkpoint') return 'checkpoint'
    if (event.action === 'scrape' && event.status === 'success') return 'scrape_success'
    return null
  }

  private formatSubject(event: CampaignNotificationEvent) {
    const labels: Record<CampaignNotificationEvent['status'], string> = {
      success: 'SUCCESS',
      failed: 'FAILED',
      skipped: 'SKIPPED',
      checkpoint: 'CHECKPOINT',
    }

    return `[${labels[event.status]}] ${event.campaignName}`
  }

  private formatMessage(event: CampaignNotificationEvent) {
    const lines = [
      'FB Automation Notification',
      '',
      `Campaign      : ${event.campaignName}`,
      `Type          : ${event.campaignType}`,
      `Action        : ${event.action}`,
      `Event Status  : ${event.status}`,
      event.campaignStatus ? `Campaign State: ${event.campaignStatus}` : null,
      event.accountLabel ? `Account       : ${event.accountLabel}` : null,
      event.groupName ? `Group         : ${event.groupName}` : null,
      '',
      'Message',
      `${event.message}`,
      '',
      'Reference',
      `Campaign ID   : ${event.campaignId}`,
      event.accountId ? `Account ID    : ${event.accountId}` : null,
      event.groupId ? `Group ID      : ${event.groupId}` : null,
      `Channel       : ${this.channel?.type ?? '-'}`,
      `Time          : ${new Date().toLocaleString('id-ID')}`,
    ].filter(Boolean)

    return lines.join('\n')
  }

  async sendTestNotification(channelLabel = 'Personal Settings') {
    if (!this.channel) {
      throw new Error('Notification channel is not configured')
    }

    const event: CampaignNotificationEvent = {
      action: 'campaign_start',
      status: 'success',
      message: `Ini adalah test notification dari ${channelLabel}. Jika pesan ini masuk, konfigurasi channel Anda sudah siap dipakai worker.`,
      campaignId: 'test-campaign',
      campaignName: 'Test Notification',
      campaignType: 'system_test',
      campaignStatus: 'draft',
    }

    const subject = this.formatSubject(event)
    const message = this.formatMessage(event)

    if (this.channel.type === 'telegram') {
      await this.channel.service.sendMessage(message, {
        threadId: this.channel.threadId,
      })
      return
    }

    if (this.channel.type === 'email') {
      await this.channel.service.sendMessage(subject, message)
      return
    }

    if (this.channel.type === 'slack') {
      await this.channel.service.sendMessage(subject, message)
      return
    }

    await this.channel.service.sendJson({
      subject,
      message,
      event,
      test: true,
    })
  }

  async notifyCampaignEvent(event: CampaignNotificationEvent) {
    if (!this.shouldNotify(event) || !this.channel) return

    const subject = this.formatSubject(event)
    const message = this.formatMessage(event)

    try {
      if (this.channel.type === 'telegram') {
        await this.channel.service.sendMessage(message, {
          threadId: this.channel.threadId,
        })
        return
      }

      if (this.channel.type === 'email') {
        await this.channel.service.sendMessage(subject, message)
        return
      }

      if (this.channel.type === 'slack') {
        await this.channel.service.sendMessage(subject, message)
        return
      }

      await this.channel.service.sendJson({
        subject,
        message,
        event,
      })
    } catch (error) {
      console.warn('[notification] failed to deliver personal notification', error)
    }
  }
}

export type { CampaignNotificationEvent, PersonalNotificationConfig }
