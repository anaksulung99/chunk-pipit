import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (_, { inertia }) => inertia.render('errors/not_found', {}),
    '500..599': (_, { inertia }) => inertia.render('errors/server_error', {}),
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: any, ctx: HttpContext) {
    const isJsonRequested = ctx.request.accepts(['html', 'json']) === 'json'

    if (isJsonRequested) {
      if (error.code === 'E_VALIDATION_ERROR') {
        return ctx.response.status(422).json({
          status: 'fail',
          message: 'Validasi data gagal',
          errors: error.messages,
        })
      }

      if (error.code === 'E_ROW_NOT_FOUND') {
        return ctx.response.status(404).json({
          status: 'fail',
          message: 'Data tidak ditemukan di database',
        })
      }

      if (error.code === 'E_UNAUTHORIZED_ACCESS') {
        return ctx.response.status(401).json({
          status: 'fail',
          message: 'Sesi kosong, silakan login terlebih dahulu',
        })
      }

      if (error.code === '23505' || error.code === 'ER_DUP_ENTRY') {
        return ctx.response.status(409).json({
          status: 'fail',
          message: 'Gagal menyimpan, data tersebut sudah terdaftar di sistem',
        })
      }

      const status = error.status || 500
      return ctx.response.status(status).json({
        status: 'error',
        message: error.message || 'Terjadi kesalahan pada internal server',
      })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }
}
