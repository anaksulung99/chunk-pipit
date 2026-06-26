import FacebookAccount from '#models/facebook_account'
import AccountCookie from '#models/account_cookie'
import CampaignAccount from '#models/campaign_account'
import SessionLog from '#models/session_log'
import FacebookGroup from '#models/facebook_group'
import { parseCookies, extractFbUserId } from '#services/account/cookie_parser'
import {
  createAccountValidator,
  updateAccountStatusValidator,
  bulkAccountValidator,
  updateAccountValidator,
} from '#validators/account'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import encryption from '@adonisjs/core/services/encryption'
import { checkAccountHealth } from '#services/account/health_check'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'label', 'session_status', 'last_used_at'] as const

export default class FacebookAccountsController {
  /** Owner-scoped: each user manages their own FB accounts. */
  private scoped(
    userId: string,
    filters: { search?: string; status?: string; startDate?: string; endDate?: string }
  ) {
    const query = FacebookAccount.query().where('user_id', userId)

    if (filters.status && filters.status !== 'all') query.where('session_status', filters.status)
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => sub.whereILike('label', term).orWhereILike('fb_user_id', term))
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
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, { search, status, startDate, endDate })
      .withCount('cookies')
      .orderBy(sort, order)
      .paginate(page, perPage)

    const data = result.all().map((account) => ({
      id: account.id,
      label: account.label,
      fbUserId: account.fbUserId,
      profileUrl: account.profileUrl,
      sessionStatus: account.sessionStatus,
      notes: account.notes,
      cookiesCount: Number(account.$extras.cookies_count ?? 0),
      lastUsedAt: account.lastUsedAt ? account.lastUsedAt.toISO() : null,
      createdAt: account.createdAt ? account.createdAt.toISO() : null,
    }))

    const allOwn = await FacebookAccount.query()
      .where('user_id', user.id)
      .select('id', 'session_status')
      .orderBy('id', 'asc')

    const stats = {
      total: allOwn.length,
      active: allOwn.filter((account) => account.sessionStatus === 'active').length,
      checkpoint: allOwn.filter((account) => account.sessionStatus === 'checkpoint').length,
      inactive: allOwn.filter((account) => account.sessionStatus === 'inactive').length,
      loggedOut: allOwn.filter((account) => account.sessionStatus === 'logged_out').length,
      banned: allOwn.filter((account) => account.sessionStatus === 'banned').length,
    }

    return inertia.render('accounts/index', {
      accounts: {
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
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(createAccountValidator)
    const cookies = parseCookies(payload.cookiesText)

    if (!cookies.length) {
      session.flash('error', 'Cookie JSON tidak valid atau kosong.')
      return response.redirect().back()
    }

    await db.transaction(async (trx) => {
      const account = await FacebookAccount.create(
        {
          userId: auth.user!.id,
          label: payload.label,
          fbUserId: payload.fbUserId ?? extractFbUserId(cookies),
          profileUrl: payload.profileUrl ?? null,
          notes: payload.notes ?? null,
          sessionStatus: 'active',
        },
        { client: trx }
      )

      await AccountCookie.createMany(
        cookies.map((cookie) => ({
          accountId: account.id,
          key: cookie.key,
          value: encryption.encrypt(cookie.value), // AES at rest
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires,
          httpOnly: cookie.httpOnly,
          secure: cookie.secure,
          sameSite: cookie.sameSite,
        })),
        { client: trx }
      )
    })

    session.flash('success', `Akun "${payload.label}" disimpan (${cookies.length} cookie).`)
    return response.redirect().back()
  }

  async show({ params, auth, inertia }: HttpContext) {
    const userId = auth.user!.id
    const account = await FacebookAccount.query()
      .where('id', params.id)
      .where('user_id', userId)
      .preload('cookies')
      .preload('user', (query) => query.select('id', 'email', 'fullName'))
      .firstOrFail()

    const [campaignRelations, logs] = await Promise.all([
      CampaignAccount.query()
        .where('account_id', account.id)
        .preload('campaign', (query) => {
          query.where('user_id', userId).withCount('accounts').withCount('groups')
        })
        .orderBy('created_at', 'desc'),
      SessionLog.query().where('account_id', account.id).orderBy('created_at', 'desc'),
    ])

    const campaignLogStats = new Map<
      string,
      { total: number; success: number; error: number; lastLogAt: string | null }
    >()
    const groupLogStats = new Map<
      string,
      {
        total: number
        success: number
        error: number
        lastLogAt: string | null
        campaignIds: Set<string>
      }
    >()
    const actionAnalysis = new Map<
      string,
      {
        action: string
        total: number
        success: number
        error: number
        lastActivityAt: string | null
      }
    >()
    const logBuckets = {
      total: logs.length,
      success: 0,
      error: 0,
      pending: 0,
      checkpoint: 0,
      skipped: 0,
    }

    let firstLogAt: string | null = null
    let lastLogAt: string | null = null
    let durationTotalMs = 0
    let durationSamples = 0

    for (const log of logs) {
      const status = log.status.toLowerCase()
      const createdAt = log.createdAt?.toISO() ?? null
      const isSuccess = ['success', 'completed', 'done'].includes(status)
      const isError = ['error', 'failed'].includes(status)

      if (isSuccess) logBuckets.success++
      else if (isError) logBuckets.error++
      else if (status === 'checkpoint') logBuckets.checkpoint++
      else if (status === 'skipped') logBuckets.skipped++
      else logBuckets.pending++

      if (log.durationMs !== null) {
        durationTotalMs += log.durationMs
        durationSamples++
      }

      if (createdAt) {
        if (!lastLogAt) lastLogAt = createdAt
        firstLogAt = createdAt
      }

      const actionBucket = actionAnalysis.get(log.action) ?? {
        action: log.action,
        total: 0,
        success: 0,
        error: 0,
        lastActivityAt: null,
      }
      actionBucket.total++
      if (isSuccess) actionBucket.success++
      if (isError) actionBucket.error++
      if (
        createdAt &&
        (!actionBucket.lastActivityAt ||
          DateTime.fromISO(createdAt).toMillis() >
            DateTime.fromISO(actionBucket.lastActivityAt).toMillis())
      ) {
        actionBucket.lastActivityAt = createdAt
      }
      actionAnalysis.set(log.action, actionBucket)

      const campaignBucket = campaignLogStats.get(log.campaignId) ?? {
        total: 0,
        success: 0,
        error: 0,
        lastLogAt: null,
      }
      campaignBucket.total++
      if (isSuccess) campaignBucket.success++
      if (isError) campaignBucket.error++
      if (
        createdAt &&
        (!campaignBucket.lastLogAt ||
          DateTime.fromISO(createdAt).toMillis() >
            DateTime.fromISO(campaignBucket.lastLogAt).toMillis())
      ) {
        campaignBucket.lastLogAt = createdAt
      }
      campaignLogStats.set(log.campaignId, campaignBucket)

      if (log.groupId) {
        const groupBucket = groupLogStats.get(log.groupId) ?? {
          total: 0,
          success: 0,
          error: 0,
          lastLogAt: null,
          campaignIds: new Set<string>(),
        }
        groupBucket.total++
        if (isSuccess) groupBucket.success++
        if (isError) groupBucket.error++
        groupBucket.campaignIds.add(log.campaignId)
        if (
          createdAt &&
          (!groupBucket.lastLogAt ||
            DateTime.fromISO(createdAt).toMillis() >
              DateTime.fromISO(groupBucket.lastLogAt).toMillis())
        ) {
          groupBucket.lastLogAt = createdAt
        }
        groupLogStats.set(log.groupId, groupBucket)
      }
    }

    const groupIds = Array.from(
      new Set(logs.map((log) => log.groupId).filter((value): value is string => Boolean(value)))
    )
    const groups = groupIds.length
      ? await FacebookGroup.query().where('user_id', userId).whereIn('id', groupIds)
      : []
    const groupLookup = new Map(groups.map((group) => [group.id, group]))

    const campaignStatusBuckets = {
      total: campaignRelations.length,
      running: 0,
      paused: 0,
      completed: 0,
      failed: 0,
      draft: 0,
    }

    const campaignRelationRows = campaignRelations
      .filter((relation) => relation.campaign)
      .map((relation) => {
        const stats = campaignLogStats.get(relation.campaignId) ?? {
          total: 0,
          success: 0,
          error: 0,
          lastLogAt: null,
        }
        const campaignStatus = relation.campaign.status.toLowerCase()
        if (campaignStatus === 'running') campaignStatusBuckets.running++
        else if (campaignStatus === 'paused') campaignStatusBuckets.paused++
        else if (['completed', 'success'].includes(campaignStatus))
          campaignStatusBuckets.completed++
        else if (['failed', 'error'].includes(campaignStatus)) campaignStatusBuckets.failed++
        else campaignStatusBuckets.draft++

        return {
          id: relation.id,
          campaignId: relation.campaignId,
          relationStatus: relation.status,
          linkedAt: relation.createdAt?.toISO() ?? null,
          name: relation.campaign.name,
          type: relation.campaign.type,
          status: relation.campaign.status,
          fingerprintName: relation.campaign.fingerprintId ? relation.campaign.fingerprintId : null,
          accountsAssigned: Number(relation.campaign.$extras.accounts_count ?? 0),
          groupsAssigned: Number(relation.campaign.$extras.groups_count ?? 0),
          startedAt: relation.campaign.startedAt?.toISO() ?? null,
          endedAt: relation.campaign.endedAt?.toISO() ?? null,
          createdAt: relation.campaign.createdAt?.toISO() ?? null,
          updatedAt: relation.campaign.updatedAt?.toISO() ?? null,
          logCount: stats.total,
          successCount: stats.success,
          errorCount: stats.error,
          lastLogAt: stats.lastLogAt,
        }
      })

    const groupStatusBuckets = {
      total: groupLogStats.size,
      successful: 0,
      failed: 0,
      pending: 0,
    }

    const groupRelationRows = Array.from(groupLogStats.entries())
      .map(([groupId, stats]) => {
        const group = groupLookup.get(groupId)
        if (stats.success > 0) groupStatusBuckets.successful++
        else if (stats.error > 0) groupStatusBuckets.failed++
        else groupStatusBuckets.pending++

        return {
          id: groupId,
          groupId: group?.groupId ?? groupId,
          groupName: group?.groupName ?? null,
          groupType: group?.groupType ?? null,
          groupUrl: group?.groupUrl ?? null,
          memberCount: group?.memberCount ?? null,
          sourceType: group?.sourceType ?? null,
          sourceKeyword: group?.sourceKeyword ?? null,
          logCount: stats.total,
          successCount: stats.success,
          errorCount: stats.error,
          campaignCount: stats.campaignIds.size,
          lastLogAt: stats.lastLogAt,
        }
      })
      .sort((left, right) => {
        if (right.logCount !== left.logCount) return right.logCount - left.logCount
        const leftMillis = left.lastLogAt ? DateTime.fromISO(left.lastLogAt).toMillis() : 0
        const rightMillis = right.lastLogAt ? DateTime.fromISO(right.lastLogAt).toMillis() : 0
        return rightMillis - leftMillis
      })

    const actionReport = Array.from(actionAnalysis.values()).sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total
      const leftMillis = left.lastActivityAt ? DateTime.fromISO(left.lastActivityAt).toMillis() : 0
      const rightMillis = right.lastActivityAt
        ? DateTime.fromISO(right.lastActivityAt).toMillis()
        : 0
      return rightMillis - leftMillis
    })

    const cookieDomainMap = new Map<
      string,
      {
        domain: string
        total: number
        secure: number
        httpOnly: number
        session: number
        lastUpdatedAt: string | null
      }
    >()
    const cookieReport = {
      total: account.cookies.length,
      secure: 0,
      httpOnly: 0,
      session: 0,
      persistent: 0,
      distinctDomains: 0,
    }

    for (const cookie of account.cookies) {
      if (cookie.secure) cookieReport.secure++
      if (cookie.httpOnly) cookieReport.httpOnly++
      if (cookie.expires === null) cookieReport.session++
      else cookieReport.persistent++

      const domain = cookie.domain || 'tanpa-domain'
      const bucket = cookieDomainMap.get(domain) ?? {
        domain,
        total: 0,
        secure: 0,
        httpOnly: 0,
        session: 0,
        lastUpdatedAt: null,
      }
      bucket.total++
      if (cookie.secure) bucket.secure++
      if (cookie.httpOnly) bucket.httpOnly++
      if (cookie.expires === null) bucket.session++
      const updatedAt = cookie.updatedAt?.toISO() ?? null
      if (
        updatedAt &&
        (!bucket.lastUpdatedAt ||
          DateTime.fromISO(updatedAt).toMillis() >
            DateTime.fromISO(bucket.lastUpdatedAt).toMillis())
      ) {
        bucket.lastUpdatedAt = updatedAt
      }
      cookieDomainMap.set(domain, bucket)
    }
    cookieReport.distinctDomains = cookieDomainMap.size

    const cookieDomainReport = Array.from(cookieDomainMap.values()).sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total
      const leftMillis = left.lastUpdatedAt ? DateTime.fromISO(left.lastUpdatedAt).toMillis() : 0
      const rightMillis = right.lastUpdatedAt ? DateTime.fromISO(right.lastUpdatedAt).toMillis() : 0
      return rightMillis - leftMillis
    })

    const campaignLookup = new Map(campaignRelationRows.map((row) => [row.campaignId, row]))
    const recentLogs = logs.slice(0, 100).map((log) => {
      const campaign = campaignLookup.get(log.campaignId)
      const group = log.groupId ? groupLookup.get(log.groupId) : null
      return {
        id: log.id,
        campaignId: log.campaignId,
        campaignName: campaign?.name ?? log.campaignId,
        action: log.action,
        status: log.status,
        message: log.message,
        groupName: group?.groupName ?? group?.groupId ?? log.groupId ?? null,
        durationMs: log.durationMs,
        screenshotPath: log.screenshotPath,
        createdAt: log.createdAt?.toISO() ?? null,
      }
    })

    const averageDurationMs =
      durationSamples > 0 ? Math.round(durationTotalMs / durationSamples) : null
    const logSuccessRate =
      logBuckets.total > 0 ? Math.round((logBuckets.success / logBuckets.total) * 1000) / 10 : 0

    return inertia.render('accounts/show', {
      data: {
        id: account.id,
        label: account.label,
        fbUserId: account.fbUserId,
        profileUrl: account.profileUrl,
        sessionStatus: account.sessionStatus,
        notes: account.notes,
        cookiesCount: account.cookies.length,
        lastUsedAt: account.lastUsedAt?.toISO() ?? null,
        createdAt: account.createdAt?.toISO() ?? null,
        updatedAt: account.updatedAt?.toISO() ?? null,
        cookies: account.cookies.map((cookie) => ({
          id: cookie.id,
          accountId: cookie.accountId,
          key: cookie.key,
          value: String(encryption.decrypt(cookie.value) ?? ''),
          domain: cookie.domain,
          path: cookie.path,
          expires: cookie.expires === null ? null : String(cookie.expires),
          httpOnly: cookie.httpOnly ?? false,
          secure: cookie.secure ?? false,
          sameSite: cookie.sameSite,
          createdAt: cookie.createdAt?.toISO() ?? null,
          updatedAt: cookie.updatedAt?.toISO() ?? null,
        })),
        user: account.user
          ? {
              id: account.user.id,
              email: account.user.email,
              fullName: account.user.fullName ?? account.user.email,
            }
          : null,
      },
      accountReport: {
        totalLogs: logBuckets.total,
        successLogs: logBuckets.success,
        errorLogs: logBuckets.error,
        pendingLogs: logBuckets.pending,
        checkpointLogs: logBuckets.checkpoint,
        skippedLogs: logBuckets.skipped,
        relatedCampaigns: campaignRelationRows.length,
        uniqueCampaignsTouched: campaignLogStats.size,
        uniqueGroupsTouched: groupLogStats.size,
        averageDurationMs,
        logSuccessRate,
        firstLogAt,
        lastLogAt,
      },
      relationSummary: {
        campaigns: campaignStatusBuckets,
        groups: groupStatusBuckets,
      },
      campaignRelations: campaignRelationRows,
      groupRelations: groupRelationRows,
      actionReport,
      cookieReport,
      cookieDomainReport,
      logs: recentLogs,
    })
  }

  async update({ request, response, params, session, auth }: HttpContext) {
    const userId = auth.user!.id
    try {
      const payload = await request.validateUsing(updateAccountValidator)

      await db.transaction(async (trx) => {
        const account = await FacebookAccount.query()
          .useTransaction(trx)
          .where('id', params.id)
          .where('user_id', userId)
          .firstOrFail()

        account.label = payload.label
        account.profileUrl = payload.profileUrl ?? null
        account.fbUserId = payload.fbUserId ?? null
        account.notes = payload.notes ?? null

        if (payload.cookiesText && payload.cookiesText.length) {
          account.useTransaction(trx)
          await account.save()

          const cookies = parseCookies(payload.cookiesText)

          await AccountCookie.query().useTransaction(trx).where('account_id', account.id).delete()

          // Tambah cookie baru
          await AccountCookie.createMany(
            cookies.map((cookie) => ({
              accountId: account.id,
              key: cookie.key,
              value: encryption.encrypt(cookie.value),
              domain: cookie.domain,
              path: cookie.path,
              expires: cookie.expires,
              httpOnly: cookie.httpOnly,
              secure: cookie.secure,
              sameSite: cookie.sameSite,
            })),
            { client: trx }
          )
        } else {
          account.sessionStatus = 'active'
          account.useTransaction(trx)
          await account.save()
        }
      })

      session.flash('success', `Akun "${payload.label}" diperbarui.`)
      return response.redirect().back()
    } catch (error: any) {
      session.flash('error', error.message ?? 'Gagal memperbarui akun.')
      return response.redirect().back()
    }
  }

  async updateStatus({ params, request, response, session, auth }: HttpContext) {
    const { status } = await request.validateUsing(updateAccountStatusValidator)
    const account = await FacebookAccount.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    account.sessionStatus = status
    await account.save()
    session.flash('success', `Status akun "${account.label}" → ${status}.`)
    return response.redirect().back()
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const account = await FacebookAccount.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    await account.delete()
    session.flash('success', 'Akun dihapus.')
    return response.redirect().back()
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkAccountValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        status: payload.filters?.status,
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      // eslint-disable-next-line @unicorn/no-await-expression-member
      ids = (await query.select('id')).map((row) => row.id)
    }

    if (!ids.length) {
      session.flash('error', 'Tidak ada akun terpilih.')
      return response.redirect().back()
    }

    if (payload.action === 'delete') {
      await FacebookAccount.query().where('user_id', userId).whereIn('id', ids).delete()
      session.flash('success', `${ids.length} akun dihapus.`)
    } else {
      await FacebookAccount.query()
        .where('user_id', userId)
        .whereIn('id', ids)
        .update({ session_status: payload.status ?? 'active' })
      session.flash('success', `${ids.length} akun diperbarui.`)
    }

    return response.redirect().back()
  }

  async healthCheck({ response, params, auth, session }: HttpContext) {
    const userId = auth.user?.id
    if (!userId) {
      session.flash('error', 'User ID tidak ditemukan.')
      return response.redirect().back()
    }

    const account = await FacebookAccount.query()
      .where('id', params.id)
      .where('user_id', userId)
      .preload('cookies')
      .firstOrFail()

    if (account.cookies.length <= 0) {
      session.flash('error', 'Akun tidak memiliki cookie.')
      return response.redirect().back()
    }

    const healthState = await checkAccountHealth(account)
    if (healthState === 'server_error') {
      session.flash('error', 'Gagal cek status akun.')
      return response.redirect().back()
    }

    account.sessionStatus = healthState
    await account.save()

    session.flash('success', `Status akun "${account.label}" → ${healthState}.`)
    return response.redirect().back()
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
