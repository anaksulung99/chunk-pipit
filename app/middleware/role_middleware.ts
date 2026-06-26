import type { HttpContext } from '@adonisjs/core/http'
import type { NextFn } from '@adonisjs/core/types/http'

/**
 * Restricts a route to users whose role is in the allowed list.
 * Assumes an authenticated session (apply after the activation/auth guard).
 *
 *   .use([middleware.activation(), middleware.role({ roles: ['superadmin'] })])
 */
export default class RoleMiddleware {
  async handle(ctx: HttpContext, next: NextFn, options: { roles: string[] }) {
    const user = ctx.auth.user
    if (!user || !options.roles.includes(user.role ?? '')) {
      if (ctx.request.url().startsWith('/api/')) {
        return ctx.response.forbidden({ ok: false, code: 'E_FORBIDDEN', message: 'Akses ditolak.' })
      }
      ctx.session.flash('error', 'Akses ditolak — hanya untuk superadmin.')
      return ctx.response.redirect('/')
    }
    return next()
  }
}
