import Campaign from '#models/campaign'
import FacebookGroup from '#models/facebook_group'
import FacebookAccount from '#models/facebook_account'
import Proxy from '#models/proxy'
import FingerprintProfile from '#models/fingerprint_profile'
import SessionLog from '#models/session_log'
import FacebookProfile from '#models/facebook_profile'
import Antidetect from '#models/antidetect'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

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

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export default class DashboardController {
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

  async index({ inertia, auth, request }: HttpContext) {
    const userId = auth.user!.id
    const todayStart = DateTime.now().startOf('day').toSQL()!
    const { analyticsStart, analyticsEnd, analyticsDayCount } = this.resolveAnalyticsRange(request)

    const [
      campaignRows,
      groupRows,
      accountRows,
      proxyRows,
      fingerprintCount,
      facebookProfileRows,
      antidetectCount,
      analyticsLogs,
    ] = await Promise.all([
      Campaign.query().where('user_id', userId).select('status', 'type'),
      FacebookGroup.query().where('user_id', userId).select('group_type'),
      FacebookAccount.query().where('user_id', userId).select('session_status'),
      Proxy.query().where('user_id', userId).select('status'),
      FingerprintProfile.query().where('user_id', userId).count('* as total'),
      FacebookProfile.query().where('user_id', userId).select('lifecycle_status', 'relationship_status'),
      Antidetect.query().where('user_id', userId).count('* as totalAntidetects'),
      SessionLog.query()
        .whereHas('campaign', (c) => c.where('user_id', userId))
        .where('created_at', '>=', analyticsStart.toSQL()!)
        .where('created_at', '<=', analyticsEnd.toSQL()!)
        .select('action', 'status', 'created_at'),
    ])

    const runningCampaigns = await Campaign.query()
      .where('user_id', userId)
      .where('status', 'running')
      .preload('groups')
      .orderBy('started_at', 'desc')

    const recentLogs = await SessionLog.query()
      .whereHas('campaign', (c) => c.where('user_id', userId))
      .preload('campaign')
      .orderBy('created_at', 'desc')
      .limit(15)

    const todayActions = await SessionLog.query()
      .whereHas('campaign', (c) => c.where('user_id', userId))
      .whereIn('action', ['auto_share', 'auto_join', 'scrape'])
      .where('created_at', '>=', todayStart)
      .select('status')

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

    return inertia.render('home', {
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
        facebookProfiles: facebookProfileRows.length,
        profileLifecycle: tally(facebookProfileRows.map((profile) => profile.lifecycleStatus)),
        profileRelationship: tally(facebookProfileRows.map((profile) => profile.relationshipStatus)),
        antidetects: Number((antidetectCount[0] as any).$extras.totalAntidetects ?? 0),
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
    })
  }

  async export({ auth, request, response }: HttpContext) {
    const userId = auth.user!.id
    const { analyticsStart, analyticsEnd, analyticsDayCount } = this.resolveAnalyticsRange(request)

    const [campaignRows, analyticsLogs] = await Promise.all([
      Campaign.query().where('user_id', userId).select('status', 'type'),
      SessionLog.query()
        .whereHas('campaign', (c) => c.where('user_id', userId))
        .where('created_at', '>=', analyticsStart.toSQL()!)
        .where('created_at', '<=', analyticsEnd.toSQL()!)
        .select('action', 'status', 'created_at'),
    ])

    const dailyActivityMap = new Map<
      string,
      { date: string; total: number; success: number; failed: number }
    >()
    for (let index = 0; index < analyticsDayCount; index++) {
      const day = analyticsStart.plus({ days: index }).toISODate()!
      dailyActivityMap.set(day, { date: day, total: 0, success: 0, failed: 0 })
    }

    const actionBreakdownMap = new Map<
      string,
      { action: string; total: number; success: number; failed: number; lastAt: string | null }
    >()

    for (const log of analyticsLogs) {
      const statusKind = classifyLogStatus(log.status)
      const dayKey = log.createdAt?.toISODate()
      const createdAt = log.createdAt?.toISO() ?? null

      if (dayKey && dailyActivityMap.has(dayKey)) {
        const bucket = dailyActivityMap.get(dayKey)!
        bucket.total++
        if (statusKind === 'success') bucket.success++
        if (statusKind === 'failed') bucket.failed++
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
    const actionBreakdown = Array.from(actionBreakdownMap.values()).sort(
      (left, right) => right.total - left.total
    )
    const campaignTypeBreakdown = Array.from(campaignTypeMap.values()).sort(
      (left, right) => right.total - left.total
    )
    const totalLogVolume = dailyActivity.reduce((total, day) => total + day.total, 0)
    const successLogVolume = dailyActivity.reduce((total, day) => total + day.success, 0)
    const failedLogVolume = dailyActivity.reduce((total, day) => total + day.failed, 0)
    const successRate =
      totalLogVolume > 0 ? Math.round((successLogVolume / totalLogVolume) * 1000) / 10 : 0

    const lines = [
      'section,key,metric,value,extra_1,extra_2,extra_3',
      [
        'summary',
        'range',
        'window',
        `${analyticsStart.toISODate()} - ${analyticsEnd.toISODate()}`,
        `${analyticsDayCount} hari`,
        '',
        '',
      ]
        .map(csvCell)
        .join(','),
      ['summary', 'logs', 'total', totalLogVolume, '', '', ''].map(csvCell).join(','),
      ['summary', 'logs', 'success', successLogVolume, '', '', ''].map(csvCell).join(','),
      ['summary', 'logs', 'failed', failedLogVolume, '', '', ''].map(csvCell).join(','),
      ['summary', 'logs', 'success_rate', successRate, '%', '', ''].map(csvCell).join(','),
      ...dailyActivity.map((day) =>
        ['daily_activity', day.date, 'total', day.total, day.success, day.failed, '']
          .map(csvCell)
          .join(',')
      ),
      ...actionBreakdown.map((row) =>
        ['action_breakdown', row.action, 'total', row.total, row.success, row.failed, row.lastAt]
          .map(csvCell)
          .join(',')
      ),
      ...campaignTypeBreakdown.map((row) =>
        [
          'campaign_type',
          row.type,
          'total',
          row.total,
          `draft:${row.draft}`,
          `running:${row.running}|paused:${row.paused}`,
          `completed:${row.completed}|failed:${row.failed}`,
        ]
          .map(csvCell)
          .join(',')
      ),
    ]

    const fileName = `dashboard-report-${analyticsStart.toISODate()}-${analyticsEnd.toISODate()}.csv`
    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header('Content-Disposition', `attachment; filename="${fileName}"`)
    return lines.join('\n')
  }
}
