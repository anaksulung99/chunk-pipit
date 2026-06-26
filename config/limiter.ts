import { defineConfig, stores } from '@adonisjs/limiter'

/**
 * Rate limiter configuration. Uses an in-memory store, which is adequate for a
 * single web container — counters reset on restart, which is fine for the only
 * use case here (blunting auth brute-force). Switch to the redis/database store
 * if the web service is ever scaled to multiple instances.
 */
const limiterConfig = defineConfig({
  default: 'memory',
  stores: {
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
