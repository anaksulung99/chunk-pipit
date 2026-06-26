import FingerprintProfile from '#models/fingerprint_profile'
import Campaign from '#models/campaign'
import {
  createFingerprintValidator,
  bulkFingerprintValidator,
  updateFingerprintValidator,
} from '#validators/fingerprint'
import { generateFingerprint } from '#services/fingerprint/generate'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'name', 'os_type', 'browser_type'] as const

export default class FingerprintsController {
  /** Owner-scoped: each user manages their own fingerprint profiles. */
  private scoped(
    userId: string,
    filters: {
      search?: string
      osType?: string
      browserType?: string
      startDate?: string
      endDate?: string
    }
  ) {
    const query = FingerprintProfile.query().where('user_id', userId)

    if (filters.osType && filters.osType !== 'all') query.where('os_type', filters.osType)
    if (filters.browserType && filters.browserType !== 'all') {
      query.where('browser_type', filters.browserType)
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => sub.whereILike('name', term).orWhereILike('user_agent', term))
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
    const osType = request.input('osType')?.toString() || 'all'
    const browserType = request.input('browserType')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, {
      search,
      osType,
      browserType,
      startDate,
      endDate,
    })
      .orderBy(sort, order)
      .paginate(page, perPage)

    const data = result.all().map((fp) => ({
      id: fp.id,
      name: fp.name,
      osType: fp.osType,
      osVersion: fp.osVersion,
      browserType: fp.browserType,
      browserVersion: fp.browserVersion,
      userAgent: fp.userAgent,
      screenWidth: fp.screenWidth,
      screenHeight: fp.screenHeight,
      webglVendor: fp.webglVendor,
      webglRenderer: fp.webglRenderer,
      canvasNoise: fp.canvasNoise,
      clientHints: fp.clientHints,
      locale: fp.locale,
      timezone: fp.timezone,
      createdAt: fp.createdAt ? fp.createdAt.toISO() : null,
    }))

    const allOwn = await FingerprintProfile.query()
      .where('user_id', user.id)
      .select('id', 'os_type', 'browser_type')
      .orderBy('id', 'asc')

    const stats = {
      total: allOwn.length,
      windows: allOwn.filter((fp) => fp.osType === 'windows').length,
      linux: allOwn.filter((fp) => fp.osType === 'linux').length,
      macos: allOwn.filter((fp) => fp.osType === 'macos').length,
      chrome: allOwn.filter((fp) => fp.browserType === 'chrome').length,
      firefox: allOwn.filter((fp) => fp.browserType === 'firefox').length,
      safari: allOwn.filter((fp) => fp.browserType === 'safari').length,
      edge: allOwn.filter((fp) => fp.browserType === 'edge').length,
    }

    return inertia.render('fingerprints/index', {
      fingerprints: {
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
        osType,
        browserType,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(createFingerprintValidator)

    let generated
    try {
      generated = generateFingerprint(payload.osType, payload.browserType, payload.locale)
    } catch {
      session.flash(
        'error',
        `Kombinasi ${payload.osType} + ${payload.browserType} tidak didukung generator.`
      )
      return response.redirect().back()
    }

    await FingerprintProfile.create({
      userId: auth.user!.id,
      name: payload.name,
      deviceType: 'desktop',
      osType: payload.osType,
      osVersion: generated.osVersion,
      browserType: payload.browserType,
      browserVersion: generated.browserVersion,
      userAgent: generated.userAgent,
      screenWidth: generated.screenWidth,
      screenHeight: generated.screenHeight,
      webglVendor: generated.webglVendor,
      webglRenderer: generated.webglRenderer,
      canvasNoise: Math.round(Math.random() * 1000) / 1000,
      clientHints: generated.clientHints,
      locale: payload.locale,
      timezone: payload.timezone,
      rawFingerprint: generated.raw,
    })

    session.flash('success', `Fingerprint "${payload.name}" dibuat.`)
    return response.redirect().back()
  }

  async show({ params, inertia, auth }: HttpContext) {
    const user = auth.user!
    const userId = user.id
    const id = params.id
    const fp = await FingerprintProfile.query()
      .where('id', id)
      .where('user_id', userId)
      .firstOrFail()
    const campaigns = await Campaign.query()
      .where('fingerprint_id', id)
      .where('user_id', userId)
      .withCount('accounts')
      .withCount('groups')
      .orderBy('created_at', 'desc')

    const statusBuckets = {
      draft: 0,
      running: 0,
      paused: 0,
      completed: 0,
      failed: 0,
    }
    const typeAnalysis = new Map<
      string,
      {
        type: string
        total: number
        draft: number
        running: number
        paused: number
        completed: number
        failed: number
        accountsAssigned: number
        groupsAssigned: number
        lastActivityAt: string | null
      }
    >()

    let lastUsedAt: string | null = null
    let lastUsedAtMillis = 0

    const recentCampaigns = campaigns.slice(0, 12).map((campaign) => {
      const accountsAssigned = Number(campaign.$extras.accounts_count ?? 0)
      const groupsAssigned = Number(campaign.$extras.groups_count ?? 0)
      const activityAt =
        campaign.updatedAt?.toISO() ??
        campaign.endedAt?.toISO() ??
        campaign.startedAt?.toISO() ??
        campaign.createdAt?.toISO() ??
        null

      if (campaign.status in statusBuckets) {
        statusBuckets[campaign.status as keyof typeof statusBuckets]++
      }

      const activityMillis = activityAt ? DateTime.fromISO(activityAt).toMillis() : 0
      if (activityAt && activityMillis > lastUsedAtMillis) {
        lastUsedAtMillis = activityMillis
        lastUsedAt = activityAt
      }

      const bucket = typeAnalysis.get(campaign.type) ?? {
        type: campaign.type,
        total: 0,
        draft: 0,
        running: 0,
        paused: 0,
        completed: 0,
        failed: 0,
        accountsAssigned: 0,
        groupsAssigned: 0,
        lastActivityAt: null,
      }

      bucket.total++
      bucket.accountsAssigned += accountsAssigned
      bucket.groupsAssigned += groupsAssigned
      if (campaign.status in statusBuckets) {
        bucket[campaign.status as keyof typeof statusBuckets]++
      }
      if (
        activityAt &&
        (!bucket.lastActivityAt ||
          DateTime.fromISO(activityAt).toMillis() >
            DateTime.fromISO(bucket.lastActivityAt).toMillis())
      ) {
        bucket.lastActivityAt = activityAt
      }
      typeAnalysis.set(campaign.type, bucket)

      return {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        maxAccounts: campaign.maxAccounts,
        maxConcurrency: campaign.maxConcurrency,
        useProxy: campaign.useProxy,
        accountsAssigned,
        groupsAssigned,
        createdAt: campaign.createdAt?.toISO() ?? null,
        startedAt: campaign.startedAt?.toISO() ?? null,
        endedAt: campaign.endedAt?.toISO() ?? null,
        updatedAt: campaign.updatedAt?.toISO() ?? null,
      }
    })

    const campaignTypeAnalysis = Array.from(typeAnalysis.values()).sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total
      const leftMillis = left.lastActivityAt ? DateTime.fromISO(left.lastActivityAt).toMillis() : 0
      const rightMillis = right.lastActivityAt
        ? DateTime.fromISO(right.lastActivityAt).toMillis()
        : 0
      return rightMillis - leftMillis
    })
    const totalCampaigns = campaigns.length
    const completedCampaigns = statusBuckets.completed
    const successRate =
      totalCampaigns > 0 ? Math.round((completedCampaigns / totalCampaigns) * 1000) / 10 : 0

    return inertia.render('fingerprints/show', {
      fingerprint: {
        id: fp.id,
        name: fp.name,
        deviceType: fp.deviceType,
        osType: fp.osType,
        osVersion: fp.osVersion,
        browserType: fp.browserType,
        browserVersion: fp.browserVersion,
        userAgent: fp.userAgent,
        screenWidth: fp.screenWidth,
        screenHeight: fp.screenHeight,
        webglVendor: fp.webglVendor,
        webglRenderer: fp.webglRenderer,
        canvasNoise: fp.canvasNoise,
        clientHints: fp.clientHints,
        locale: fp.locale,
        timezone: fp.timezone,
        rawFingerprint: fp.rawFingerprint,
        createdAt: fp.createdAt?.toISO() ?? null,
        updatedAt: fp.updatedAt?.toISO() ?? null,
      },
      campaignStats: {
        total: totalCampaigns,
        running: statusBuckets.running,
        paused: statusBuckets.paused,
        completed: statusBuckets.completed,
        failed: statusBuckets.failed,
        draft: statusBuckets.draft,
        successRate,
        lastUsedAt,
      },
      recentCampaigns,
      campaignTypeAnalysis,
    })
  }

  async clone({ params, response, session, auth }: HttpContext) {
    const userId = auth.user!.id
    const src = await FingerprintProfile.query()
      .where('id', params.id)
      .where('user_id', userId)
      .firstOrFail()

    await FingerprintProfile.create({
      userId,
      name: `${src.name} (copy)`,
      deviceType: src.deviceType,
      osType: src.osType,
      osVersion: src.osVersion,
      browserType: src.browserType,
      browserVersion: src.browserVersion,
      userAgent: src.userAgent,
      screenWidth: src.screenWidth,
      screenHeight: src.screenHeight,
      webglVendor: src.webglVendor,
      webglRenderer: src.webglRenderer,
      canvasNoise: src.canvasNoise,
      clientHints: src.clientHints,
      locale: src.locale,
      timezone: src.timezone,
      rawFingerprint: src.rawFingerprint,
    })

    session.flash('success', `Fingerprint "${src.name}" diduplikasi.`)
    return response.redirect().back()
  }

  async update({ request, response, params, session, auth }: HttpContext) {
    const userId = auth.user!.id
    const src = await FingerprintProfile.query()
      .where('id', params.id)
      .where('user_id', userId)
      .firstOrFail()

    if (!src) {
      session.flash('error', 'ID fingerprint tidak valid.')
      return response.redirect().back()
    }

    const payload = await request.validateUsing(updateFingerprintValidator)

    if (payload.osType !== src.osType) {
      let generated
      try {
        generated = generateFingerprint(payload.osType, payload.browserType, payload.locale)
      } catch {
        session.flash(
          'error',
          `Kombinasi ${payload.osType} + ${payload.browserType} tidak didukung generator.`
        )
        return response.redirect().back()
      }

      src
        .merge({
          name: payload.name,
          osType: payload.osType,
          osVersion: generated.osVersion,
          browserType: payload.browserType,
          browserVersion: generated.browserVersion,
          userAgent: generated.userAgent,
          screenWidth: generated.screenWidth,
          screenHeight: generated.screenHeight,
          webglVendor: generated.webglVendor,
          webglRenderer: generated.webglRenderer,
          canvasNoise: Math.round(Math.random() * 1000) / 1000,
          clientHints: generated.clientHints,
          locale: payload.locale,
          timezone: payload.timezone,
          rawFingerprint: generated.raw,
        })
        .save()

      session.flash('success', `Fingerprint "${src.name}" diperbarui.`)
      return response.redirect().back()
    }

    src
      .merge({
        name: payload.name,
        locale: payload.locale,
        timezone: payload.timezone,
      })
      .save()

    session.flash('success', `Fingerprint "${src.name}" diperbarui.`)
    return response.redirect().back()
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const fp = await FingerprintProfile.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    await fp.delete()
    session.flash('success', 'Fingerprint dihapus.')
    return response.redirect().back()
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkFingerprintValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        osType: payload.filters?.osType,
        browserType: payload.filters?.browserType,
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

    await FingerprintProfile.query().where('user_id', userId).whereIn('id', ids).delete()
    session.flash('success', `${ids.length} fingerprint dihapus.`)
    return response.redirect().back()
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
