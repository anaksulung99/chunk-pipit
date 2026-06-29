import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * Rate limiter configuration.
 *
 * The default store is driven by LIMITER_STORE (memory | redis). Dev keeps
 * `memory` (no Redis required); production sets `redis` in app.env and the
 * Electron sidecar guarantees a local Redis is running. Counters in `memory`
 * reset on restart, which is fine for blunting auth brute-force.
 */
const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE') ?? 'memory',
  stores: {
    memory: stores.memory({}),
    redis: stores.redis({ connectionName: 'main' }),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
