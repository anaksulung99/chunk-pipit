import db from '@adonisjs/lucid/services/db'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Liveness/readiness probe used by the production sidecar supervisor to know
 * when the AdonisJS server is up before loading the Electron window. Public
 * (no activation gate) so it can be polled at startup.
 */
export default class HealthController {
  async index({ response }: HttpContext) {
    let dbOk = false
    try {
      await db.rawQuery('select 1')
      dbOk = true
    } catch {
      dbOk = false
    }
    return response.status(dbOk ? 200 : 503).send({ ok: dbOk, db: dbOk, ts: Date.now() })
  }
}
