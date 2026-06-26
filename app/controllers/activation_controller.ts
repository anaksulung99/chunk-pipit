import { ActivationService, type ActivationResult } from '#services/license/activation_service'
import ActivationException from '#exceptions/activation_exception'
import { activateValidator, verifyValidator } from '#validators/activation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * Device activation API consumed by the Electron client.
 *
 * - POST /api/activation/activate → first activation ("login"): bind license to device
 * - POST /api/activation/verify   → per-launch online check (required every launch)
 *
 * On success a web session is established for the bound user so subsequent
 * management API calls are authenticated. Endpoints are public (they are the
 * gate) and CSRF-exempt (see config/shield.ts `exceptRoutes`).
 */
export default class ActivationController {
  async activate({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(activateValidator)
    try {
      const result = await new ActivationService().activate({ ...payload, ip: request.ip() })
      await auth.use('web').login(result.user)
      return response.ok(this.present(result))
    } catch (error) {
      return this.handle(error, response)
    }
  }

  async verify({ request, response, auth }: HttpContext) {
    const payload = await request.validateUsing(verifyValidator)
    try {
      const result = await new ActivationService().verify({ ...payload, ip: request.ip() })
      await auth.use('web').login(result.user)
      return response.ok(this.present(result))
    } catch (error) {
      return this.handle(error, response)
    }
  }

  private present({ user, license, device }: ActivationResult) {
    return {
      ok: true,
      data: {
        user: { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
        license: { key: license.key, status: license.status, expiresAt: license.expiresAt },
        device: {
          id: device.id,
          deviceId: device.deviceId,
          status: device.status,
          lastVerifiedAt: device.lastVerifiedAt,
        },
      },
    }
  }

  private handle(error: unknown, response: HttpContext['response']) {
    if (error instanceof ActivationException) {
      return response
        .status(error.status ?? 403)
        .send({ ok: false, code: error.code, message: error.message })
    }
    throw error
  }
}
