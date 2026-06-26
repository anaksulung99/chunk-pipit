/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Mail
  SMTP_HOST: Env.schema.string.optional(),
  SMTP_PORT: Env.schema.number.optional(),
  SMTP_USER: Env.schema.string.optional(),
  SMTP_PASSWORD: Env.schema.string.optional(),
  SMTP_FROM_NAME: Env.schema.string.optional(),
  SMTP_FROM_EMAIL: Env.schema.string.optional(),

  // Database (PostgreSQL)
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  // DB_SSL: Env.schema.boolean.optional(),
  DB_URL: Env.schema.string(),

  // Redis
  REDIS_HOST: Env.schema.string({ format: 'host' }),
  REDIS_PORT: Env.schema.number(),
  REDIS_PASSWORD: Env.schema.string.optional(),

  // # RabbitMQ
  HEALTHCHECK_ENQUEUE_ENABLED: Env.schema.boolean.optional(),
  RABBITMQ_URL: Env.schema.string.optional(),
  RABBITMQ_HOST: Env.schema.string.optional(),
  RABBITMQ_PORT: Env.schema.number.optional(),
  RABBITMQ_USER: Env.schema.string.optional(),
  RABBITMQ_PASSWORD: Env.schema.string.optional(),
  RABBITMQ_VHOST: Env.schema.string.optional(),

  // Default admin email
  DEFAULT_ADMIN_EMAIL: Env.schema.string.optional(),
  DEFAULT_ADMIN_NAME: Env.schema.string.optional(),
  DEFAULT_ADMIN_PASSWORD: Env.schema.string.optional(),
  // Optional fixed license key for the seeded admin (testing). If empty, a
  // random key is generated and printed by the seeder.
  DEFAULT_ADMIN_LICENSE_KEY: Env.schema.string.optional(),
  ENABLE_REGISTER: Env.schema.boolean.optional(),
})
