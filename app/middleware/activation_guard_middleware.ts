import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Blocks access to the app until the device is activated.
 *
 * A successful /api/activation/{activate,verify} establishes a web session for
 * the bound user, so "has an authenticated web session" == "activated on this
 * launch". Unactivated requests are redirected to the activation page (web) or
 * rejected with a JSON 401 (api/xhr).
 */
export default class ActivationGuardMiddleware {
  async handle(ctx: HttpContext, next: NextFn) {
    if (await ctx.auth.use('web').check()) {
      return next()
    }

    if (ctx.request.url().startsWith('/api/') || ctx.request.accepts(['html', 'json']) === 'json') {
      return ctx.response.unauthorized({
        ok: false,
        code: 'E_NOT_ACTIVATED',
        message: 'Perangkat belum teraktivasi.',
      })
    }

    ctx.session.flash('error', 'Perangkat belum teraktivasi. Silakan aktivasi terlebih dahulu.')
    return ctx.response.redirect('/activation')
  }
}
