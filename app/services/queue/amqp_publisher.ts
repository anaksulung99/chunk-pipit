import { connectAmqp, assertTopology } from '#services/queue/amqp'
import { JOBS_EXCHANGE, QUEUES, type CampaignType } from '#services/queue/topology'

export type CampaignJob = {
  campaignId: string
  userId: string
  type: CampaignType
  enqueuedAt: string
}

/**
 * Publish a campaign job to RabbitMQ with publisher confirms. Opens a
 * short-lived connection per publish (campaign starts are infrequent); a
 * pooled connection can replace this later if needed.
 */
export async function publishCampaignJob(job: CampaignJob): Promise<void> {
  const connection = await connectAmqp()
  try {
    const channel = await connection.createConfirmChannel()
    await assertTopology(channel)

    channel.publish(
      JOBS_EXCHANGE,
      QUEUES[job.type].routingKey,
      Buffer.from(JSON.stringify(job)),
      { persistent: true, contentType: 'application/json' }
    )
    await channel.waitForConfirms()
    await channel.close()
  } finally {
    await connection.close()
  }
}
