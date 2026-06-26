export class WebhookNotifierService {
  constructor(private readonly webhookUrl: string) {}

  static fromUrl(webhookUrl: string | null | undefined) {
    if (!webhookUrl) return null
    return new WebhookNotifierService(webhookUrl)
  }

  async sendJson(payload: Record<string, unknown>) {
    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`)
    }
  }
}
