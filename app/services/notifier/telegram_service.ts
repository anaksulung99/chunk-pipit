import TelegramBot from 'node-telegram-bot-api'
import type { TelegramConfig } from '#models/personal_setting'

export class TelegramNotifierService {
  constructor(
    private readonly botToken: string,
    private readonly chatId: string
  ) {}

  static fromConfig(config: TelegramConfig | null | undefined) {
    if (!config?.botToken || !config?.chatId) return null
    return new TelegramNotifierService(config.botToken, config.chatId)
  }

  isConfigured() {
    return Boolean(this.botToken && this.chatId)
  }

  async sendMessage(
    message: string,
    options?: {
      threadId?: string | null
      parseMode?: 'Markdown' | 'MarkdownV2' | 'HTML'
      disableWebPagePreview?: boolean
    }
  ) {
    if (!this.isConfigured()) {
      throw new Error('Telegram notifier is not configured')
    }

    const bot = new TelegramBot(this.botToken, { polling: false })
    return bot.sendMessage(this.chatId, message, {
      message_thread_id:
        options?.threadId && /^\d+$/.test(options.threadId) ? Number(options.threadId) : undefined,
      parse_mode: options?.parseMode,
    })
  }
}
