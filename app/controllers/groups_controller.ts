import FacebookGroup from '#models/facebook_group'
import CampaignGroup from '#models/campaign_group'
import SessionLog from '#models/session_log'
import FacebookAccount from '#models/facebook_account'
import { parseGroupLine } from '#services/group/parse'
import { mergeGroupTags, splitGroupTags } from '#services/group/tags'
import {
  importGroupsValidator,
  updateGroupTypeValidator,
  bulkGroupValidator,
} from '#validators/group'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'group_id', 'group_name', 'member_count', 'group_type'] as const

function csvCell(value: unknown): string {
  const s = value === null ? '' : String(value)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export default class GroupsController {
  /** Owner-scoped: each user manages their own group list. */
  private scoped(
    userId: string,
    filters: {
      search?: string
      type?: string
      source?: string
      groupTag?: string
      startDate?: string
      endDate?: string
    }
  ) {
    const query = FacebookGroup.query().where('user_id', userId)

    if (filters.type && filters.type !== 'all') query.where('group_type', filters.type)
    if (filters.source && filters.source !== 'all') query.where('source_type', filters.source)
    if (filters.groupTag && filters.groupTag !== 'all') {
      if (filters.groupTag === '__untagged__') {
        query.where((sub) => {
          sub.whereNull('tags').orWhereRaw(`tags = '[]'::jsonb`)
        })
      } else {
        query.whereRaw(`coalesce(tags, '[]'::jsonb) @> ?::jsonb`, [JSON.stringify([filters.groupTag])])
      }
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => sub.whereILike('group_id', term).orWhereILike('group_name', term))
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
    const type = request.input('type')?.toString() || 'all'
    const source = request.input('source')?.toString() || 'all'
    const groupTag = request.input('groupTag')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, { search, type, source, groupTag, startDate, endDate })
      .orderBy(sort, order)
      .paginate(page, perPage)

    const allOwn = await FacebookGroup.query()
      .where('user_id', user.id)
      .select('id', 'group_type', 'tags')
      .orderBy('id', 'asc')

    const stats = {
      totalGroup: allOwn.length,
      publicGroup: allOwn.filter((item) => item.groupType === 'public').length,
      privateGroup: allOwn.filter((item) => item.groupType === 'private').length,
    }
    const groupTagOptions = Array.from(
      new Set(
        allOwn.flatMap((item) => (Array.isArray(item.tags) ? (item.tags as string[]).filter(Boolean) : []))
      )
    ).sort((left, right) => left.localeCompare(right, 'id'))

    const data = result.all().map((group) => ({
      id: group.id,
      groupId: group.groupId,
      groupName: group.groupName,
      groupUrl: group.groupUrl,
      groupType: group.groupType,
      memberCount: group.memberCount,
      sourceType: group.sourceType,
      sourceKeyword: group.sourceKeyword,
      tags: Array.isArray(group.tags) ? (group.tags as string[]) : [],
      createdAt: group.createdAt ? group.createdAt.toISO() : null,
    }))

    return inertia.render('groups/index', {
      groups: {
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
        type,
        source,
        groupTag,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
      groupTagOptions,
    })
  }

  async show({ params, inertia, auth }: HttpContext) {
    const userId = auth.user!.id
    const group = await FacebookGroup.query()
      .where('id', params.id)
      .where('user_id', userId)
      .firstOrFail()

    const [campaignRelations, logs] = await Promise.all([
      CampaignGroup.query()
        .where('group_id', group.id)
        .preload('campaign', (query) => {
          query.where('user_id', userId).withCount('accounts').withCount('groups')
        })
        .orderBy('created_at', 'desc'),
      SessionLog.query().where('group_id', group.id).orderBy('created_at', 'desc'),
    ])

    const campaignLogStats = new Map<
      string,
      { total: number; success: number; error: number; lastLogAt: string | null }
    >()
    const accountLogStats = new Map<
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

      if (log.accountId) {
        const accountBucket = accountLogStats.get(log.accountId) ?? {
          total: 0,
          success: 0,
          error: 0,
          lastLogAt: null,
          campaignIds: new Set<string>(),
        }
        accountBucket.total++
        if (isSuccess) accountBucket.success++
        if (isError) accountBucket.error++
        accountBucket.campaignIds.add(log.campaignId)
        if (
          createdAt &&
          (!accountBucket.lastLogAt ||
            DateTime.fromISO(createdAt).toMillis() >
              DateTime.fromISO(accountBucket.lastLogAt).toMillis())
        ) {
          accountBucket.lastLogAt = createdAt
        }
        accountLogStats.set(log.accountId, accountBucket)
      }
    }

    const accountIds = Array.from(accountLogStats.keys())
    const accounts = accountIds.length
      ? await FacebookAccount.query().where('user_id', userId).whereIn('id', accountIds)
      : []
    const accountLookup = new Map(accounts.map((account) => [account.id, account]))

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
          processedAt: relation.processedAt?.toISO() ?? null,
          name: relation.campaign.name,
          type: relation.campaign.type,
          status: relation.campaign.status,
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

    const accountStatusBuckets = {
      total: accountLogStats.size,
      successful: 0,
      failed: 0,
      pending: 0,
    }

    const accountRelationRows = Array.from(accountLogStats.entries())
      .map(([accountId, stats]) => {
        const account = accountLookup.get(accountId)
        if (stats.success > 0) accountStatusBuckets.successful++
        else if (stats.error > 0) accountStatusBuckets.failed++
        else accountStatusBuckets.pending++

        return {
          id: accountId,
          accountId,
          label: account?.label ?? accountId,
          fbUserId: account?.fbUserId ?? null,
          sessionStatus: account?.sessionStatus ?? null,
          lastUsedAt: account?.lastUsedAt?.toISO() ?? null,
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

    const campaignLookup = new Map(campaignRelationRows.map((row) => [row.campaignId, row]))
    const recentLogs = logs.slice(0, 100).map((log) => {
      const campaign = campaignLookup.get(log.campaignId)
      const account = log.accountId ? accountLookup.get(log.accountId) : null
      return {
        id: log.id,
        campaignId: log.campaignId,
        campaignName: campaign?.name ?? log.campaignId,
        accountId: log.accountId,
        accountLabel: account?.label ?? log.accountId ?? null,
        action: log.action,
        status: log.status,
        message: log.message,
        durationMs: log.durationMs,
        screenshotPath: log.screenshotPath,
        createdAt: log.createdAt?.toISO() ?? null,
      }
    })

    const averageDurationMs =
      durationSamples > 0 ? Math.round(durationTotalMs / durationSamples) : null
    const logSuccessRate =
      logBuckets.total > 0 ? Math.round((logBuckets.success / logBuckets.total) * 1000) / 10 : 0

    return inertia.render('groups/show', {
      data: {
        id: group.id,
        groupId: group.groupId,
        groupName: group.groupName,
        groupUrl: group.groupUrl,
        groupType: group.groupType,
        memberCount: group.memberCount,
        sourceType: group.sourceType,
        sourceKeyword: group.sourceKeyword,
        sourceFriendUrl: group.sourceFriendUrl,
        tags: Array.isArray(group.tags) ? (group.tags as string[]) : [],
        createdAt: group.createdAt?.toISO() ?? null,
        updatedAt: group.updatedAt?.toISO() ?? null,
      },
      groupReport: {
        totalLogs: logBuckets.total,
        successLogs: logBuckets.success,
        errorLogs: logBuckets.error,
        pendingLogs: logBuckets.pending,
        checkpointLogs: logBuckets.checkpoint,
        skippedLogs: logBuckets.skipped,
        relatedCampaigns: campaignRelationRows.length,
        uniqueCampaignsTouched: campaignLogStats.size,
        uniqueAccountsTouched: accountLogStats.size,
        averageDurationMs,
        logSuccessRate,
        firstLogAt,
        lastLogAt,
      },
      relationSummary: {
        campaigns: campaignStatusBuckets,
        accounts: accountStatusBuckets,
      },
      campaignRelations: campaignRelationRows,
      accountRelations: accountRelationRows,
      actionReport,
      logs: recentLogs,
    })
  }

  async import({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(importGroupsValidator)
    const userId = auth.user!.id
    const tags = splitGroupTags(payload.tagsText)

    let added = 0
    let skipped = 0
    const seen = new Set<string>()
    for (const line of payload.text.split(/\r?\n/)) {
      const parsed = parseGroupLine(line)
      if (!parsed) {
        if (line.trim()) skipped++
        continue
      }
      if (seen.has(parsed.groupId)) continue
      seen.add(parsed.groupId)

      await FacebookGroup.updateOrCreate(
        { userId, groupId: parsed.groupId },
        {
          userId,
          groupId: parsed.groupId,
          groupName: parsed.groupName,
          groupUrl: parsed.groupUrl,
          groupType: payload.groupType,
          sourceType: 'manual',
          tags: tags.length ? tags : null,
        }
      )
      added++
    }

    session.flash(
      'success',
      `${added} group diimpor${skipped ? `, ${skipped} baris dilewati` : ''}.`
    )
    return response.redirect().back()
  }

  async updateType({ params, request, response, session, auth }: HttpContext) {
    const { groupType } = await request.validateUsing(updateGroupTypeValidator)
    const group = await FacebookGroup.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    group.groupType = groupType
    await group.save()
    session.flash('success', `Tipe group "${group.groupId}" → ${groupType}.`)
    return response.redirect().back()
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const group = await FacebookGroup.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    await group.delete()
    session.flash('success', 'Group dihapus.')
    return response.redirect().back()
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkGroupValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        type: payload.filters?.type,
        source: payload.filters?.source,
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      // eslint-disable-next-line @unicorn/no-await-expression-member
      ids = (await query.select('id')).map((row) => row.id)
    }

    if (!ids.length) {
      session.flash('error', 'Tidak ada group terpilih.')
      return response.redirect().back()
    }

    if (payload.action === 'delete') {
      await FacebookGroup.query().where('user_id', userId).whereIn('id', ids).delete()
      session.flash('success', `${ids.length} group dihapus.`)
    } else if (payload.action === 'set_type') {
      await FacebookGroup.query()
        .where('user_id', userId)
        .whereIn('id', ids)
        .update({ group_type: payload.groupType ?? 'public' })
      session.flash('success', `${ids.length} group diperbarui.`)
    } else {
      const nextTags = splitGroupTags(payload.tagsText)
      if (payload.action !== 'clear_tags' && !nextTags.length) {
        session.flash('error', 'Label kelompok kosong.')
        return response.redirect().back()
      }
      const groups = await FacebookGroup.query().where('user_id', userId).whereIn('id', ids)
      for (const group of groups) {
        const current = Array.isArray(group.tags) ? (group.tags as string[]) : []
        if (payload.action === 'add_tags') {
          group.tags = mergeGroupTags(current, nextTags)
        } else if (payload.action === 'set_tags') {
          group.tags = nextTags
        } else if (payload.action === 'remove_tags') {
          group.tags = current.filter((tag) => !nextTags.includes(tag))
        } else {
          group.tags = []
        }
        await group.save()
      }

      if (payload.action === 'add_tags') {
        session.flash('success', `Label "${nextTags.join(', ')}" ditambahkan ke ${groups.length} group.`)
      } else if (payload.action === 'set_tags') {
        session.flash('success', `Label kelompok ${groups.length} group berhasil diganti.`)
      } else if (payload.action === 'remove_tags') {
        session.flash('success', `Label "${nextTags.join(', ')}" dihapus dari ${groups.length} group.`)
      } else {
        session.flash('success', `Label kelompok pada ${groups.length} group berhasil dikosongkan.`)
      }
    }

    return response.redirect().back()
  }

  /** CSV export respecting the current filters (owner-scoped). */
  async export({ request, response, auth }: HttpContext) {
    const search = request.input('search')?.toString().trim() || undefined
    const type = request.input('type')?.toString() || 'all'
    const source = request.input('source')?.toString() || 'all'

    const groups = await this.scoped(auth.user!.id, { search, type, source }).orderBy(
      'created_at',
      'desc'
    )

    const header = 'group_id,group_name,group_type,member_count,source_type,group_url,tags'
    const lines = groups.map((g) =>
      [
        csvCell(g.groupId),
        csvCell(g.groupName),
        csvCell(g.groupType),
        csvCell(g.memberCount ?? ''),
        csvCell(g.sourceType),
        csvCell(g.groupUrl),
        csvCell(Array.isArray(g.tags) ? (g.tags as string[]).join('|') : ''),
      ].join(',')
    )

    response.header('Content-Type', 'text/csv; charset=utf-8')
    response.header('Content-Disposition', 'attachment; filename="groups.csv"')
    return [header, ...lines].join('\n')
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
