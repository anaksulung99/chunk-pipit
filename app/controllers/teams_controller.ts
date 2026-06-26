/* eslint-disable @unicorn/no-await-expression-member */
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'
import License from '#models/license'
import Campaign from '#models/campaign'
import FacebookGroup from '#models/facebook_group'
import FacebookAccount from '#models/facebook_account'
import Proxy from '#models/proxy'
import FingerprintProfile from '#models/fingerprint_profile'
import SessionLog from '#models/session_log'
import { DateTime } from 'luxon'
import {
  bulkTeamValidator,
  inviteTeamValidator,
  setStatusTeamValidator,
  updateUserValidator,
} from '#validators/user'
import { generateLicenseKey } from '#services/license/license_key'
import encryption from '@adonisjs/core/services/encryption'
import FacebookProfile from '#models/facebook_profile'

const SORTABLE = ['created_at', 'full_name', 'email', 'role', 'is_active'] as const

function tally(values: (string | null)[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const value of values) {
    const key = value ?? 'unknown'
    out[key] = (out[key] ?? 0) + 1
  }
  return out
}

function classifyLogStatus(status: string | null) {
  const normalized = (status ?? '').toLowerCase()
  if (['success', 'completed', 'done'].includes(normalized)) return 'success'
  if (['failed', 'error'].includes(normalized)) return 'failed'
  return 'other'
}

export default class TeamsController {
  private scoped(filters: {
    search?: string
    role?: string
    status?: string
    startDate?: string
    endDate?: string
  }) {
    const query = User.query()

    if (filters.status && filters.status !== 'all') {
      const isActive = filters.status === 'active'
      query.where('is_active', isActive)
    }
    if (filters.role && filters.role !== 'all') query.where('role', filters.role)
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => sub.whereILike('full_name', term).orWhereILike('email', term))
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

  async index({ inertia, request }: HttpContext) {
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('per_page', 15)) || 15, 100)
    const search = request.input('search')?.toString().trim() || undefined
    const status = request.input('status')?.toString() || 'all'
    const role = request.input('role')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped({ search, role, status, startDate, endDate })
      .orderBy(sort, order)
      .preload('license')
      .paginate(page, perPage)

    const allUser = await User.query()
      .select('id', 'role', 'is_active')
      .orderBy('created_at', 'desc')

    const data = result.all().map((item) => ({
      id: item.id,
      fullName: item.fullName,
      email: item.email,
      role: item.role,
      isActive: item.isActive,
      lastLoginAt: item.lastLoginAt?.toISO(),
      createdAt: item.createdAt.toISO(),
      updatedAt: item.updatedAt?.toISO(),
      license: item.license
        ? {
            id: item.license.id,
            key: item.license.key,
            status: item.license.status,
            maxDevices: item.license.maxDevices,
            plan: item.license.plan,
            issuedAt: item.license.issuedAt?.toISO(),
            expiresAt: item.license.expiresAt?.toISO(),
            notes: item.license.notes,
            createdAt: item.license.createdAt.toISO(),
            updatedAt: item.license.updatedAt?.toISO(),
          }
        : undefined,
    }))

    const stats = {
      total: allUser.length,
      admin: allUser.filter((item) => item.role === 'superadmin').length,
      team: allUser.filter((item) => item.role === 'team').length,
      active: allUser.filter((item) => item.isActive).length,
      inactive: allUser.filter((item) => !item.isActive).length,
    }

    return inertia.render('teams/index', {
      users: {
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
        role,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async store({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(inviteTeamValidator)

    const expiresAt = payload.expiresAt
      ? DateTime.fromISO(payload.expiresAt, { zone: 'utc' }).endOf('day')
      : null
    if (expiresAt && !expiresAt.isValid) {
      session.flash('error', 'Tanggal kedaluwarsa lisensi tidak valid.')
      return response.redirect().back()
    }

    const result = await db.transaction(async (trx) => {
      const user = await User.create(
        {
          fullName: payload.fullName,
          email: payload.email,
          password: payload.password,
          role: payload.role,
          isActive: true,
        },
        { client: trx }
      )

      const license = await License.create(
        {
          userId: user.id,
          key: generateLicenseKey(),
          status: 'active',
          maxDevices: payload.maxDevices ?? 1,
          plan: 'team',
          issuedAt: DateTime.now(),
          expiresAt,
        },
        { client: trx }
      )

      return { user, license }
    })

    session.flash(
      'success',
      `Akun "${result.user.email}" dan lisensi "${result.license.key}" berhasil dibuat.`
    )
    return response.redirect().back()
  }

  async show({ params, inertia, request }: HttpContext) {
    const team = await User.query().where('id', params.id).firstOrFail()

    const todayStart = DateTime.now().startOf('day').toSQL()!
    const { analyticsStart, analyticsEnd, analyticsDayCount } = this.resolveAnalyticsRange(request)

    const [
      campaignRows,
      groupRows,
      accountRows,
      proxyRows,
      fingerprintCount,
      facebookProfileCount,
      analyticsLogs,
    ] = await Promise.all([
      Campaign.query().where('user_id', team.id).select('status', 'type'),
      FacebookGroup.query().where('user_id', team.id).select('group_type'),
      FacebookAccount.query().where('user_id', team.id).select('session_status'),
      Proxy.query().where('user_id', team.id).select('status'),
      FingerprintProfile.query().where('user_id', team.id).count('* as total'),
      FacebookProfile.query().where('user_id', team.id).count('* as totalProfiles'),
      SessionLog.query()
        .whereHas('campaign', (c) => c.where('user_id', team.id))
        .where('created_at', '>=', analyticsStart.toSQL()!)
        .where('created_at', '<=', analyticsEnd.toSQL()!)
        .select('action', 'status', 'created_at'),
    ])

    const licenses = await License.query().where('user_id', team.id).preload('devices')

    const runningCampaigns = await Campaign.query()
      .where('user_id', team.id)
      .where('status', 'running')
      .preload('groups')
      .orderBy('started_at', 'desc')

    const recentLogs = await SessionLog.query()
      .whereHas('campaign', (c) => c.where('user_id', team.id))
      .preload('campaign')
      .orderBy('created_at', 'desc')
      .limit(15)

    const todayActions = await SessionLog.query()
      .whereHas('campaign', (c) => c.where('user_id', team.id))
      .whereIn('action', ['auto_share', 'auto_join', 'scrape'])
      .where('created_at', '>=', todayStart)
      .select('status')

    const topFbAccounts = await FacebookAccount.query()
      .where('user_id', team.id)
      .orderBy('created_at', 'desc')
      .limit(15)

    const topFbGroups = await FacebookGroup.query()
      .where('user_id', team.id)
      .orderBy('created_at', 'desc')
      .limit(15)

    const todayByStatus = tally(todayActions.map((l) => l.status))

    const dailyActivityMap = new Map<
      string,
      { date: string; label: string; total: number; success: number; failed: number }
    >()
    for (let index = 0; index < analyticsDayCount; index++) {
      const day = analyticsStart.plus({ days: index })
      const key = day.toISODate()!
      dailyActivityMap.set(key, {
        date: key,
        label: day.setLocale('id').toFormat('dd LLL'),
        total: 0,
        success: 0,
        failed: 0,
      })
    }

    const actionBreakdownMap = new Map<
      string,
      { action: string; total: number; success: number; failed: number; lastAt: string | null }
    >()

    for (const log of analyticsLogs) {
      const statusKind = classifyLogStatus(log.status)
      const createdAt = log.createdAt?.toISO() ?? null
      const dayKey = log.createdAt?.toISODate()

      if (dayKey && dailyActivityMap.has(dayKey)) {
        const dayBucket = dailyActivityMap.get(dayKey)!
        dayBucket.total++
        if (statusKind === 'success') dayBucket.success++
        if (statusKind === 'failed') dayBucket.failed++
      }

      const actionBucket = actionBreakdownMap.get(log.action) ?? {
        action: log.action,
        total: 0,
        success: 0,
        failed: 0,
        lastAt: null,
      }
      actionBucket.total++
      if (statusKind === 'success') actionBucket.success++
      if (statusKind === 'failed') actionBucket.failed++
      if (
        createdAt &&
        (!actionBucket.lastAt ||
          DateTime.fromISO(createdAt).toMillis() > DateTime.fromISO(actionBucket.lastAt).toMillis())
      ) {
        actionBucket.lastAt = createdAt
      }
      actionBreakdownMap.set(log.action, actionBucket)
    }

    const campaignTypeMap = new Map<
      string,
      {
        type: string
        total: number
        draft: number
        running: number
        paused: number
        completed: number
        failed: number
      }
    >()
    for (const campaign of campaignRows) {
      const bucket = campaignTypeMap.get(campaign.type) ?? {
        type: campaign.type,
        total: 0,
        draft: 0,
        running: 0,
        paused: 0,
        completed: 0,
        failed: 0,
      }
      bucket.total++
      const status = campaign.status.toLowerCase()
      if (status === 'draft') bucket.draft++
      else if (status === 'running') bucket.running++
      else if (status === 'paused') bucket.paused++
      else if (status === 'completed') bucket.completed++
      else if (status === 'failed') bucket.failed++
      campaignTypeMap.set(campaign.type, bucket)
    }

    const dailyActivity = Array.from(dailyActivityMap.values())
    const actionBreakdown = Array.from(actionBreakdownMap.values())
      .sort((left, right) => right.total - left.total)
      .slice(0, 6)
    const campaignTypeBreakdown = Array.from(campaignTypeMap.values()).sort(
      (left, right) => right.total - left.total
    )
    const totalLogVolume = dailyActivity.reduce((total, day) => total + day.total, 0)
    const successLogVolume = dailyActivity.reduce((total, day) => total + day.success, 0)
    const failedLogVolume = dailyActivity.reduce((total, day) => total + day.failed, 0)
    const successRate =
      totalLogVolume > 0 ? Math.round((successLogVolume / totalLogVolume) * 1000) / 10 : 0

    const licensesMap = licenses.map((l) => ({
      id: l.id,
      userId: l.userId,
      key: l.key,
      status: l.status,
      maxDevices: l.maxDevices,
      plan: l.plan,
      notes: l.notes,
      issuedAt: l.issuedAt.toISO(),
      expiresAt: l.expiresAt?.toISO() ?? null,
      createdAt: l.createdAt.toISO(),
      updatedAt: l.updatedAt?.toISO() ?? null,
      devices: l.devices.map((device) => ({
        id: device.id,
        licenseId: device.licenseId,
        userId: device.userId,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        os: device.os,
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        status: device.status,
        lastIp: device.lastIp,
        firstActivatedAt: device.firstActivatedAt.toISO(),
        lastVerifiedAt: device.lastVerifiedAt?.toISO() ?? null,
        revokedAt: device.revokedAt?.toISO() ?? null,
        createdAt: device.createdAt.toISO(),
        updatedAt: device.updatedAt?.toISO() ?? null,
      })),
    }))

    return inertia.render('teams/show', {
      team: {
        id: team.id,
        fullName: team.fullName,
        email: team.email,
        role: team.role ?? 'team',
        isActive: team.isActive ?? false,
        lastLoginAt: team.lastLoginAt ? team.lastLoginAt.toISO() : null,
        createdAt: team.createdAt ? team.createdAt.toISO() : null,
        updatedAt: team.updatedAt ? team.updatedAt.toISO() : null,
      },
      licenses: licensesMap,
      stats: {
        campaigns: {
          total: campaignRows.length,
          byStatus: tally(campaignRows.map((c) => c.status)),
        },
        groups: { total: groupRows.length, byType: tally(groupRows.map((g) => g.groupType)) },
        accounts: {
          total: accountRows.length,
          byStatus: tally(accountRows.map((a) => a.sessionStatus)),
        },
        proxies: { total: proxyRows.length, byStatus: tally(proxyRows.map((p) => p.status)) },
        fingerprints: Number((fingerprintCount[0] as any).$extras.total ?? 0),
        facebookProfiles: Number((facebookProfileCount[0] as any).$extras.totalProfiles ?? 0),
        today: {
          total: todayActions.length,
          success: todayByStatus.success ?? 0,
          failed: todayByStatus.failed ?? 0,
        },
      },
      running: runningCampaigns.map((c) => {
        const total = c.groups.length
        const done = c.groups.filter((g) => g.status === 'done').length
        return { id: c.id, name: c.name, type: c.type, total, done }
      }),
      analytics: {
        windowLabel: `${analyticsStart.setLocale('id').toFormat('dd LLL')} - ${analyticsEnd.setLocale('id').toFormat('dd LLL')} · ${analyticsDayCount} hari`,
        totalLogVolume,
        successLogVolume,
        failedLogVolume,
        successRate,
        dailyActivity,
        actionBreakdown,
        campaignTypeBreakdown,
      },
      filters: {
        startDate: analyticsStart.toISODate(),
        endDate: analyticsEnd.toISODate(),
      },
      recentLogs: recentLogs.map((l) => ({
        id: l.id,
        action: l.action,
        status: l.status,
        message: l.message,
        campaignId: l.campaignId,
        campaignName: l.campaign?.name ?? '—',
        createdAt: l.createdAt ? l.createdAt.toISO() : null,
      })),
      fbAccounts: topFbAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        fbUserId: a.fbUserId,
        profileUrl: a.profileUrl,
        sessionStatus: a.sessionStatus,
        lastUsedAt: a.lastUsedAt ? a.lastUsedAt.toISO() : null,
        createdAt: a.createdAt ? a.createdAt.toISO() : null,
      })),
      fbGroups: topFbGroups.map((g) => ({
        id: g.id,
        groupId: g.groupId,
        groupName: g.groupName,
        groupType: g.groupType,
        groupUrl: g.groupUrl,
        memberCount: g.memberCount ?? 0,
        sourceFriendUrl: g.sourceFriendUrl,
        sourceKeyword: g.sourceKeyword,
        sourceType: g.sourceType,
        tags: g.tags?.join(',') ?? null,
        createdAt: g.createdAt ? g.createdAt.toISO() : null,
      })),
    })
  }

  async update({ params, request, response, session }: HttpContext) {
    try {
      const id = params.id
      if (!id) {
        return response.unauthorized()
      }

      const payload = await request.validateUsing(updateUserValidator(id))

      const user = await User.query().where('id', id).firstOrFail()
      const license = await License.query().where('user_id', id).firstOrFail()

      await Promise.all([
        user
          .merge({
            fullName: payload.fullName,
            email: payload.email,
            role: payload.role,
          })
          .save(),
        license
          .merge({
            maxDevices: payload.maxDevices,
            expiresAt: payload.expiresAt
              ? DateTime.fromISO(payload.expiresAt, { zone: 'utc' }).endOf('day')
              : license.expiresAt,
          })
          .save(),
      ])
    } catch (error) {
      session.flash('error', 'Profile update failed')
      return response.redirect().back()
    }

    session.flash('success', 'Profile updated')
    return response.redirect().back()
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    if (auth.user?.id === params.id) {
      session.flash('error', 'Anda tidak boleh menghapus akunmu sendiri.')
      return response.redirect().back()
    }

    const team = await User.query().where('id', params.id).firstOrFail()
    if (team.role === 'superadmin') {
      session.flash('error', 'Superadmin tidak boleh dihapus.')
      return response.redirect().back()
    }

    await team.delete()
    session.flash('success', 'Akun team dihapus.')
    return response.redirect().back()
  }

  async bulk({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(bulkTeamValidator)

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const startDate = this.validDate(payload.filters?.startDate)
      const endDate = this.validDate(payload.filters?.endDate)
      const query = this.scoped({
        search: payload.filters?.search,
        role: payload.filters?.role,
        status: payload.filters?.status,
        startDate,
        endDate,
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      ids = (await query.select('id')).map((row) => row.id)
    }

    ids = (
      await User.query()
        .whereIn('id', ids)
        .where((query) => query.whereNot('role', 'superadmin').orWhereNull('role'))
        .select('id')
    ).map((row) => row.id)

    if (!ids.length) {
      session.flash('error', 'Tidak ada akun team terpilih.')
      return response.redirect().back()
    }

    if (payload.status === 'all') {
      session.flash('error', 'Status tidak boleh kosong.')
      return response.redirect().back()
    }

    if (payload.action === 'delete') {
      await User.query()
        .whereIn('id', ids)
        .where((query) => query.whereNot('role', 'superadmin').orWhereNull('role'))
        .delete()
      session.flash('success', 'Akun team dihapus.')
      return response.redirect().back()
    }

    const isActive = payload.status === 'active' ? true : false
    await User.query()
      .whereIn('id', ids)
      .where((query) => query.whereNot('role', 'superadmin').orWhereNull('role'))
      .update({ isActive })
    session.flash('success', isActive ? 'Akun team diaktifkan.' : 'Akun team dinonaktifkan.')
    return response.redirect().back()
  }

  async setStatus({ params, response, session, request }: HttpContext) {
    const payload = await request.validateUsing(setStatusTeamValidator)
    const team = await User.query().where('id', params.id).firstOrFail()
    if (team.role === 'superadmin') {
      session.flash('error', 'Superadmin tidak boleh diaktifkan atau dinonaktifkan.')
      return response.redirect().back()
    }

    const isActive = payload.status === 'active' ? true : false
    team.isActive = isActive
    await team.save()
    session.flash('success', isActive ? 'Akun team diaktifkan.' : 'Akun team dinonaktifkan.')
    return response.redirect().back()
  }

  async exportCookies({ params, response }: HttpContext) {
    const team = await User.query().where('id', params.id).firstOrFail()

    const accounts = await FacebookAccount.query()
      .where('user_id', team.id)
      .preload('cookies', (query) => query.orderBy('created_at', 'asc'))
      .orderBy('created_at', 'asc')

    const payload = accounts.map((account) => {
      let cookieId = 1

      return account.cookies.flatMap((cookie) => {
        let value: string | null
        try {
          value = encryption.decrypt<string>(cookie.value)
        } catch {
          value = null
        }

        if (value === null) return []

        return [
          {
            domain: cookie.domain ?? '.facebook.com',
            ...(cookie.expires !== null && cookie.expires !== undefined
              ? { expirationDate: Number(cookie.expires) }
              : {}),
            hostOnly: cookie.domain ? !cookie.domain.startsWith('.') : false,
            httpOnly: cookie.httpOnly ?? false,
            name: cookie.key,
            path: cookie.path ?? '/',
            sameSite: cookie.sameSite ?? 'no_restriction',
            secure: cookie.secure ?? true,
            session: cookie.expires === null || cookie.expires === undefined,
            storeId: '0',
            value,
            id: cookieId++,
          },
        ]
      })
    })

    const safeName = (team.fullName || team.email || team.id)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    const filename = `${safeName || 'team'}-facebook-cookies.json`

    return response
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .header('Cache-Control', 'no-store')
      .type('application/json')
      .send(JSON.stringify(payload, null, 2))
  }

  private resolveAnalyticsRange(request: HttpContext['request']) {
    const defaultEnd = DateTime.now().endOf('day')
    const defaultStart = defaultEnd.startOf('day').minus({ days: 6 })
    const startDateInput = request.input('startDate')
    const endDateInput = request.input('endDate')

    const parsedStart =
      typeof startDateInput === 'string' && startDateInput ? DateTime.fromISO(startDateInput) : null
    const parsedEnd =
      typeof endDateInput === 'string' && endDateInput ? DateTime.fromISO(endDateInput) : null

    let analyticsStart = parsedStart?.isValid ? parsedStart.startOf('day') : defaultStart
    let analyticsEnd = parsedEnd?.isValid ? parsedEnd.endOf('day') : defaultEnd

    if (analyticsStart.toMillis() > analyticsEnd.toMillis()) {
      const nextStart = analyticsEnd.startOf('day')
      const nextEnd = analyticsStart.endOf('day')
      analyticsStart = nextStart
      analyticsEnd = nextEnd
    }

    const analyticsDayCount = Math.max(
      1,
      Math.round(analyticsEnd.startOf('day').diff(analyticsStart.startOf('day'), 'days').days) + 1
    )

    return { analyticsStart, analyticsEnd, analyticsDayCount }
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
