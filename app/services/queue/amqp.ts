import amqplib from 'amqplib'
import env from '#start/env'
import {
  JOBS_EXCHANGE,
  DLX_EXCHANGE,
  DEAD_LETTER_QUEUE,
  QUEUES,
} from '#services/queue/topology'

/**
 * Connection options for CloudAMQP. Prefers a full RABBITMQ_URL when set,
 * otherwise builds from parts. The vhost loses a single leading slash so the
 * `.env` value `/dlhujakg` maps to the CloudAMQP vhost `dlhujakg` (the root
 * vhost `/` is preserved).
 */
export function amqpConnectionOptions(): string | amqplib.Options.Connect {
  const url = env.get('RABBITMQ_URL')
  if (url) return url

  const rawVhost = env.get('RABBITMQ_VHOST') ?? '/'
  const vhost = rawVhost === '/' ? '/' : rawVhost.replace(/^\//, '')

  return {
    protocol: 'amqp',
    hostname: env.get('RABBITMQ_HOST'),
    port: Number(env.get('RABBITMQ_PORT') ?? 5672),
    username: env.get('RABBITMQ_USER'),
    password: env.get('RABBITMQ_PASSWORD'),
    vhost,
  }
}

export async function connectAmqp() {
  return amqplib.connect(amqpConnectionOptions())
}

/** Idempotently declares the exchange/queue/DLX topology on a channel. */
export async function assertTopology(channel: amqplib.Channel) {
  await channel.assertExchange(JOBS_EXCHANGE, 'direct', { durable: true })
  await channel.assertExchange(DLX_EXCHANGE, 'fanout', { durable: true })
  await channel.assertQueue(DEAD_LETTER_QUEUE, { durable: true })
  await channel.bindQueue(DEAD_LETTER_QUEUE, DLX_EXCHANGE, '')

  for (const { queue, routingKey } of Object.values(QUEUES)) {
    await channel.assertQueue(queue, {
      durable: true,
      arguments: { 'x-dead-letter-exchange': DLX_EXCHANGE },
    })
    await channel.bindQueue(queue, JOBS_EXCHANGE, routingKey)
  }
}
