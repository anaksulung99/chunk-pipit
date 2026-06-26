import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * Consumes campaign jobs from RabbitMQ. In A.3 this is a stub that just
 * acknowledges receipt and records a session_log row — the real Crawlee /
 * Playwright execution engine is wired in A.4.
 *
 *   node ace queue:work
 */
export default class QueueWork extends BaseCommand {
  static commandName = 'queue:work'
  static description = 'Consume campaign jobs from RabbitMQ and process them'
  static options: CommandOptions = { startApp: true, staysAlive: true }

  async run() {
    const { connectAmqp, assertTopology } = await import('#services/queue/amqp')
    const { QUEUES } = await import('#services/queue/topology')
    const { runCampaign } = await import('#services/automation/campaign_runner')

    const connection = await connectAmqp()
    const channel = await connection.createChannel()
    await assertTopology(channel)
    channel.prefetch(5)

    this.logger.info('queue:work connected to RabbitMQ — waiting for jobs…')

    for (const { queue } of Object.values(QUEUES)) {
      await channel.consume(queue, async (message) => {
        if (!message) return
        try {
          const job = JSON.parse(message.content.toString())
          this.logger.info(`job: ${job.type} campaign=${job.campaignId}`)

          await runCampaign(job.campaignId)

          channel.ack(message)
        } catch (error) {
          this.logger.error(error instanceof Error ? error.message : String(error))
          // Don't requeue malformed/failed messages — route to the dead-letter queue.
          channel.nack(message, false, false)
        }
      })
    }

    const shutdown = async () => {
      try {
        await channel.close()
        await connection.close()
      } catch {
        // ignore
      }
    }
    this.app.terminating(shutdown)
  }
}
