import SessionLog from '#models/session_log'
import Campaign from '#models/campaign'
import type { HttpContext } from '@adonisjs/core/http'
import { bulkSessionLogValidator } from '#validators/session_log'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'action', 'status'] as const

export default class SessionLogsController {
  private scoped(
    userId: string,
    filters: {
      search?: string
      status?: string
      campaignId?: string
      startDate?: string
      endDate?: string
    }
  ) {
    const query = SessionLog.query().whereHas('campaign', (c) => c.where('user_id', userId))

    if (filters.status && filters.status !== 'all') query.where('status', filters.status)
    if (filters.campaignId && filters.campaignId !== 'all') {
      query.where('campaign_id', filters.campaignId)
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => sub.whereILike('message', term).orWhereILike('action', term))
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
    const perPage = Math.min(Number(request.input('per_page', 25)) || 25, 200)
    const search = request.input('search')?.toString().trim() || undefined
    const status = request.input('status')?.toString() || 'all'
    const campaignId = request.input('campaignId')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, { search, status, campaignId, startDate, endDate })
      .preload('campaign')
      .orderBy(sort, order)
      .paginate(page, perPage)

    const data = result.all().map((log) => ({
      id: log.id,
      action: log.action,
      status: log.status,
      message: log.message,
      workerId: log.workerId,
      durationMs: log.durationMs,
      campaignId: log.campaignId,
      campaignName: log.campaign?.name ?? '—',
      createdAt: log.createdAt ? log.createdAt.toISO() : null,
    }))

    // Campaign options for the filter dropdown.
    const campaigns = await Campaign.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
      .select('id', 'name')

    const allOwn = await SessionLog.query()
      .whereHas('campaign', (c) => c.where('user_id', user.id))
      .orderBy('id', 'asc')

    const stats = {
      total: allOwn.length,
      success: allOwn.filter((log) => log.status === 'success').length,
      failed: allOwn.filter((log) => log.status === 'failed').length,
      skipped: allOwn.filter((log) => log.status === 'skipped').length,
      checkpoint: allOwn.filter((log) => log.status === 'checkpoint').length,
    }

    return inertia.render('logs/index', {
      logs: {
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
      campaigns: campaigns.map((c) => ({ id: c.id, name: c.name })),
      filters: {
        search: search ?? '',
        status,
        campaignId,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkSessionLogValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        status: payload.filters?.status,
        startDate: this.validDate(payload.filters?.startDate),
        endDate: this.validDate(payload.filters?.endDate),
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      // eslint-disable-next-line @unicorn/no-await-expression-member
      ids = (await query.select('id')).map((row) => row.id)
    }

    if (!ids.length) {
      session.flash('error', 'Tidak ada fingerprint terpilih.')
      return response.redirect().back()
    }

    await SessionLog.query().whereIn('id', ids).delete()
    session.flash('success', `${ids.length} session log dihapus.`)
    return response.redirect().back()
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
