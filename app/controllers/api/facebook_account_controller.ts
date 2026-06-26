import type { HttpContext } from '@adonisjs/core/http'
import FacebookAccount from '#models/facebook_account'
import { checkAccountHealth } from '#services/account/health_check'

export default class FacebookAccountController {
  async healthCheck({ response, auth, request }: HttpContext) {
    const user = auth.user
    if (!user?.id) {
      return response.notFound({
        status: 404,
        message: 'User ID tidak ditemukan.',
        data: 'server_error',
      })
    }

    const body = request.body()
    if (!body.accountId) {
      return response.badRequest({
        status: 400,
        message: 'ID akun tidak ditemukan.',
        data: 'server_error',
      })
    }

    const account = await FacebookAccount.query()
      .where('id', body.accountId)
      .where('user_id', user.id)
      .preload('cookies')
      .firstOrFail()

    if (account.cookies.length <= 0) {
      return response.notFound({
        status: 404,
        message: 'Akun tidak memiliki cookie.',
        data: 'server_error',
      })
    }

    const healthState = await checkAccountHealth(account)
    if (healthState === 'server_error') {
      return response.internalServerError({
        status: 500,
        message: 'Gagal cek status akun.',
        data: 'server_error',
      })
    }

    account.sessionStatus = healthState
    await account.save()

    return response.json({
      status: 200,
      message: `Status akun "${account.label}" → ${healthState}.`,
      data: account.sessionStatus,
    })
  }
}
