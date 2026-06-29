/* eslint-disable @unicorn/no-await-expression-member */
import Campaign from '#models/campaign'
import CampaignAccount from '#models/campaign_account'
import CampaignGroup from '#models/campaign_group'
import CampaignProfile from '#models/campaign_profile'
import CampaignRuntimeState from '#models/campaign_runtime_state'
import SessionLog from '#models/session_log'
import FacebookAccount from '#models/facebook_account'
import FacebookGroup from '#models/facebook_group'
import FacebookProfile from '#models/facebook_profile'
import FingerprintProfile from '#models/fingerprint_profile'
import { normalizeGroupTags } from '#services/group/tags'
import {
  createCampaignValidator,
  updateCampaignStatusValidator,
  bulkCampaignValidator,
  updateCampaignValidator,
} from '#validators/campaign'
import type { HttpContext } from '@adonisjs/core/http'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'name', 'type', 'status'] as const
type QueueWorkerStatus = {
  state: 'online' | 'offline' | 'error' | 'unknown'
  queue: string | null
  routingKey: string | null
  consumers: number
  messages: number
  checkedAt: string
  note: string
}
type CampaignLiveProgress = {
  stage: string
  stageLabel: string
  actionLabel: string | null
  targetLabel: string
  processed: number
  total: number | null
  success: number
  failed: number
  skipped: number
  pending: number
  running: number
  discovered: number
  persisted: number
  percent: number | null
  indeterminate: boolean
  currentBatch: number | null
  totalBatches: number | null
  completedBatches: number
  activeBatches: number
  batchLabel: string | null
  etaSeconds: number | null
  elapsedSeconds: number | null
  throughputPerMinute: number | null
  currentAccountLabel: string | null
  currentGroupName: string | null
  currentTargetCode: string | null
  currentLabel: string | null
  skippedByType: number
  skippedByMemberCount: number
  skippedByMissingName: number
  skippedDuplicates: number
  updatedAt: string | null
}
type CampaignType =
  | 'scrape_group'
  | 'auto_share'
  | 'auto_join'
  | 'scrape_profile'
  | 'auto_add_friend'
  | 'auto_like'
  | 'auto_comment'
  | 'auto_invite'
  | 'auto_post'
  | 'auto_unfriend'
  | 'auto_inbox'
  | 'auto_delete'
  | 'auto_confirm'
  | 'auto_create'

type CampaignGroupType = 'public' | 'private' | 'both'
type CampaignProfileType = 'group_member' | 'page_profile_follower' | 'friend' | 'engagement_post'
type CampaignInviteType = 'group' | 'page_follower' | 'event'
type CampaignPostType = 'group' | 'fanspage' | 'event' | 'friend'
type CampaignCommentType = 'post' | 'comment'
type CampaignInboxType = 'friend' | 'fanspage'
type CampaignDeleteType = 'post' | 'comment'
type CampaignConfirmType = 'friend' | 'group'
type CampaignCreateType = 'group' | 'fanspage' | 'event'
type CampaignAddFriendType = 'group' | 'profile' | 'any_facebook_url'

function normalizeCampaignName(value?: string) {
  if (!value) return ''
  let text = value.replace(/\s+/g, ' ').trim()
  if (!text) return ''

  text = text.replace(/^foto profil\s*[:\-|]?\s*/i, '').trim()
  return text
}

function fallbackCampaignName(payload: {
  type: CampaignType
  config?: {
    keyword?: string
    friendProfileUrl?: string
    url?: string
    pageUrl?: string
    anyFacebookUrl?: string
    manualGroupUrl?: string
    scrapeProfileType?: CampaignProfileType | null
    inviteType?: CampaignInviteType | null
    postType?: CampaignPostType | null
    commentType?: CampaignCommentType | null
    inboxType?: CampaignInboxType | null
    deleteType?: CampaignDeleteType | null
    confirmType?: CampaignConfirmType | null
    createType?: CampaignCreateType | null
    addFriendType?: CampaignAddFriendType | null
  }
}) {
  const labels: Record<CampaignType, string> = {
    scrape_group: 'Scrape Group',
    auto_share: 'Auto Share',
    auto_join: 'Auto Join',
    scrape_profile: 'Scrape Profile',
    auto_add_friend: 'Auto Add Friend',
    auto_like: 'Auto Like',
    auto_comment: 'Auto Comment',
    auto_invite: 'Auto Invite',
    auto_post: 'Auto Post',
    auto_unfriend: 'Auto Unfriend',
    auto_inbox: 'Auto Inbox',
    auto_delete: 'Auto Delete',
    auto_confirm: 'Auto Confirm',
    auto_create: 'Auto Create',
  }

  if (payload.type === 'scrape_group') {
    if (payload.config?.keyword) return `Scrape Group · ${payload.config.keyword.trim()}`
    if (payload.config?.friendProfileUrl) return 'Scrape Group · Joined Group Teman'
    return 'Scrape Group'
  }
  if (payload.type === 'auto_share') {
    if (payload.config?.url) return 'Auto Share'
    return 'Auto Share'
  }
  if (payload.type === 'scrape_profile') {
    if (payload.config?.scrapeProfileType) {
      return `Scrape Profile · ${payload.config.scrapeProfileType}`
    }
    return 'Scrape Profile'
  }
  if (payload.type === 'auto_add_friend') {
    if (payload.config?.addFriendType === 'group') {
      return 'Auto Add Friend · Group'
    }
    if (payload.config?.addFriendType === 'any_facebook_url') {
      return 'Auto Add Friend · Any Facebook URL'
    }
    return 'Auto Add Friend'
  }
  if (payload.type === 'auto_like') {
    if (payload.config?.url) return 'Auto Like'
    return 'Auto Like'
  }
  if (payload.type === 'auto_comment') {
    if (payload.config?.commentType === 'post') return 'Auto Comment · Post'
    if (payload.config?.commentType === 'comment') return 'Auto Comment · Comment'
    return 'Auto Comment · Event'
  }
  if (payload.type === 'auto_invite') {
    if (payload.config?.inviteType === 'group') return 'Auto Invite · Group'
    if (payload.config?.inviteType === 'page_follower') return 'Auto Invite · Page Follower'
    if (payload.config?.inviteType === 'event') return 'Auto Invite · Event'
    return 'Auto Invite'
  }
  if (payload.type === 'auto_post') {
    if (payload.config?.manualGroupUrl) return 'Auto Post · Manual Group URL'
    if (payload.config?.postType === 'group') return 'Auto Post · Group'
    if (payload.config?.postType === 'fanspage') return 'Auto Post · Fanspage'
    if (payload.config?.postType === 'event') return 'Auto Post · Event'
    if (payload.config?.postType === 'friend') return 'Auto Post · Friend'
    return 'Auto Post'
  }
  if (payload.type === 'auto_unfriend') {
    if (payload.config?.url) return 'Auto Unfriend'
    return 'Auto Unfriend'
  }
  if (payload.type === 'auto_inbox') {
    if (payload.config?.inboxType === 'friend') return 'Auto Inbox · Friend'
    if (payload.config?.inboxType === 'fanspage') return 'Auto Inbox · Fanspage'
    return 'Auto Inbox · Event'
  }
  if (payload.type === 'auto_delete') {
    if (payload.config?.deleteType === 'post') return 'Auto Delete · Post'
    if (payload.config?.deleteType === 'comment') return 'Auto Delete · Comment'
    return 'Auto Delete · Event'
  }
  if (payload.type === 'auto_confirm') {
    if (payload.config?.confirmType === 'friend') return 'Auto Confirm · Friend'
    if (payload.config?.confirmType === 'group') return 'Auto Confirm · Group'
    return 'Auto Confirm · Event'
  }
  if (payload.type === 'auto_create') {
    if (payload.config?.createType === 'group') return 'Auto Create · Group'
    if (payload.config?.createType === 'fanspage') return 'Auto Create · Fanspage'
    if (payload.config?.createType === 'event') return 'Auto Create · Event'
    return 'Auto Create · Event'
  }

  return labels[payload.type]
}

function groupHasAnyTag(groupTags: string[] | null, selectedTags: string[]) {
  if (!groupTags?.length || !selectedTags.length) return false
  return groupTags.some((tag) => selectedTags.includes(tag))
}

function extractCampaignGroupTags(config: Record<string, unknown> | null | undefined) {
  return Array.isArray(config?.groupTags)
    ? normalizeGroupTags(
        config.groupTags.filter((value): value is string => typeof value === 'string')
      )
    : []
}

function profilesHasAnyTag(profileTags: string[] | null, selectedTags: string[]) {
  if (!profileTags?.length || !selectedTags.length) return false
  return profileTags.some((tag) => selectedTags.includes(tag))
}

function extractCampaignProfileTags(config: Record<string, unknown> | null | undefined) {
  return Array.isArray(config?.profileTags)
    ? normalizeGroupTags(
        config.profileTags.filter((value): value is string => typeof value === 'string')
      )
    : []
}

export default class CampaignsController {
  /** Owner-scoped: each user manages their own campaigns. */
  private scoped(
    userId: string,
    filters: {
      search?: string
      type?: string
      status?: string
      startDate?: string
      endDate?: string
    }
  ) {
    const query = Campaign.query().where('user_id', userId)
    if (filters.type && filters.type !== 'all') query.where('type', filters.type)
    if (filters.status && filters.status !== 'all') query.where('status', filters.status)
    if (filters.search) query.whereILike('name', `%${filters.search}%`)
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

  private resolveCampaignName(payload: {
    name?: string
    type: CampaignType
    config?: {
      keyword?: string
      friendProfileUrl?: string
      pageUrl?: string
      url?: string
      anyFacebookUrl?: string
      manualGroupUrl?: string
      scrapeProfileType?: CampaignProfileType | null
      inviteType?: CampaignInviteType | null
      postType?: CampaignPostType | null
      inboxType?: CampaignInboxType | null
      commentType?: CampaignCommentType | null
      deleteType?: CampaignDeleteType | null
      confirmType?: CampaignConfirmType | null
      createType?: CampaignCreateType | null
    }
  }) {
    const normalized = normalizeCampaignName(payload.name)
    return normalized || fallbackCampaignName(payload)
  }

  private async resolveEligibleGroupIds(options: {
    userId: string
    groupIds?: string[]
    groupTags?: string[]
    minGroupMember?: number | null
    enforceMinGroupMember?: boolean
  }) {
    const requestedIds = Array.from(new Set(options.groupIds ?? []))
    const requestedTags = normalizeGroupTags(options.groupTags ?? [])
    if (!requestedIds.length && !requestedTags.length) {
      return { eligibleIds: [] as string[], skippedCount: 0 }
    }

    const ownedGroups = requestedIds.length
      ? await FacebookGroup.query()
          .where('user_id', options.userId)
          .whereIn('id', requestedIds)
          .select('id', 'member_count', 'tags')
      : []

    const taggedGroups = requestedTags.length
      ? await FacebookGroup.query()
          .where('user_id', options.userId)
          .whereNotNull('tags')
          .select('id', 'member_count', 'tags')
      : []

    const candidateGroups = new Map<string, { id: string; memberCount: number | null }>()
    for (const row of ownedGroups) {
      candidateGroups.set(row.id, {
        id: row.id,
        memberCount: row.memberCount,
      })
    }
    for (const row of taggedGroups) {
      const tags = Array.isArray(row.tags) ? (row.tags as string[]) : []
      if (!groupHasAnyTag(tags, requestedTags)) continue
      candidateGroups.set(row.id, {
        id: row.id,
        memberCount: row.memberCount,
      })
    }

    const eligibleIds = Array.from(candidateGroups.values())
      .filter((row) => {
        if (
          !options.enforceMinGroupMember ||
          !options.minGroupMember ||
          options.minGroupMember <= 0
        ) {
          return true
        }
        return row.memberCount !== null && row.memberCount >= options.minGroupMember
      })
      .map((row) => row.id)

    return {
      eligibleIds,
      skippedCount: Math.max(0, candidateGroups.size - eligibleIds.length),
    }
  }
  private async resolveEligibleProfileIds(options: {
    userId: string
    profileIds?: string[]
    profileTags?: string[]
    minFriendCount?: number | null
    enforceMinFriendCount?: boolean
  }) {
    const requestedIds = Array.from(new Set(options.profileIds ?? []))
    const requestedTags = normalizeGroupTags(options.profileTags ?? [])
    if (!requestedIds.length && !requestedTags.length) {
      return { eligibleIds: [] as string[], skippedCount: 0 }
    }

    const ownedProfiles = requestedIds.length
      ? await FacebookProfile.query()
          .where('user_id', options.userId)
          .whereIn('id', requestedIds)
          .select('id', 'friend_count', 'tags')
      : []

    const taggedProfiles = requestedTags.length
      ? await FacebookProfile.query()
          .where('user_id', options.userId)
          .whereNotNull('tags')
          .select('id', 'friend_count', 'tags')
      : []

    const candidateProfiles = new Map<string, { id: string; friendCount: number | null }>()
    for (const row of ownedProfiles) {
      candidateProfiles.set(row.id, {
        id: row.id,
        friendCount: row.friendCount,
      })
    }
    for (const row of taggedProfiles) {
      const tags = Array.isArray(row.tags) ? (row.tags as string[]) : []
      if (!profilesHasAnyTag(tags, requestedTags)) continue
      candidateProfiles.set(row.id, {
        id: row.id,
        friendCount: row.friendCount,
      })
    }

    const eligibleIds = Array.from(candidateProfiles.values())
      .filter((row) => {
        if (
          !options.enforceMinFriendCount ||
          !options.minFriendCount ||
          options.minFriendCount <= 0
        ) {
          return true
        }
        return row.friendCount !== null && row.friendCount >= options.minFriendCount
      })
      .map((row) => row.id)

    return {
      eligibleIds,
      skippedCount: Math.max(0, candidateProfiles.size - eligibleIds.length),
    }
  }

  async index({ request, inertia, auth }: HttpContext) {
    const user = auth.user!
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('per_page', 15)) || 15, 100)
    const search = request.input('search')?.toString().trim() || undefined
    const type = request.input('type')?.toString() || 'all'
    const status = request.input('status')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, { search, type, status, startDate, endDate })
      .withCount('accounts')
      .withCount('groups')
      .orderBy(sort, order)
      .paginate(page, perPage)

    const allOwn = await Campaign.query()
      .where('user_id', user.id)
      .select('id', 'type', 'status')
      .orderBy('created_at', 'desc')

    const stats = {
      total: allOwn.length,
      scrapeGroup: allOwn.filter((c) => c.type === 'scrape_group').length,
      autoShare: allOwn.filter((c) => c.type === 'auto_share').length,
      autoJoin: allOwn.filter((c) => c.type === 'auto_join').length,
      scrapeProfile: allOwn.filter((c) => c.type === 'scrape_profile').length,
      autoAddFriend: allOwn.filter((c) => c.type === 'auto_add_friend').length,
      autoLike: allOwn.filter((c) => c.type === 'auto_like').length,
      autoComment: allOwn.filter((c) => c.type === 'auto_comment').length,
      autoInvite: allOwn.filter((c) => c.type === 'auto_invite').length,
      autoPost: allOwn.filter((c) => c.type === 'auto_post').length,
      autoUnfriend: allOwn.filter((c) => c.type === 'auto_unfriend').length,
      autoDelete: allOwn.filter((c) => c.type === 'auto_delete').length,
      autoConfirm: allOwn.filter((c) => c.type === 'auto_confirm').length,
      autoCreate: allOwn.filter((c) => c.type === 'auto_create').length,
      autoInbox: allOwn.filter((c) => c.type === 'auto_inbox').length,
      draft: allOwn.filter((c) => c.status === 'draft').length,
      running: allOwn.filter((c) => c.status === 'running').length,
      completed: allOwn.filter((c) => c.status === 'completed').length,
      paused: allOwn.filter((c) => c.status === 'paused').length,
      failed: allOwn.filter((c) => c.status === 'failed').length,
    }

    const data = result.all().map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      headless: c.headless ?? true,
      advanceMode: c.advanceMode ?? false,
      useProxy: c.useProxy,
      maxConcurrency: c.maxConcurrency,
      accountsCount: Number(c.$extras.accounts_count ?? 0),
      groupsCount: Number(c.$extras.groups_count ?? 0),
      createdAt: c.createdAt ? c.createdAt.toISO() : null,
    }))

    return inertia.render('campaigns/index', {
      campaigns: {
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
        status,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async create({ inertia, auth }: HttpContext) {
    const userId = auth.user!.id
    const [accounts, fingerprints, groups, profiles] = await Promise.all([
      FacebookAccount.query().where('user_id', userId).orderBy('label', 'asc'),
      FingerprintProfile.query().where('user_id', userId).orderBy('name', 'asc'),
      FacebookGroup.query().where('user_id', userId).orderBy('group_id', 'asc'),
      FacebookProfile.query().where('user_id', userId).orderBy('profile_name', 'asc'),
    ])
    const groupTagOptions = Array.from(
      new Set(
        groups.flatMap((group) =>
          Array.isArray(group.tags) ? (group.tags as string[]).filter(Boolean) : []
        )
      )
    ).sort((left, right) => left.localeCompare(right, 'id'))
    const profileTagOptions = Array.from(
      new Set(
        profiles.flatMap((profile) =>
          Array.isArray(profile.tags) ? (profile.tags as string[]).filter(Boolean) : []
        )
      )
    ).sort((left, right) => left.localeCompare(right, 'id'))

    return inertia.render('campaigns/create', {
      accounts: accounts.map((a) => ({
        id: a.id,
        label: a.label,
        fbUserId: a.fbUserId,
        sessionStatus: a.sessionStatus,
      })),
      fingerprints: fingerprints.map((f) => ({
        id: f.id,
        name: f.name,
        osType: f.osType,
        browserType: f.browserType,
      })),
      groups: groups.map((g) => ({
        id: g.id,
        groupId: g.groupId,
        groupName: g.groupName,
        groupType: g.groupType,
        memberCount: g.memberCount,
        tags: Array.isArray(g.tags) ? (g.tags as string[]) : [],
      })),
      profiles: profiles.map((p) => ({
        id: p.id,
        profileId: p.profileId,
        profileName: p.profileName,
        profileUrl: p.profileUrl,
        friendCount: p.friendCount,
        tags: Array.isArray(p.tags) ? (p.tags as string[]) : [],
      })),
      groupTagOptions,
      profileTagOptions,
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(createCampaignValidator)
    console.log(payload)
    const userId = auth.user!.id
    const normalizedGroupTags = extractCampaignGroupTags(payload.config ?? {})
    const normalizedProfileTags = extractCampaignProfileTags(payload.config ?? {})

    if (payload.type === 'auto_share' && !payload.config?.url) {
      session.flash('error', 'Auto Share membutuhkan URL target.')
      return response.redirect().back()
    }
    if (
      payload.type === 'scrape_group' &&
      !payload.config?.keyword &&
      !payload.config?.friendProfileUrl
    ) {
      session.flash('error', 'Scrape Group membutuhkan keyword atau URL profil teman.')
      return response.redirect().back()
    }

    if (
      payload.type === 'scrape_profile' &&
      !payload.config?.pageUrl &&
      !payload.config?.scrapeProfileType
    ) {
      session.flash('error', 'Scrape Profile membutuhkan URL halaman atau tipe profil.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_add_friend') {
      if (!payload.config?.addFriendType) {
        session.flash('error', 'Auto Add Friend membutuhkan tipe add friend.')
        return response.redirect().back()
      }
      if (payload.config?.addFriendType === 'any_facebook_url' && !payload.config?.anyFacebookUrl) {
        session.flash('error', 'Auto Add Friend membutuhkan URL Facebook.')
        return response.redirect().back()
      }
    }

    if (payload.type === 'auto_like' && !payload.config?.url) {
      session.flash('error', 'Auto Like membutuhkan URL target.')
      return response.redirect().back()
    }
    if (
      payload.type === 'auto_comment' &&
      (!payload.config?.commentType || !payload.config?.url || !payload.config?.caption)
    ) {
      session.flash(
        'error',
        'Auto Comment membutuhkan tipe comment atau URL target dan caption comment.'
      )
      return response.redirect().back()
    }
    if (payload.type === 'auto_comment' && payload.config?.commentType !== 'post') {
      session.flash('error', 'Auto Comment saat ini baru mendukung target post.')
      return response.redirect().back()
    }

    if (payload.type === 'auto_invite' && !payload.config?.inviteType) {
      session.flash('error', 'Auto Invite membutuhkan tipe invite.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_invite' && payload.config?.inviteType === 'event') {
      session.flash(
        'error',
        'Auto Invite saat ini baru mendukung target group dan page follower. Mode event masih diparkir.'
      )
      return response.redirect().back()
    }
    if (payload.type === 'auto_invite' && !payload.config?.url) {
      session.flash('error', 'Auto Invite membutuhkan URL target invite.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_post' && (!payload.config?.postType || !payload.config?.caption)) {
      session.flash('error', 'Auto Post membutuhkan tipe posting dan caption posting.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_post' && payload.config?.postType !== 'group') {
      session.flash('error', 'Auto Post saat ini baru mendukung target group.')
      return response.redirect().back()
    }
    if (
      payload.type === 'auto_post' &&
      !payload.config?.manualGroupUrl &&
      !(payload.groupIds?.length || normalizedGroupTags.length)
    ) {
      session.flash(
        'error',
        'Auto Post membutuhkan minimal 1 target group dari list/label atau 1 URL group manual.'
      )
      return response.redirect().back()
    }
    if (payload.type === 'auto_inbox' && (!payload.config?.inboxType || !payload.config?.caption)) {
      session.flash('error', 'Auto Inbox membutuhkan tipe inbox dan caption inbox.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_inbox' && payload.config?.inboxType !== 'friend') {
      session.flash('error', 'Auto Inbox saat ini baru mendukung target friend.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_delete' && (!payload.config?.deleteType || !payload.config?.url)) {
      session.flash('error', 'Auto Delete membutuhkan tipe delete dan URL target.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_confirm' && !payload.config?.confirmType) {
      session.flash('error', 'Auto Confirm membutuhkan tipe confirm.')
      return response.redirect().back()
    }
    if (
      payload.type === 'auto_confirm' &&
      payload.config?.confirmType === 'group' &&
      !payload.config?.url
    ) {
      session.flash('error', 'Auto Confirm group membutuhkan URL target group atau halaman member requests.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_create' && !payload.config?.createType) {
      session.flash('error', 'Auto Create membutuhkan tipe create.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_create' && payload.config?.createType !== 'group') {
      session.flash('error', 'Auto Create saat ini baru mendukung mode group. Fanspage dan event masih diparkir.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_create' && !String(payload.name ?? '').trim()) {
      session.flash('error', 'Auto Create group membutuhkan nama campaign yang akan dipakai sebagai nama group.')
      return response.redirect().back()
    }

    const campaignName = this.resolveCampaignName({
      name: payload.name,
      type: payload.type,
      config: payload.config,
    })
    const shouldEnforceMinGroupMember =
      payload.type === 'auto_share' || payload.type === 'auto_join'

    const shouldEnforceMinFriendCount = payload.type === 'auto_add_friend'

    const campaign = await db.transaction(async (trx) => {
      const created = await Campaign.create(
        {
          userId,
          name: campaignName,
          type: payload.type,
          status: 'draft',
          config: {
            ...(payload.config ?? {}),
            ...(normalizedGroupTags.length ? { groupTags: normalizedGroupTags } : {}),
            ...(normalizedProfileTags.length ? { profileTags: normalizedProfileTags } : {}),
          },
          targetGroupType: payload.targetGroupType ?? null,
          fingerprintId: payload.fingerprintId ?? null,
          useProxy: payload.useProxy ?? false,
          maxConcurrency: payload.maxConcurrency ?? 1,
          maxAccounts: payload.maxAccounts ?? 1,
          maxDelayMs: payload.maxDelayMs ?? 3000,
          maxTargets: payload.maxTargets ?? null,
          headless: payload.headless ?? true,
          advanceMode: payload.advanceMode ?? false,
          minGroupMember: payload.minGroupMember ?? 10000,
        },
        { client: trx }
      )

      if (payload.accountIds?.length) {
        const owned = await FacebookAccount.query({ client: trx })
          .where('user_id', userId)
          .whereIn('id', payload.accountIds)
          .select('id')
        if (owned.length) {
          await CampaignAccount.createMany(
            owned.map((a) => ({ campaignId: created.id, accountId: a.id })),
            { client: trx }
          )
        }
      }

      if (payload.groupIds?.length) {
        const { eligibleIds } = await this.resolveEligibleGroupIds({
          userId,
          groupIds: payload.groupIds,
          groupTags: normalizedGroupTags,
          minGroupMember: payload.minGroupMember,
          enforceMinGroupMember: shouldEnforceMinGroupMember,
        })
        if (eligibleIds.length) {
          await CampaignGroup.createMany(
            eligibleIds.map((groupId) => ({ campaignId: created.id, groupId })),
            { client: trx }
          )
        }
      } else if (normalizedGroupTags.length) {
        const { eligibleIds } = await this.resolveEligibleGroupIds({
          userId,
          groupTags: normalizedGroupTags,
          minGroupMember: payload.minGroupMember,
          enforceMinGroupMember: shouldEnforceMinGroupMember,
        })
        if (eligibleIds.length) {
          await CampaignGroup.createMany(
            eligibleIds.map((groupId) => ({ campaignId: created.id, groupId })),
            { client: trx }
          )
        }
      }

      if (payload.profileIds?.length) {
        const { eligibleIds } = await this.resolveEligibleProfileIds({
          userId,
          profileIds: payload.profileIds,
          profileTags: normalizedProfileTags,
          minFriendCount: payload.config?.minFriendCount,
          enforceMinFriendCount: shouldEnforceMinFriendCount,
        })
        if (eligibleIds.length) {
          await CampaignProfile.createMany(
            eligibleIds.map((profileId) => ({ campaignId: created.id, profileId })),
            { client: trx }
          )
        }
      } else if (normalizedProfileTags.length) {
        const { eligibleIds } = await this.resolveEligibleProfileIds({
          userId,
          profileTags: normalizedProfileTags,
          minFriendCount: payload.config?.minFriendCount,
          enforceMinFriendCount: shouldEnforceMinFriendCount,
        })
        if (eligibleIds.length) {
          await CampaignProfile.createMany(
            eligibleIds.map((profileId) => ({ campaignId: created.id, profileId })),
            { client: trx }
          )
        }
      }

      return created
    })

    session.flash('success', `Campaign "${campaign.name}" dibuat (draft).`)
    return response.redirect().toRoute('campaigns.show', { id: campaign.id })
  }

  async show({ params, inertia, auth }: HttpContext) {
    const campaign = await Campaign.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .preload('fingerprint')
      .preload('accounts', (q) => q.preload('account'))
      .preload('groups', (q) => q.preload('group'))
      .firstOrFail()

    const logs = await SessionLog.query()
      .where('campaign_id', campaign.id)
      .orderBy('created_at', 'desc')
    const workerStatus = await this.getWorkerStatus(campaign.type)
    const campaignProgress = await this.getCampaignProgress(campaign)

    const accountLogStats = new Map<
      string,
      { total: number; success: number; error: number; lastLogAt: string | null }
    >()
    const groupLogStats = new Map<
      string,
      { total: number; success: number; error: number; lastLogAt: string | null }
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

      if (log.accountId) {
        const bucket = accountLogStats.get(log.accountId) ?? {
          total: 0,
          success: 0,
          error: 0,
          lastLogAt: null,
        }
        bucket.total++
        if (isSuccess) bucket.success++
        if (isError) bucket.error++
        if (
          createdAt &&
          (!bucket.lastLogAt ||
            DateTime.fromISO(createdAt).toMillis() > DateTime.fromISO(bucket.lastLogAt).toMillis())
        ) {
          bucket.lastLogAt = createdAt
        }
        accountLogStats.set(log.accountId, bucket)
      }

      if (log.groupId) {
        const bucket = groupLogStats.get(log.groupId) ?? {
          total: 0,
          success: 0,
          error: 0,
          lastLogAt: null,
        }
        bucket.total++
        if (isSuccess) bucket.success++
        if (isError) bucket.error++
        if (
          createdAt &&
          (!bucket.lastLogAt ||
            DateTime.fromISO(createdAt).toMillis() > DateTime.fromISO(bucket.lastLogAt).toMillis())
        ) {
          bucket.lastLogAt = createdAt
        }
        groupLogStats.set(log.groupId, bucket)
      }
    }

    const completedAccountStatuses = new Set(['success', 'completed', 'done'])
    const failedAccountStatuses = new Set(['failed', 'error'])
    const completedGroupStatuses = new Set(['success', 'completed', 'done'])
    const failedGroupStatuses = new Set(['failed', 'error'])

    const accountStatusBuckets = {
      total: campaign.accounts.length,
      completed: 0,
      failed: 0,
      pending: 0,
    }
    const groupStatusBuckets = {
      total: campaign.groups.length,
      completed: 0,
      failed: 0,
      pending: 0,
    }

    const accountRelations = campaign.accounts.map((ca) => {
      const stats = accountLogStats.get(ca.accountId) ?? {
        total: 0,
        success: 0,
        error: 0,
        lastLogAt: null,
      }
      const relationStatus = ca.status.toLowerCase()
      if (completedAccountStatuses.has(relationStatus)) accountStatusBuckets.completed++
      else if (failedAccountStatuses.has(relationStatus)) accountStatusBuckets.failed++
      else accountStatusBuckets.pending++

      return {
        id: ca.id,
        accountId: ca.accountId,
        status: ca.status,
        label: ca.account?.label ?? '—',
        fbUserId: ca.account?.fbUserId ?? null,
        sessionStatus: ca.account?.sessionStatus ?? null,
        lastUsedAt: ca.account?.lastUsedAt?.toISO() ?? null,
        logCount: stats.total,
        successCount: stats.success,
        errorCount: stats.error,
        lastLogAt: stats.lastLogAt,
      }
    })

    const groupRelations = campaign.groups.map((cg) => {
      const stats = groupLogStats.get(cg.groupId) ?? {
        total: 0,
        success: 0,
        error: 0,
        lastLogAt: null,
      }
      const relationStatus = cg.status.toLowerCase()
      if (completedGroupStatuses.has(relationStatus)) groupStatusBuckets.completed++
      else if (failedGroupStatuses.has(relationStatus)) groupStatusBuckets.failed++
      else groupStatusBuckets.pending++

      return {
        id: cg.id,
        relationGroupId: cg.groupId,
        status: cg.status,
        processedAt: cg.processedAt?.toISO() ?? null,
        groupId: cg.group?.groupId ?? '—',
        groupName: cg.group?.groupName ?? null,
        groupType: cg.group?.groupType ?? null,
        groupUrl: cg.group?.groupUrl ?? null,
        memberCount: cg.group?.memberCount ?? null,
        sourceType: cg.group?.sourceType ?? null,
        sourceKeyword: cg.group?.sourceKeyword ?? null,
        logCount: stats.total,
        successCount: stats.success,
        errorCount: stats.error,
        lastLogAt: stats.lastLogAt,
      }
    })

    const actionReport = Array.from(actionAnalysis.values()).sort((left, right) => {
      if (right.total !== left.total) return right.total - left.total
      const leftMillis = left.lastActivityAt ? DateTime.fromISO(left.lastActivityAt).toMillis() : 0
      const rightMillis = right.lastActivityAt
        ? DateTime.fromISO(right.lastActivityAt).toMillis()
        : 0
      return rightMillis - leftMillis
    })

    const averageDurationMs =
      durationSamples > 0 ? Math.round(durationTotalMs / durationSamples) : null
    const runtimeMs =
      campaign.startedAt && campaign.endedAt
        ? Math.max(0, campaign.endedAt.toMillis() - campaign.startedAt.toMillis())
        : null
    const logSuccessRate =
      logBuckets.total > 0 ? Math.round((logBuckets.success / logBuckets.total) * 1000) / 10 : 0
    const accountCompletionRate =
      accountStatusBuckets.total > 0
        ? Math.round((accountStatusBuckets.completed / accountStatusBuckets.total) * 1000) / 10
        : 0
    const groupCompletionRate =
      groupStatusBuckets.total > 0
        ? Math.round((groupStatusBuckets.completed / groupStatusBuckets.total) * 1000) / 10
        : 0

    const accountLookup = new Map(accountRelations.map((row) => [row.accountId, row]))
    const groupLookup = new Map(groupRelations.map((row) => [row.relationGroupId, row]))
    const recentLogs = logs.slice(0, 100).map((l) => ({
      id: l.id,
      action: l.action,
      status: l.status,
      message: l.message,
      accountLabel: l.accountId ? (accountLookup.get(l.accountId)?.label ?? null) : null,
      groupName: l.groupId
        ? (groupLookup.get(l.groupId)?.groupName ?? groupLookup.get(l.groupId)?.groupId ?? null)
        : null,
      durationMs: l.durationMs,
      screenshotPath: l.screenshotPath,
      createdAt: l.createdAt ? l.createdAt.toISO() : null,
    }))

    return inertia.render('campaigns/show', {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type,
        status: campaign.status,
        config: campaign.config ?? {},
        targetGroupType: campaign.targetGroupType,
        useProxy: campaign.useProxy,
        maxConcurrency: campaign.maxConcurrency,
        maxAccounts: campaign.maxAccounts,
        maxDelayMs: campaign.maxDelayMs,
        maxTargets: campaign.maxTargets,
        headless: campaign.headless ?? true,
        advanceMode: campaign.advanceMode ?? false,
        minGroupMember: campaign.minGroupMember ?? 0,
        startedAt: campaign.startedAt ? campaign.startedAt.toISO() : null,
        endedAt: campaign.endedAt ? campaign.endedAt.toISO() : null,
        createdAt: campaign.createdAt ? campaign.createdAt.toISO() : null,
        updatedAt: campaign.updatedAt ? campaign.updatedAt.toISO() : null,
        fingerprint: campaign.fingerprint
          ? {
              id: campaign.fingerprint.id,
              name: campaign.fingerprint.name,
              osType: campaign.fingerprint.osType,
            }
          : null,
        accounts: accountRelations,
        groups: groupRelations,
      },
      campaignReport: {
        totalLogs: logBuckets.total,
        successLogs: logBuckets.success,
        errorLogs: logBuckets.error,
        pendingLogs: logBuckets.pending,
        checkpointLogs: logBuckets.checkpoint,
        skippedLogs: logBuckets.skipped,
        uniqueAccountsTouched: accountLogStats.size,
        uniqueGroupsTouched: groupLogStats.size,
        averageDurationMs,
        runtimeMs,
        logSuccessRate,
        accountCompletionRate,
        groupCompletionRate,
        firstLogAt,
        lastLogAt,
      },
      relationSummary: {
        accounts: accountStatusBuckets,
        groups: groupStatusBuckets,
      },
      actionReport,
      logs: recentLogs,
      workerStatus,
      campaignProgress,
    })
  }

  async edit({ params, inertia, auth }: HttpContext) {
    const userId = auth.user!.id
    const campaign = await Campaign.query()
      .where('id', params.id)
      .where('user_id', userId)
      .preload('accounts')
      .preload('groups')
      .preload('profiles')
      .firstOrFail()

    const [accounts, fingerprints, groups, profiles] = await Promise.all([
      FacebookAccount.query().where('user_id', userId).orderBy('label', 'asc'),
      FingerprintProfile.query().where('user_id', userId).orderBy('name', 'asc'),
      FacebookGroup.query().where('user_id', userId).orderBy('group_id', 'asc'),
      FacebookProfile.query().where('user_id', userId).orderBy('profile_name', 'asc'),
    ])
    const groupTagOptions = Array.from(
      new Set(
        groups.flatMap((group) =>
          Array.isArray(group.tags) ? (group.tags as string[]).filter(Boolean) : []
        )
      )
    ).sort((left, right) => left.localeCompare(right, 'id'))
    const profileTagOptions = Array.from(
      new Set(
        profiles.flatMap((profile) =>
          Array.isArray(profile.tags) ? (profile.tags as string[]).filter(Boolean) : []
        )
      )
    ).sort((left, right) => left.localeCompare(right, 'id'))

    return inertia.render('campaigns/edit', {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        type: campaign.type as CampaignType,
        status: campaign.status,
        config: {
          ...(campaign.config ?? {}),
          groupTags: extractCampaignGroupTags((campaign.config ?? {}) as Record<string, unknown>),
          profileTags: extractCampaignProfileTags(
            (campaign.config ?? {}) as Record<string, unknown>
          ),
        },
        targetGroupType: campaign.targetGroupType as CampaignGroupType,
        headless: campaign.headless ?? true,
        advanceMode: campaign.advanceMode ?? false,
        fingerprintId: campaign.fingerprintId,
        useProxy: campaign.useProxy,
        maxConcurrency: campaign.maxConcurrency,
        maxAccounts: campaign.maxAccounts,
        maxDelayMs: campaign.maxDelayMs,
        maxTargets: campaign.maxTargets,
        minGroupMember: campaign.minGroupMember ?? 0,
        accountIds: campaign.accounts.map((row) => row.accountId),
        groupIds: campaign.groups.map((row) => row.groupId),
        profileIds: campaign.profiles.map((row) => row.profileId),
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        label: account.label,
        fbUserId: account.fbUserId,
        sessionStatus: account.sessionStatus,
      })),
      fingerprints: fingerprints.map((fingerprint) => ({
        id: fingerprint.id,
        name: fingerprint.name,
        osType: fingerprint.osType,
        browserType: fingerprint.browserType,
      })),
      groups: groups.map((group) => ({
        id: group.id,
        groupId: group.groupId,
        groupName: group.groupName,
        groupType: group.groupType,
        memberCount: group.memberCount,
        tags: Array.isArray(group.tags) ? (group.tags as string[]) : [],
      })),
      profiles: profiles.map((profile) => ({
        id: profile.id,
        profileId: profile.profileId,
        profileName: profile.profileName,
        profileUrl: profile.profileUrl,
        friendCount: profile.friendCount,
        tags: Array.isArray(profile.tags) ? (profile.tags as string[]) : [],
      })),
      groupTagOptions,
      profileTagOptions,
    })
  }

  async update({ params, request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(updateCampaignValidator)
    const userId = auth.user!.id
    const normalizedGroupTags = extractCampaignGroupTags(payload.config ?? {})
    const normalizedProfileTags = extractCampaignProfileTags(payload.config ?? {})

    const campaign = await Campaign.query()
      .where('id', params.id)
      .where('user_id', userId)
      .firstOrFail()

    if (campaign.status === 'running') {
      session.flash('error', 'Campaign yang sedang berjalan harus dijeda sebelum diedit.')
      return response.redirect().back()
    }

    if (payload.type === 'auto_share' && !payload.config?.url) {
      session.flash('error', 'Auto Share membutuhkan URL target.')
      return response.redirect().back()
    }
    if (
      payload.type === 'scrape_group' &&
      !payload.config?.keyword &&
      !payload.config?.friendProfileUrl
    ) {
      session.flash('error', 'Scrape Group membutuhkan keyword atau URL profil teman.')
      return response.redirect().back()
    }
    if (
      payload.type === 'scrape_profile' &&
      !payload.config?.pageUrl &&
      !payload.config?.scrapeProfileType
    ) {
      session.flash('error', 'Scrape Profile membutuhkan URL target atau tipe profil.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_add_friend') {
      if (!payload.config?.addFriendType) {
        session.flash('error', 'Auto Add Friend membutuhkan tipe add friend.')
        return response.redirect().back()
      }
      if (payload.config?.addFriendType === 'any_facebook_url' && !payload.config?.anyFacebookUrl) {
        session.flash('error', 'Auto Add Friend membutuhkan URL Facebook.')
        return response.redirect().back()
      }
    }

    if (payload.type === 'auto_like' && !payload.config?.url) {
      session.flash('error', 'Auto Like membutuhkan URL target.')
      return response.redirect().back()
    }
    if (
      payload.type === 'auto_comment' &&
      (!payload.config?.commentType || !payload.config?.url || !payload.config?.caption)
    ) {
      session.flash('error', 'Auto Comment membutuhkan tipe comment, URL target, dan caption.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_comment' && payload.config?.commentType !== 'post') {
      session.flash('error', 'Auto Comment saat ini baru mendukung target post.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_invite' && !payload.config?.inviteType) {
      session.flash('error', 'Auto Invite membutuhkan tipe invite.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_invite' && payload.config?.inviteType === 'event') {
      session.flash(
        'error',
        'Auto Invite saat ini baru mendukung target group dan page follower. Mode event masih diparkir.'
      )
      return response.redirect().back()
    }
    if (payload.type === 'auto_invite' && !payload.config?.url) {
      session.flash('error', 'Auto Invite membutuhkan URL target invite.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_post' && !payload.config?.postType) {
      session.flash('error', 'Auto Post membutuhkan tipe posting.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_post' && payload.config?.postType !== 'group') {
      session.flash('error', 'Auto Post saat ini baru mendukung target group.')
      return response.redirect().back()
    }
    if (
      payload.type === 'auto_post' &&
      !payload.config?.manualGroupUrl &&
      !(payload.groupIds?.length || normalizedGroupTags.length)
    ) {
      session.flash(
        'error',
        'Auto Post membutuhkan minimal 1 target group dari list/label atau 1 URL group manual.'
      )
      return response.redirect().back()
    }
    if (payload.type === 'auto_inbox' && !payload.config?.inboxType) {
      session.flash('error', 'Auto Inbox membutuhkan tipe inbox.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_inbox' && payload.config?.inboxType !== 'friend') {
      session.flash('error', 'Auto Inbox saat ini baru mendukung target friend.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_delete' && (!payload.config?.deleteType || !payload.config?.url)) {
      session.flash('error', 'Auto Delete membutuhkan tipe delete dan URL target.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_confirm' && !payload.config?.confirmType) {
      session.flash('error', 'Auto Confirm membutuhkan tipe confirm.')
      return response.redirect().back()
    }
    if (
      payload.type === 'auto_confirm' &&
      payload.config?.confirmType === 'group' &&
      !payload.config?.url
    ) {
      session.flash('error', 'Auto Confirm group membutuhkan URL target group atau halaman member requests.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_create' && !payload.config?.createType) {
      session.flash('error', 'Auto Create membutuhkan tipe create.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_create' && payload.config?.createType !== 'group') {
      session.flash('error', 'Auto Create saat ini baru mendukung mode group. Fanspage dan event masih diparkir.')
      return response.redirect().back()
    }
    if (payload.type === 'auto_create' && !String(payload.name ?? '').trim()) {
      session.flash('error', 'Auto Create group membutuhkan nama campaign yang akan dipakai sebagai nama group.')
      return response.redirect().back()
    }

    if (payload.fingerprintId) {
      const ownsFingerprint = await FingerprintProfile.query()
        .where('id', payload.fingerprintId)
        .where('user_id', userId)
        .first()
      if (!ownsFingerprint) {
        session.flash('error', 'Fingerprint tidak ditemukan atau bukan milik Anda.')
        return response.redirect().back()
      }
    }

    const campaignName = this.resolveCampaignName({
      name: payload.name,
      type: payload.type,
      config: payload.config,
    })
    const shouldEnforceMinGroupMember =
      payload.type === 'auto_share' || payload.type === 'auto_join'
    const shouldEnforceMinFriendCount = payload.type === 'auto_add_friend'

    await db.transaction(async (trx) => {
      campaign.useTransaction(trx)
      campaign.merge({
        name: campaignName,
        type: payload.type,
        config: {
          ...(payload.config ?? {}),
          ...(normalizedGroupTags.length ? { groupTags: normalizedGroupTags } : {}),
          ...(normalizedProfileTags.length ? { profileTags: normalizedProfileTags } : {}),
        },
        targetGroupType: payload.targetGroupType ?? null,
        fingerprintId: payload.fingerprintId ?? null,
        useProxy: payload.useProxy ?? false,
        maxConcurrency: payload.maxConcurrency ?? 1,
        maxAccounts: payload.maxAccounts ?? 1,
        maxDelayMs: payload.maxDelayMs ?? 3000,
        maxTargets: payload.maxTargets ?? null,
        headless: payload.headless ?? true,
        advanceMode: payload.advanceMode ?? false,
        minGroupMember: payload.minGroupMember ?? 10000,
      })
      await campaign.save()

      const ownedAccounts = payload.accountIds?.length
        ? await FacebookAccount.query({ client: trx })
            .where('user_id', userId)
            .whereIn('id', payload.accountIds)
            .select('id')
        : []
      const accountIds = ownedAccounts.map((row) => row.id)
      const existingAccounts = await CampaignAccount.query({ client: trx }).where(
        'campaign_id',
        campaign.id
      )
      const existingAccountIds = new Set(existingAccounts.map((row) => row.accountId))
      const removedAccountIds = existingAccounts
        .filter((row) => !accountIds.includes(row.accountId))
        .map((row) => row.accountId)
      if (removedAccountIds.length) {
        await CampaignAccount.query({ client: trx })
          .where('campaign_id', campaign.id)
          .whereIn('account_id', removedAccountIds)
          .delete()
      }
      const newAccountIds = accountIds.filter((id) => !existingAccountIds.has(id))
      if (newAccountIds.length) {
        await CampaignAccount.createMany(
          newAccountIds.map((accountId) => ({ campaignId: campaign.id, accountId })),
          { client: trx }
        )
      }

      const { eligibleIds: groupIds } = await this.resolveEligibleGroupIds({
        userId,
        groupIds: payload.groupIds,
        groupTags: normalizedGroupTags,
        minGroupMember: payload.minGroupMember,
        enforceMinGroupMember: shouldEnforceMinGroupMember,
      })

      const { eligibleIds: profileIds } = await this.resolveEligibleProfileIds({
        userId,
        profileTags: normalizedProfileTags,
        profileIds: payload.profileIds,
        minFriendCount: payload.config?.minFriendCount,
        enforceMinFriendCount: shouldEnforceMinFriendCount,
      })

      const existingGroups = await CampaignGroup.query({ client: trx }).where(
        'campaign_id',
        campaign.id
      )
      const existingGroupIds = new Set(existingGroups.map((row) => row.groupId))
      const removedGroupIds = existingGroups
        .filter((row) => !groupIds.includes(row.groupId))
        .map((row) => row.groupId)
      if (removedGroupIds.length) {
        await CampaignGroup.query({ client: trx })
          .where('campaign_id', campaign.id)
          .whereIn('group_id', removedGroupIds)
          .delete()
      }
      const newGroupIds = groupIds.filter((id) => !existingGroupIds.has(id))
      if (newGroupIds.length) {
        await CampaignGroup.createMany(
          newGroupIds.map((groupId) => ({ campaignId: campaign.id, groupId })),
          { client: trx }
        )
      }

      const existingProfiles = await CampaignProfile.query({ client: trx }).where(
        'campaign_id',
        campaign.id
      )
      const existingProfileIds = new Set(existingProfiles.map((row) => row.profileId))
      const removedProfileIds = existingProfiles
        .filter((row) => !profileIds.includes(row.profileId))
        .map((row) => row.profileId)
      if (removedProfileIds.length) {
        await CampaignProfile.query({ client: trx })
          .where('campaign_id', campaign.id)
          .whereIn('profile_id', removedProfileIds)
          .delete()
      }
      const newProfileIds = profileIds.filter((id) => !existingProfileIds.has(id))
      if (newProfileIds.length) {
        await CampaignProfile.createMany(
          newProfileIds.map((profileId) => ({ campaignId: campaign.id, profileId })),
          { client: trx }
        )
      }
    })

    session.flash('success', `Campaign "${campaign.name}" berhasil diperbarui.`)
    return response.redirect().toRoute('campaigns.show', { id: campaign.id })
  }

  async updateStatus({ params, request, response, session, auth }: HttpContext) {
    const { status } = await request.validateUsing(updateCampaignStatusValidator)
    const campaign = await Campaign.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()

    // Starting/resuming → enqueue the job to RabbitMQ before marking it running.
    if (status === 'running') {
      try {
        const { publishCampaignJob } = await import('#services/queue/amqp_publisher')
        await publishCampaignJob({
          campaignId: campaign.id,
          userId: auth.user!.id,
          type: campaign.type as
            | 'scrape_group'
            | 'auto_share'
            | 'auto_join'
            | 'scrape_profile'
            | 'auto_add_friend'
            | 'auto_like'
            | 'auto_comment'
            | 'auto_invite'
            | 'auto_post'
            | 'auto_unfriend'
            | 'auto_inbox'
            | 'auto_delete'
            | 'auto_confirm',
          enqueuedAt: DateTime.now().toISO()!,
        })
      } catch (error) {
        session.flash('error', `Gagal mengirim job ke queue: ${(error as Error).message}`)
        return response.redirect().toRoute('campaigns.show', { id: campaign.id })
      }
    }

    campaign.status = status
    if (status === 'running' && !campaign.startedAt) campaign.startedAt = DateTime.now()
    if (status === 'completed' || status === 'failed') campaign.endedAt = DateTime.now()
    await campaign.save()

    session.flash('success', `Status campaign → ${status}.`)
    return response.redirect().toRoute('campaigns.show', { id: campaign.id })
  }

  /**
   * Server-Sent Events stream of live progress: new session_logs + the
   * campaign status, polled from the DB every 2s until the run ends or the
   * client disconnects.
   */
  async stream({ params, request, response, auth }: HttpContext) {
    const campaign = await Campaign.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()

    const res = response.response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.write('retry: 3000\n\n')

    let closed = false
    const req = request.request
    const closeStream = () => {
      closed = true
    }
    req.once('close', closeStream)

    const send = (event: string, data: unknown) => {
      if (closed || res.writableEnded || res.destroyed) return
      try {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
      } catch {
        closed = true
      }
    }

    const sent = new Set<string>()
    let cursor: DateTime = DateTime.now()
    const deadline = Date.now() + 30 * 60 * 1000

    try {
      send('status', {
        status: campaign.status,
        progress: await this.getCampaignProgress(campaign.id),
      })

      while (!closed && Date.now() < deadline) {
        const logs = await SessionLog.query()
          .where('campaign_id', campaign.id)
          .where('created_at', '>=', cursor.toSQL()!)
          .orderBy('created_at', 'asc')

        for (const log of logs) {
          if (sent.has(log.id)) continue
          sent.add(log.id)
          send('log', {
            id: log.id,
            action: log.action,
            status: log.status,
            message: log.message,
            createdAt: log.createdAt ? log.createdAt.toISO() : null,
          })
          if (log.createdAt && log.createdAt > cursor) cursor = log.createdAt
        }

        await campaign.refresh()
        send('status', {
          status: campaign.status,
          workerStatus: await this.getWorkerStatus(campaign.type),
          progress: await this.getCampaignProgress(campaign.id),
        })
        if (campaign.status === 'completed' || campaign.status === 'failed' || closed) break

        await new Promise((resolve) => setTimeout(resolve, 2000))
      }

      send('done', { status: campaign.status })
    } finally {
      req.off('close', closeStream)
      if (!res.writableEnded && !res.destroyed) {
        res.end()
      }
    }
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const campaign = await Campaign.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    await campaign.delete()
    session.flash('success', 'Campaign dihapus.')
    return response.redirect().toRoute('campaigns.index')
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkCampaignValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        type: payload.filters?.type,
        status: payload.filters?.status,
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      ids = (await query.select('id')).map((row) => row.id)
    }

    if (!ids.length) {
      session.flash('error', 'Tidak ada campaign terpilih.')
      return response.redirect().back()
    }

    await Campaign.query().where('user_id', userId).whereIn('id', ids).delete()
    session.flash('success', `${ids.length} campaign dihapus.`)
    return response.redirect().back()
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }

  private relationBuckets(statuses: string[]) {
    const completedStatuses = new Set(['success', 'completed', 'done'])
    const failedStatuses = new Set(['failed', 'error'])
    const bucket = {
      total: statuses.length,
      success: 0,
      failed: 0,
      skipped: 0,
      pending: 0,
      running: 0,
      processed: 0,
    }

    for (const rawStatus of statuses) {
      const status = rawStatus.toLowerCase()
      if (completedStatuses.has(status)) bucket.success++
      else if (failedStatuses.has(status)) bucket.failed++
      else if (status === 'skipped') bucket.skipped++
      else if (status === 'running') bucket.running++
      else bucket.pending++
    }

    bucket.processed = bucket.success + bucket.failed + bucket.skipped
    return bucket
  }

  private progressStageLabel(status: string) {
    return (
      {
        draft: 'Siap dijalankan',
        running: 'Sedang mengeksekusi',
        paused: 'Dijeda',
        completed: 'Selesai',
        failed: 'Gagal',
      }[status] ?? status
    )
  }

  private progressActionLabel(action?: string | null) {
    if (!action) return null

    return (
      {
        campaign_start: 'Campaign mulai',
        campaign_end: 'Campaign selesai',
        campaign_error: 'Campaign error',
        session_prepare: 'Menyiapkan session',
        session_verify: 'Verifikasi session',
        session_launch: 'Menjalankan browser',
        account_error: 'Error akun',
        scrape: 'Scrape group',
        scrape_profile: 'Scrape profile',
        scrape_profile_metadata: 'Perdalam metadata profile',
        scrape_metadata: 'Perdalam metadata',
        scrape_fallback: 'Fallback akun',
        auto_add_friend: 'Auto add friend',
        auto_like: 'Auto like',
        auto_comment: 'Auto comment',
        auto_invite: 'Auto invite',
        auto_confirm: 'Auto confirm',
        auto_join: 'Auto join',
        auto_share: 'Auto share',
        auto_post: 'Auto post',
        auto_unfriend: 'Auto unfriend',
        auto_inbox: 'Auto inbox',
        auto_delete: 'Auto delete',
      }[action] ?? action.replaceAll('_', ' ')
    )
  }

  private targetTypeLabel(targetType?: string | null) {
    return (
      {
        hasil_scrape: 'hasil scrape',
        account: 'akun',
        profile: 'profile',
        group: 'group',
      }[targetType ?? ''] ?? 'target'
    )
  }

  private async getCampaignProgress(
    campaignOrId: Campaign | string
  ): Promise<CampaignLiveProgress> {
    const campaignId = typeof campaignOrId === 'string' ? campaignOrId : campaignOrId.id
    const campaign = await Campaign.query()
      .where('id', campaignId)
      .preload('accounts')
      .preload('groups')
      .preload('profiles')
      .firstOrFail()

    const accountBucket = this.relationBuckets((campaign.accounts ?? []).map((row) => row.status))
    const groupBucket = this.relationBuckets((campaign.groups ?? []).map((row) => row.status))
    const profileBucket = this.relationBuckets((campaign.profiles ?? []).map((row) => row.status))
    const latestLog = await SessionLog.query()
      .where('campaign_id', campaign.id)
      .orderBy('created_at', 'desc')
      .first()
    const runtimeState = await CampaignRuntimeState.query()
      .where('campaign_id', campaign.id)
      .orderBy('updated_at', 'desc')
      .first()

    if (runtimeState) {
      const runtimeMeta = (runtimeState.meta ?? {}) as Record<string, unknown>
      const runtimeTotal = runtimeState.totalTargets
      const runtimeProcessed = runtimeState.processedTargets ?? 0
      const actionLabel = this.progressActionLabel(runtimeState.currentAction)
      const runtimePercent =
        runtimeState.status === 'completed'
          ? 100
          : runtimeTotal && runtimeTotal > 0
            ? Math.max(0, Math.min(100, Math.round((runtimeProcessed / runtimeTotal) * 1000) / 10))
            : null
      const updatedAt = runtimeState.lastTickAt?.toISO() ?? runtimeState.updatedAt?.toISO() ?? null
      const elapsedSeconds = runtimeState.startedAt
        ? Math.max(
            0,
            Math.round(
              (runtimeState.lastTickAt ?? runtimeState.updatedAt ?? DateTime.now()).diff(
                runtimeState.startedAt,
                'seconds'
              ).seconds
            )
          )
        : null
      const throughputPerMinute =
        elapsedSeconds && elapsedSeconds > 0 && runtimeProcessed > 0
          ? Math.round((runtimeProcessed / elapsedSeconds) * 60 * 10) / 10
          : null

      return {
        stage: runtimeState.status,
        stageLabel: this.progressStageLabel(runtimeState.status),
        actionLabel,
        targetLabel: this.targetTypeLabel(runtimeState.targetType),
        processed: runtimeProcessed,
        total: runtimeTotal,
        success: runtimeState.successCount ?? 0,
        failed: runtimeState.failedCount ?? 0,
        skipped: runtimeState.skippedCount ?? 0,
        pending: runtimeState.pendingCount ?? 0,
        running: runtimeState.runningCount ?? 0,
        discovered: runtimeState.discoveredCount ?? 0,
        persisted: runtimeState.persistedCount ?? 0,
        percent: runtimePercent,
        indeterminate:
          runtimeState.status !== 'completed' &&
          (runtimeTotal === null ||
            runtimeTotal <= 0 ||
            (runtimeState.status === 'running' && runtimePercent === null)),
        currentBatch: runtimeState.currentBatch,
        totalBatches: runtimeState.totalBatches,
        completedBatches:
          typeof runtimeMeta.completedBatches === 'number' ? runtimeMeta.completedBatches : 0,
        activeBatches:
          typeof runtimeMeta.activeBatches === 'number' ? runtimeMeta.activeBatches : 0,
        batchLabel: typeof runtimeMeta.batchLabel === 'string' ? runtimeMeta.batchLabel : null,
        etaSeconds: runtimeState.etaSeconds,
        elapsedSeconds,
        throughputPerMinute,
        currentAccountLabel:
          typeof runtimeMeta.currentAccountLabel === 'string'
            ? runtimeMeta.currentAccountLabel
            : null,
        currentGroupName:
          typeof runtimeMeta.currentGroupName === 'string' ? runtimeMeta.currentGroupName : null,
        currentTargetCode:
          typeof runtimeMeta.currentGroupCode === 'string' ? runtimeMeta.currentGroupCode : null,
        currentLabel:
          runtimeState.currentLabel ??
          (latestLog?.message?.trim() ||
            this.progressActionLabel(latestLog?.action) ||
            this.progressStageLabel(campaign.status)),
        skippedByType:
          typeof runtimeMeta.skippedByType === 'number' ? runtimeMeta.skippedByType : 0,
        skippedByMemberCount:
          typeof runtimeMeta.skippedByMemberCount === 'number'
            ? runtimeMeta.skippedByMemberCount
            : 0,
        skippedByMissingName:
          typeof runtimeMeta.skippedByMissingName === 'number'
            ? runtimeMeta.skippedByMissingName
            : 0,
        skippedDuplicates:
          typeof runtimeMeta.skippedDuplicates === 'number' ? runtimeMeta.skippedDuplicates : 0,
        updatedAt,
      }
    }

    const baseBucket =
      groupBucket.total > 0
        ? groupBucket
        : profileBucket.total > 0
          ? profileBucket
          : accountBucket.total > 0
            ? accountBucket
            : null
    const total = baseBucket?.total ?? null
    const processed = baseBucket?.processed ?? 0
    const percent =
      campaign.status === 'completed'
        ? 100
        : total && total > 0
          ? Math.max(0, Math.min(100, Math.round((processed / total) * 1000) / 10))
          : null

    const latestMessage = latestLog?.message?.trim() || null
    const actionLabel = this.progressActionLabel(latestLog?.action)
    const currentLabel =
      latestMessage && actionLabel
        ? `${actionLabel}: ${latestMessage}`
        : (latestMessage ?? actionLabel ?? this.progressStageLabel(campaign.status))

    return {
      stage: campaign.status,
      stageLabel: this.progressStageLabel(campaign.status),
      actionLabel,
      targetLabel:
        groupBucket.total > 0
          ? 'group'
          : profileBucket.total > 0
            ? 'profile'
            : accountBucket.total > 0
              ? 'akun'
              : campaign.type === 'scrape_group' || campaign.type === 'scrape_profile'
                ? 'hasil scrape'
                : 'target',
      processed,
      total,
      success: baseBucket?.success ?? 0,
      failed: baseBucket?.failed ?? 0,
      skipped: baseBucket?.skipped ?? 0,
      pending: baseBucket?.pending ?? 0,
      running: baseBucket?.running ?? 0,
      discovered: 0,
      persisted: 0,
      percent,
      indeterminate:
        campaign.status !== 'completed' &&
        (total === null ||
          total <= 0 ||
          (campaign.status === 'running' && latestLog !== null && percent === null)),
      currentBatch: null,
      totalBatches: null,
      completedBatches: 0,
      activeBatches: 0,
      batchLabel: null,
      etaSeconds: null,
      elapsedSeconds:
        campaign.startedAt && latestLog?.createdAt
          ? Math.max(0, Math.round(latestLog.createdAt.diff(campaign.startedAt, 'seconds').seconds))
          : null,
      throughputPerMinute: null,
      currentAccountLabel: null,
      currentGroupName: null,
      currentTargetCode: null,
      currentLabel,
      skippedByType: 0,
      skippedByMemberCount: 0,
      skippedByMissingName: 0,
      skippedDuplicates: 0,
      updatedAt: latestLog?.createdAt?.toISO() ?? null,
    }
  }

  private async getWorkerStatus(type: string): Promise<QueueWorkerStatus> {
    const checkedAt = DateTime.now().toISO()!

    try {
      const { connectAmqp, assertTopology } = await import('#services/queue/amqp')
      const { QUEUES } = await import('#services/queue/topology')

      if (!(type in QUEUES)) {
        return {
          state: 'unknown',
          queue: null,
          routingKey: null,
          consumers: 0,
          messages: 0,
          checkedAt,
          note: `Queue untuk tipe campaign "${type}" belum terdaftar.`,
        }
      }

      const { queue, routingKey } = QUEUES[type as keyof typeof QUEUES]
      const connection = await connectAmqp()

      try {
        const channel = await connection.createChannel()

        try {
          await assertTopology(channel)
          const status = await channel.checkQueue(queue)

          return {
            state: status.consumerCount > 0 ? 'online' : 'offline',
            queue,
            routingKey,
            consumers: status.consumerCount,
            messages: status.messageCount,
            checkedAt,
            note:
              status.consumerCount > 0
                ? 'Worker queue aktif dan siap mengkonsumsi job.'
                : 'Belum ada worker yang terhubung ke queue campaign ini.',
          }
        } finally {
          await channel.close()
        }
      } finally {
        await connection.close()
      }
    } catch (error) {
      return {
        state: 'error',
        queue: null,
        routingKey: null,
        consumers: 0,
        messages: 0,
        checkedAt,
        note: `Gagal membaca status worker: ${(error as Error).message}`,
      }
    }
  }
}
