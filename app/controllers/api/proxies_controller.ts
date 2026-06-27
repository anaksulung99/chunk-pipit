import type { HttpContext } from '@adonisjs/core/http'
import Proxy from '#models/proxy'
import { crawleeHealthCheck, type ProxyProtocol } from '#services/proxy/health_check'
import { DateTime } from 'luxon'

export default class ProxiesController {
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
    if (!body.proxyId) {
      return response.badRequest({
        status: 400,
        message: 'ID proxy tidak ditemukan atau kosong.',
        data: 'server_error',
      })
    }

    const proxy = await Proxy.query()
      .where('id', body.proxyId)
      .where('user_id', user.id)
      .firstOrFail()

    if (!proxy) {
      return response.notFound({
        status: 404,
        message: 'Proxy tidak ditemukan.',
        data: 'server_error',
      })
    }

    const result = await crawleeHealthCheck(
      proxy.protocol as ProxyProtocol,
      proxy.host,
      proxy.port,
      {
        username: proxy.username,
        password: proxy.password,
        timeoutMs: 5000,
        testUrl: 'https://api.ipify.org?format=json',
      }
    )

    proxy.merge({
      status: result.status,
      responseMs: result.responseMs,
      lastCheckedAt: DateTime.now(),
      asn: result.ipinfo?.asn?.toString() ?? null,
      country: result.ipinfo?.country_code?.toString() ?? null,
    })
    await proxy.save()

    return response.json({
      status: 200,
      message: `Status proxy "${proxy.id}" → ${result.status}.`,
      data: result.status,
    })
  }
}
