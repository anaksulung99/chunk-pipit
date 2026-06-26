import type { EmailConfig } from '#models/personal_setting'
import nodemailer from 'nodemailer'

export class EmailNotifierService {
  constructor(private readonly config: EmailConfig) {}

  static fromConfig(config: EmailConfig | null | undefined) {
    if (
      !config?.smtpHost ||
      !config.smtpPort ||
      !config.smtpUsername ||
      !config.smtpPassword ||
      !config.fromAddress ||
      !config.toAddress
    ) {
      return null
    }

    return new EmailNotifierService(config)
  }

  isConfigured() {
    return Boolean(
      this.config.smtpHost &&
        this.config.smtpPort &&
        this.config.smtpUsername &&
        this.config.smtpPassword &&
        this.config.fromAddress &&
        this.config.toAddress
    )
  }

  async sendMessage(subject: string, message: string) {
    if (!this.isConfigured()) {
      throw new Error('Email notifier is not configured')
    }

    const transporter = nodemailer.createTransport({
      host: this.config.smtpHost!,
      port: this.config.smtpPort!,
      secure: this.config.smtpSecure,
      auth: {
        user: this.config.smtpUsername!,
        pass: this.config.smtpPassword!,
      },
    })

    await transporter.sendMail({
      from: this.config.fromName
        ? `"${this.config.fromName}" <${this.config.fromAddress!}>`
        : this.config.fromAddress!,
      to: this.config.toAddress!,
      subject,
      text: message,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>${subject}</h2>
          <pre style="white-space: pre-wrap; font-family: inherit;">${message}</pre>
        </div>
      `,
    })
  }
}
