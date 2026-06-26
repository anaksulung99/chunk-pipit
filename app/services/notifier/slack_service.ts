import type { SlackConfig } from '#models/personal_setting'
import { WebhookNotifierService } from '#services/notifier/webhook_service'

export class SlackNotifierService {
  constructor(private readonly config: SlackConfig, private readonly webhook: WebhookNotifierService) {}

  static fromConfig(config: SlackConfig | null | undefined) {
    if (!config?.webhookUrl) return null

    const webhook = WebhookNotifierService.fromUrl(config.webhookUrl)
    if (!webhook) return null

    return new SlackNotifierService(config, webhook)
  }

  async sendMessage(subject: string, message: string) {
    await this.webhook.sendJson({
      text: `*${subject}*\n${message}`,
      channel: this.config.channel ?? undefined,
      username: this.config.username ?? undefined,
    })
  }
}
