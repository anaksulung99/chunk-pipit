import Proxy from '#models/proxy'
import { createProxyValidator, importProxiesValidator, bulkProxyValidator } from '#validators/proxy'
import { crawleeHealthCheck, type ProxyProtocol } from '#services/proxy/health_check'
import { parseProxyLine } from '#services/proxy/parse'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'host', 'status', 'response_ms'] as const

export default class ProxiesController {
  /** Proxies are owner-scoped: each user manages their own pool. */
  private scoped(
    userId: string,
    filters: {
      search?: string
      status?: string
      protocol?: string
      startDate?: string
      endDate?: string
    }
  ) {
    const query = Proxy.query().where('user_id', userId)

    if (filters.status && filters.status !== 'all') query.where('status', filters.status)
    if (filters.protocol && filters.protocol !== 'all') query.where('protocol', filters.protocol)
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => sub.whereILike('host', term).orWhereILike('username', term))
    }
    if (filters.startDate) {
      query.where(
        'created_at',
        '>=',
        DateTime.fromISO(filters.startDate, { zone: 'utc' }).startOf('day').toSQL()!
      )
    }
    if (filters.endDate) {
      query.where(
        'created_at',
        '<=',
        DateTime.fromISO(filters.endDate, { zone: 'utc' }).endOf('day').toSQL()!
      )
    }

    return query
  }

  async index({ request, inertia, auth }: HttpContext) {
    const user = auth.user!
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('per_page', 15)) || 15, 100)
    const search = request.input('search')?.toString().trim() || undefined
    const status = request.input('status')?.toString() || 'all'
    const protocol = request.input('protocol')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, { search, status, protocol, startDate, endDate })
      .orderBy(sort, order)
      .paginate(page, perPage)

    const allOwn = await Proxy.query()
      .where('user_id', user.id)
      .select('id', 'protocol', 'status')
      .orderBy('id', 'asc')

    const stats = {
      total: allOwn.length,
      http: allOwn.filter((proxy) => proxy.protocol === 'http').length,
      https: allOwn.filter((proxy) => proxy.protocol === 'https').length,
      socks4: allOwn.filter((proxy) => proxy.protocol === 'socks4').length,
      socks5: allOwn.filter((proxy) => proxy.protocol === 'socks5').length,
      healthy: allOwn.filter((proxy) => proxy.status === 'healthy').length,
      unchecked: allOwn.filter((proxy) => proxy.status === 'unchecked').length,
      slow: allOwn.filter((proxy) => proxy.status === 'slow').length,
      dead: allOwn.filter((proxy) => proxy.status === 'dead').length,
    }

    const data = result.all().map((proxy) => ({
      id: proxy.id,
      protocol: proxy.protocol,
      host: proxy.host,
      port: proxy.port,
      username: proxy.username,
      status: proxy.status,
      responseMs: proxy.responseMs,
      lastCheckedAt: proxy.lastCheckedAt ? proxy.lastCheckedAt.toISO() : null,
      createdAt: proxy.createdAt ? proxy.createdAt.toISO() : null,
    }))

    return inertia.render('proxies/index', {
      proxies: {
        data,
        stats,
        meta: {
          total: result.total,
          perPage: result.perPage,
          currentPage: result.currentPage,
          lastPage: result.lastPage,
          firstPage: result.firstPage,
        },
      },
      filters: {
        search: search ?? '',
        status,
        protocol,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(createProxyValidator)
    try {
      await Proxy.create({
        userId: auth.user!.id,
        protocol: payload.protocol,
        host: payload.host,
        port: payload.port,
        username: payload.username ?? null,
        password: payload.password ?? null,
      })
      session.flash('success', 'Proxy ditambahkan.')
    } catch (error) {
      if ((error as { code?: string }).code === '23505') {
        session.flash('error', 'Proxy dengan host/port/protocol yang sama sudah ada.')
      } else {
        throw error
      }
    }
    return response.redirect().back()
  }

  async import({ request, response, session, auth }: HttpContext) {
    const { text } = await request.validateUsing(importProxiesValidator)
    const userId = auth.user!.id

    let added = 0
    let skipped = 0
    for (const line of text.split(/\r?\n/)) {
      const parsed = parseProxyLine(line)
      if (!parsed) {
        if (line.trim()) skipped++
        continue
      }
      await Proxy.updateOrCreate(
        { userId, protocol: parsed.protocol, host: parsed.host, port: parsed.port },
        {
          userId,
          protocol: parsed.protocol,
          host: parsed.host,
          port: parsed.port,
          username: parsed.username,
          password: parsed.password,
        }
      )
      added++
    }

    session.flash(
      'success',
      `${added} proxy diimpor${skipped ? `, ${skipped} baris dilewati` : ''}.`
    )
    return response.redirect().back()
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const proxy = await Proxy.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    await proxy.delete()
    session.flash('success', 'Proxy dihapus.')
    return response.redirect().back()
  }

  async healthCheck({ params, response, session, auth }: HttpContext) {
    const proxy = await Proxy.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()

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

    session.flash(
      'success',
      `Health check: ${result.status}${result.responseMs !== null ? ` (${result.responseMs}ms)` : ''}.`
    )
    return response.redirect().back()
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkProxyValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        status: payload.filters?.status,
        protocol: payload.filters?.protocol,
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      const rows = await query.select('id')
      ids = rows.map((row: Proxy) => row.id)
    }

    if (!ids.length) {
      session.flash('error', 'Tidak ada proxy terpilih.')
      return response.redirect().back()
    }

    if (payload.action === 'delete') {
      await Proxy.query().where('user_id', userId).whereIn('id', ids).delete()
      session.flash('success', `${ids.length} proxy dihapus.`)
    } else if (payload.action === 'set_status') {
      await Proxy.query()
        .where('user_id', userId)
        .whereIn('id', ids)
        .update({ status: payload.status ?? 'unchecked' })
      session.flash('success', `${ids.length} proxy diperbarui.`)
    } else {
      const proxies = await Proxy.query().where('user_id', userId).whereIn('id', ids)
      await Promise.all(
        proxies.map(async (proxy) => {
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
          })
          await proxy.save()
        })
      )
      session.flash('success', `Health check selesai untuk ${proxies.length} proxy.`)
    }

    return response.redirect().back()
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
