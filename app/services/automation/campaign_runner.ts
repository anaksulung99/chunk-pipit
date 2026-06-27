import Campaign from '#models/campaign'
import CampaignGroup from '#models/campaign_group'
import CampaignProfile from '#models/campaign_profile'
import FacebookGroup from '#models/facebook_group'
import FacebookProfile from '#models/facebook_profile'
import Proxy from '#models/proxy'
import CampaignRuntimeState from '#models/campaign_runtime_state'
import SessionLog from '#models/session_log'
import type CampaignAccount from '#models/campaign_account'
import { PersonalNotificationService } from '#services/notifier/personal_notification_service'
import { loadPlaywrightCookies } from '#services/automation/cookie_loader'
import { mergeGroupTags, normalizeGroupTags } from '#services/group/tags'
import {
  launchSession,
  verifySession,
  closeSession,
  type ProxyConfig,
  type Session,
} from '#services/automation/browser_session'
import {
  extractGroupMetadataFromPage,
  extractProfileMetadataFromPage,
  runAutoAddFriend,
  runAutoComment,
  runAutoConfirm,
  runAutoDelete,
  runAutoInbox,
  runAutoInvite,
  runAutoLike,
  runAutoPost,
  runAutoUnfriend,
  runAutoShare,
  runAutoJoin,
  runScrapeProfile,
  runScrapeGroup,
  type ScrapedGroup,
  type ScrapedProfile,
} from '#services/automation/handlers'
import { humanDelay } from '#services/automation/human'
import { DateTime } from 'luxon'
import type { Page } from 'playwright'

const WORKER_ID = 'engine'

async function log(
  campaignId: string,
  action: string,
  status: 'success' | 'failed' | 'skipped' | 'checkpoint',
  message: string,
  accountId?: string | null,
  groupId?: string | null
) {
  await SessionLog.create({
    campaignId,
    action,
    status,
    message,
    accountId: accountId ?? null,
    groupId: groupId ?? null,
    workerId: WORKER_ID,
  })
}

/** Pick a proxy for the run — prefer a healthy one from the owner's pool. */
async function resolveProxy(userId: string): Promise<ProxyConfig | null> {
  const proxy =
    (await Proxy.query().where('user_id', userId).where('status', 'healthy').first()) ??
    (await Proxy.query().where('user_id', userId).first())
  if (!proxy) return null
  return {
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    username: proxy.username,
    password: proxy.password,
  }
}

/** Bounded-concurrency runner — processes items with at most `limit` in flight. */
async function runPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items]
  const size = Math.max(1, Math.min(limit, queue.length || 1))
  const workers = Array.from({ length: size }, async () => {
    while (queue.length) {
      const item = queue.shift()
      if (item === undefined) break
      await fn(item)
    }
  })
  await Promise.all(workers)
}

/** Round-robin distribute items into `buckets` arrays. */
function distribute<T>(items: T[], buckets: number): T[][] {
  const out: T[][] = Array.from({ length: Math.max(1, buckets) }, () => [])
  items.forEach((item, i) => out[i % out.length].push(item))
  return out
}

function passesMinGroupMember(memberCount: number | null, minGroupMember: number | null) {
  if (minGroupMember === null || minGroupMember <= 0) return true
  return memberCount !== null && memberCount >= minGroupMember
}

function passesTargetGroupType(
  groupType: 'public' | 'private' | null,
  targetGroupType: string | null
) {
  if (!targetGroupType || targetGroupType === 'both') return true
  return groupType !== null && groupType === targetGroupType
}

function shouldRefreshScrapedGroupMetadata(
  group: ScrapedGroup,
  options: {
    minGroupMember: number | null
    targetGroupType: string | null
  }
) {
  if (!group.groupName || /^foto profil\b/i.test(group.groupName)) return true
  if (group.memberCount === null) return true
  if (group.groupType === null) return true
  if (options.minGroupMember !== null && options.minGroupMember > 0) return true
  if (options.targetGroupType && options.targetGroupType !== 'both') return true
  return false
}

function passesMinFriendCount(friendCount: number | null, minFriendCount: number | null) {
  if (minFriendCount === null || minFriendCount <= 0) return true
  return friendCount !== null && friendCount >= minFriendCount
}

function shouldRefreshScrapedProfileMetadata(
  profile: ScrapedProfile,
  options: {
    minFriendCount: number | null
  }
) {
  if (!profile.profileName || /^foto profil\b/i.test(profile.profileName)) return true
  if (profile.friendCount === null && options.minFriendCount !== null && options.minFriendCount > 0) {
    return true
  }
  if (profile.followerCount === null && profile.followingCount === null && profile.mutualFriendCount === null) {
    return true
  }
  return false
}

function normalizeProfileNameText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || ''
}

function isWeakProfileNameCandidate(value: string | null | undefined) {
  const normalized = normalizeProfileNameText(value).toLowerCase()
  if (!normalized) return true

  const blocked = [
    'chat',
    'chats',
    'obrolan',
    'messenger',
    'kotak masuk',
    'inbox',
    'message',
    'pesan',
    'friends',
    'friend',
    'teman',
    'follow',
    'ikuti',
    'watch',
    'saved',
    'tersimpan',
  ]

  if (blocked.some((item) => normalized === item || normalized.includes(item))) return true
  if (/(buat pin|access your chats|obrolan anda|perangkat mana pun|device|chat pin)/i.test(normalized))
    return true
  return false
}

function preferProfileName(
  currentValue: string | null | undefined,
  nextValue: string | null | undefined
) {
  const current = normalizeProfileNameText(currentValue)
  const next = normalizeProfileNameText(nextValue)

  if (!current) return next || null
  if (!next) return current
  if (isWeakProfileNameCandidate(next)) return current
  if (isWeakProfileNameCandidate(current)) return next
  if (next.split(' ').length === 1 && current.split(' ').length >= 2) return current
  if (current.includes('(') && !next.includes('(') && next.split(' ').length <= current.split(' ').length) {
    return current
  }

  return next
}

function randomizedCampaignDelay(maxDelayMs: number | null | undefined) {
  const ceiling = Math.max(0, Number(maxDelayMs ?? 0))
  if (ceiling <= 0) return 0
  const floor = Math.min(ceiling, Math.max(900, Math.round(ceiling * 0.45)))
  return Math.round(floor + Math.random() * Math.max(0, ceiling - floor))
}

function shouldSkipAutoInboxDuplicate(
  profile: {
    lastAction?: string | null
    lastActionStatus?: string | null
    lastActionAt?: DateTime | null
  },
  cooldownHours = 24
) {
  if (profile.lastAction !== 'auto_inbox' || profile.lastActionStatus !== 'success') return false
  if (!profile.lastActionAt) return false
  const diffHours = DateTime.now().diff(profile.lastActionAt, 'hours').hours
  return diffHours >= 0 && diffHours < cooldownHours
}

type AccountRunResult =
  | { status: 'done'; accountId: string; accountLabel: string }
  | {
      status: 'error' | 'checkpoint' | 'missing_account'
      accountId?: string
      accountLabel?: string
      reason: string
    }

type RuntimeMeta = {
  batchLabel?: string | null
  currentAccountLabel?: string | null
  currentGroupName?: string | null
  currentGroupCode?: string | null
  completedBatches?: number
  activeBatches?: number
  skippedByType?: number
  skippedByMemberCount?: number
  skippedByMissingName?: number
  skippedDuplicates?: number
}

type RuntimeSnapshot = {
  runId: string
  status: string
  stage: string | null
  targetType: string | null
  totalTargets: number | null
  processedTargets: number
  successCount: number
  failedCount: number
  skippedCount: number
  pendingCount: number
  runningCount: number
  discoveredCount: number
  persistedCount: number
  currentBatch: number | null
  totalBatches: number | null
  currentAccountId: string | null
  currentGroupId: string | null
  currentProfileId: string | null
  currentAction: string | null
  currentLabel: string | null
  etaSeconds: number | null
  meta: RuntimeMeta | null
  startedAt: DateTime
  lastTickAt: DateTime
}

function computeEtaSeconds(
  startedAt: DateTime,
  processedTargets: number,
  totalTargets: number | null,
  status: string
) {
  if (status === 'completed') return 0
  if (
    !totalTargets ||
    totalTargets <= 0 ||
    processedTargets <= 0 ||
    processedTargets >= totalTargets
  ) {
    return null
  }

  const elapsedSeconds = Math.max(1, Math.round(DateTime.now().diff(startedAt, 'seconds').seconds))
  const avgSecondsPerTarget = elapsedSeconds / processedTargets
  const remainingTargets = Math.max(0, totalTargets - processedTargets)
  return Math.max(1, Math.round(avgSecondsPerTarget * remainingTargets))
}

async function persistRuntimeState(campaignId: string, snapshot: RuntimeSnapshot) {
  snapshot.lastTickAt = DateTime.now()
  snapshot.pendingCount =
    snapshot.totalTargets === null
      ? Math.max(0, snapshot.pendingCount)
      : Math.max(
          0,
          snapshot.totalTargets -
            snapshot.processedTargets -
            Math.min(snapshot.runningCount, snapshot.totalTargets)
        )
  snapshot.etaSeconds = computeEtaSeconds(
    snapshot.startedAt,
    snapshot.processedTargets,
    snapshot.totalTargets,
    snapshot.status
  )

  const state = await CampaignRuntimeState.firstOrCreate(
    { campaignId },
    {
      campaignId,
      runId: snapshot.runId,
      status: snapshot.status,
      stage: snapshot.stage,
      targetType: snapshot.targetType,
      totalTargets: snapshot.totalTargets,
      processedTargets: snapshot.processedTargets,
      successCount: snapshot.successCount,
      failedCount: snapshot.failedCount,
      skippedCount: snapshot.skippedCount,
      pendingCount: snapshot.pendingCount,
      runningCount: snapshot.runningCount,
      discoveredCount: snapshot.discoveredCount,
      persistedCount: snapshot.persistedCount,
      currentBatch: snapshot.currentBatch,
      totalBatches: snapshot.totalBatches,
      currentAccountId: snapshot.currentAccountId,
      currentGroupId: snapshot.currentGroupId,
      currentProfileId: snapshot.currentProfileId,
      currentAction: snapshot.currentAction,
      currentLabel: snapshot.currentLabel,
      etaSeconds: snapshot.etaSeconds,
      meta: snapshot.meta,
      startedAt: snapshot.startedAt,
      lastTickAt: snapshot.lastTickAt,
    }
  )

  state.merge({
    runId: snapshot.runId,
    status: snapshot.status,
    stage: snapshot.stage,
    targetType: snapshot.targetType,
    totalTargets: snapshot.totalTargets,
    processedTargets: snapshot.processedTargets,
    successCount: snapshot.successCount,
    failedCount: snapshot.failedCount,
    skippedCount: snapshot.skippedCount,
    pendingCount: snapshot.pendingCount,
    runningCount: snapshot.runningCount,
    discoveredCount: snapshot.discoveredCount,
    persistedCount: snapshot.persistedCount,
    currentBatch: snapshot.currentBatch,
    totalBatches: snapshot.totalBatches,
    currentAccountId: snapshot.currentAccountId,
    currentGroupId: snapshot.currentGroupId,
    currentProfileId: snapshot.currentProfileId,
    currentAction: snapshot.currentAction,
    currentLabel: snapshot.currentLabel,
    etaSeconds: snapshot.etaSeconds,
    meta: snapshot.meta,
    startedAt: snapshot.startedAt,
    lastTickAt: snapshot.lastTickAt,
  })
  await state.save()
}

async function updateProfileLifecycle(
  profileId: string | null | undefined,
  patch: {
    lifecycleStatus?: string
    relationshipStatus?: string
    lastAction: string
    lastActionStatus: 'success' | 'failed' | 'skipped' | 'checkpoint'
    lastActionMessage: string
  }
) {
  if (!profileId) return
  const profile = await FacebookProfile.find(profileId)
  if (!profile) return

  profile.merge({
    ...(patch.lifecycleStatus ? { lifecycleStatus: patch.lifecycleStatus } : {}),
    ...(patch.relationshipStatus ? { relationshipStatus: patch.relationshipStatus } : {}),
    lastAction: patch.lastAction,
    lastActionStatus: patch.lastActionStatus,
    lastActionMessage: patch.lastActionMessage,
    lastActionAt: DateTime.now(),
  })
  await profile.save()
}

/** Count today's successful joins for an account (enforces daily-join-limit). */
async function countTodayJoins(accountId: string): Promise<number> {
  const start = DateTime.now().startOf('day').toSQL()!
  const rows = await SessionLog.query()
    .where('account_id', accountId)
    .where('action', 'auto_join')
    .where('status', 'success')
    .where('created_at', '>=', start)
    .count('* as total')
  return Number((rows[0] as any).$extras.total ?? 0)
}

/**
 * Run one campaign end-to-end. Resilient: per-account failures are logged and
 * skipped rather than aborting the whole run. Set AUTOMATION_DRY_RUN=true to
 * exercise the data pipeline (cookie decrypt, orchestration, logging) without
 * launching a browser or touching Facebook.
 */
export async function runCampaign(campaignId: string): Promise<void> {
  const campaign = await Campaign.query()
    .where('id', campaignId)
    .preload('fingerprint')
    .preload('accounts', (q) => q.preload('account'))
    .preload('groups', (q) => q.preload('group'))
    .preload('profiles', (q) => q.preload('profile'))
    .first()

  if (!campaign) return

  const notifier = await PersonalNotificationService.forUser(campaign.userId)
  const notify = async (
    action:
      | 'campaign_start'
      | 'campaign_end'
      | 'campaign_error'
      | 'account_error'
      | 'session_launch'
      | 'session_verify'
      | 'scrape',
    status: 'success' | 'failed' | 'skipped' | 'checkpoint',
    message: string,
    meta?: {
      accountId?: string | null
      accountLabel?: string | null
      groupId?: string | null
      groupName?: string | null
      campaignStatus?: string | null
    }
  ) => {
    await notifier.notifyCampaignEvent({
      action,
      status,
      message,
      campaignId: campaign.id,
      campaignName: campaign.name,
      campaignType: campaign.type,
      campaignStatus: meta?.campaignStatus ?? campaign.status,
      accountId: meta?.accountId ?? null,
      accountLabel: meta?.accountLabel ?? null,
      groupId: meta?.groupId ?? null,
      groupName: meta?.groupName ?? null,
    })
  }

  await log(campaign.id, 'campaign_start', 'success', `Mulai ${campaign.type}.`)
  await notify('campaign_start', 'success', `Mulai ${campaign.type}.`, {
    campaignStatus: campaign.status,
  })

  const dryRun = process.env.AUTOMATION_DRY_RUN === 'true'
  const proxy = campaign.useProxy ? await resolveProxy(campaign.userId) : null
  const rawFingerprint = campaign.fingerprint?.rawFingerprint ?? null
  const accounts = [...campaign.accounts]
    .sort((left, right) => left.createdAt.toMillis() - right.createdAt.toMillis())
    .slice(0, Math.max(1, campaign.maxAccounts))
  const runtimeStartedAt = campaign.startedAt ?? DateTime.now()
  const runtime: RuntimeSnapshot = {
    runId: `${campaign.id}:${runtimeStartedAt.toMillis()}`,
    status: campaign.status,
    stage: campaign.type,
    targetType:
      campaign.type === 'scrape_group' || campaign.type === 'scrape_profile' ? 'hasil_scrape' : 'group',
    totalTargets:
      campaign.type === 'scrape_group' || campaign.type === 'scrape_profile' ? null : campaign.groups.length,
    processedTargets: 0,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    pendingCount:
      campaign.type === 'scrape_group' || campaign.type === 'scrape_profile' ? 0 : campaign.groups.length,
    runningCount: 0,
    discoveredCount: 0,
    persistedCount: 0,
    currentBatch: null,
    totalBatches: accounts.length || null,
    currentAccountId: null,
    currentGroupId: null,
    currentProfileId: null,
    currentAction: campaign.type,
    currentLabel: `Menyiapkan ${campaign.type}.`,
    etaSeconds: null,
    meta: null,
    startedAt: runtimeStartedAt,
    lastTickAt: runtimeStartedAt,
  }

  const updateRuntime = async (
    patch: Partial<RuntimeSnapshot>,
    metaPatch?: Partial<RuntimeMeta> | null
  ) => {
    Object.assign(runtime, patch)
    runtime.meta = metaPatch === null ? null : { ...(runtime.meta ?? {}), ...(metaPatch ?? {}) }
    await persistRuntimeState(campaign.id, runtime)
  }

  await updateRuntime({
    status: 'running',
    currentAction: 'campaign_start',
    currentLabel: `Mulai ${campaign.type}.`,
  })

  let hadError = false

  const withAccount = async (
    campaignAccount: CampaignAccount,
    work: (page: Page) => Promise<void>,
    options?: { markHadErrorOnFailure?: boolean }
  ): Promise<AccountRunResult> => {
    const markHadErrorOnFailure = options?.markHadErrorOnFailure ?? true
    const account = campaignAccount.account
    if (!account) {
      return {
        status: 'missing_account',
        reason: 'Relasi account campaign tidak ditemukan.',
      }
    }
    campaignAccount.status = 'running'
    await campaignAccount.save()
    await updateRuntime(
      {
        currentAccountId: campaignAccount.accountId,
        currentAction: 'session_prepare',
        currentLabel: `Menyiapkan session untuk "${account.label}".`,
      },
      {
        currentAccountLabel: account.label,
      }
    )

    const cookies = await loadPlaywrightCookies(account.id)
    await log(
      campaign.id,
      'session_prepare',
      'success',
      `${cookies.length} cookie didekripsi untuk "${account.label}"${proxy ? ' (via proxy)' : ''}.`,
      account.id
    )

    if (dryRun) {
      await log(
        campaign.id,
        'dry_run',
        'success',
        'Dry-run: browser & Facebook dilewati.',
        account.id
      )
      campaignAccount.status = 'done'
      await campaignAccount.save()
      return {
        status: 'done',
        accountId: account.id,
        accountLabel: account.label,
      }
    }

    let session: Session
    try {
      session = await launchSession({
        cookies,
        rawFingerprint,
        proxy,
        headless: campaign.headless ?? true,
        osType: campaign.fingerprint?.osType as 'windows' | 'linux' | 'macos',
        browserType: campaign.fingerprint?.browserType as 'chrome' | 'firefox' | 'safari' | 'edge',
        advanceMode: campaign.advanceMode ?? false,
        locale: campaign.fingerprint?.locale ?? 'en-US',
        timezone: campaign.fingerprint?.timezone ?? 'Asia/Jakarta',
      })
    } catch (error) {
      await log(
        campaign.id,
        'session_launch',
        'failed',
        `Gagal launch browser: ${(error as Error).message}`,
        account.id
      )
      await notify(
        'session_launch',
        'failed',
        `Gagal launch browser: ${(error as Error).message}`,
        {
          accountId: account.id,
          accountLabel: account.label,
        }
      )
      campaignAccount.status = 'error'
      await campaignAccount.save()
      if (markHadErrorOnFailure) hadError = true
      return {
        status: 'error',
        accountId: account.id,
        accountLabel: account.label,
        reason: `Gagal launch browser: ${(error as Error).message}`,
      }
    }

    try {
      const state = await verifySession(session.page)
      if (state !== 'active') {
        account.sessionStatus = state === 'checkpoint' ? 'checkpoint' : 'logged_out'
        await account.save()
        await log(
          campaign.id,
          'session_verify',
          'checkpoint',
          `Akun "${account.label}" tidak aktif: ${state}.`,
          account.id
        )
        await notify(
          'session_verify',
          'checkpoint',
          `Akun "${account.label}" tidak aktif: ${state}.`,
          {
            accountId: account.id,
            accountLabel: account.label,
          }
        )
        campaignAccount.status = 'error'
        await campaignAccount.save()
        return {
          status: 'checkpoint',
          accountId: account.id,
          accountLabel: account.label,
          reason: `Akun "${account.label}" tidak aktif: ${state}.`,
        }
      }
      await work(session.page)
      campaignAccount.status = 'done'
      await campaignAccount.save()
      return {
        status: 'done',
        accountId: account.id,
        accountLabel: account.label,
      }
    } catch (error) {
      if (markHadErrorOnFailure) hadError = true
      await log(campaign.id, 'account_error', 'failed', (error as Error).message, account.id)
      await notify('account_error', 'failed', (error as Error).message, {
        accountId: account.id,
        accountLabel: account.label,
      })
      campaignAccount.status = 'error'
      await campaignAccount.save()
      return {
        status: 'error',
        accountId: account.id,
        accountLabel: account.label,
        reason: (error as Error).message,
      }
    } finally {
      await closeSession(session)
    }
  }

  try {
    if (campaign.type === 'scrape_group') {
      if (!accounts.length) throw new Error('Campaign scrape membutuhkan minimal 1 akun.')

      let scrapeSucceeded = false
      const failedAccounts: string[] = []
      let scrapeBatch = 0

      for (const candidate of accounts) {
        scrapeBatch++
        await updateRuntime(
          {
            currentBatch: scrapeBatch,
            totalBatches: accounts.length,
            currentAccountId: candidate.account?.id ?? null,
            currentAction: 'scrape',
            currentLabel: `Batch scrape ${scrapeBatch}/${accounts.length}: ${candidate.account?.label ?? 'Akun'}.`,
            runningCount: 1,
          },
          {
            batchLabel: `Batch scrape ${scrapeBatch}/${accounts.length}`,
            currentAccountLabel: candidate.account?.label ?? null,
            completedBatches: scrapeBatch - 1,
            activeBatches: 1,
          }
        )
        const attempt = await withAccount(
          candidate,
          async (page) => {
            const found = await runScrapeGroup(page, campaign.config as any)
            const assignedGroupTags = normalizeGroupTags(
              Array.isArray((campaign.config as any)?.groupTags)
                ? (campaign.config as any).groupTags
                : []
            )
            const enrichedGroups: ScrapedGroup[] = []
            await updateRuntime(
              {
                targetType: 'hasil_scrape',
                totalTargets: found.length,
                discoveredCount: found.length,
                processedTargets: 0,
                successCount: 0,
                skippedCount: 0,
                persistedCount: 0,
                currentAction: 'scrape',
                currentLabel: `${found.length} group ditemukan, memproses metadata...`,
              },
              {
                batchLabel: `Batch scrape ${scrapeBatch}/${accounts.length}`,
              }
            )

            for (const [index, group] of found.entries()) {
              let resolvedGroup = group

              if (
                shouldRefreshScrapedGroupMetadata(group, {
                  minGroupMember: campaign.minGroupMember,
                  targetGroupType: campaign.targetGroupType,
                })
              ) {
                try {
                  const metadata = await extractGroupMetadataFromPage(page, group)
                  resolvedGroup = {
                    ...group,
                    groupId: metadata.groupId,
                    groupUrl: metadata.groupUrl,
                    groupName: metadata.groupName ?? group.groupName,
                    memberCount: metadata.memberCount ?? group.memberCount,
                    groupType: metadata.groupType ?? group.groupType,
                  }
                } catch (error) {
                  await log(
                    campaign.id,
                    'scrape_metadata',
                    'skipped',
                    `Metadata group ${group.groupId} gagal diperdalam: ${(error as Error).message}`,
                    candidate.account!.id
                  )
                }

                await humanDelay(800)
              }

              enrichedGroups.push(resolvedGroup)

              if ((index + 1) % 5 === 0 || index === found.length - 1) {
                await updateRuntime(
                  {
                    processedTargets: index + 1,
                    currentAction: 'scrape_metadata',
                    currentLabel: `Memproses metadata ${index + 1}/${found.length} group.`,
                  },
                  {
                    currentGroupCode: group.groupId,
                  }
                )
              }
            }

            const filteredByType = enrichedGroups.filter((group) =>
              passesTargetGroupType(group.groupType, campaign.targetGroupType)
            )
            const filteredByMemberCount = filteredByType.filter((group) =>
              passesMinGroupMember(group.memberCount, campaign.minGroupMember)
            )
            const finalGroups = filteredByMemberCount.filter((group) => group.groupName !== null)
            const skippedByType = enrichedGroups.length - filteredByType.length
            const skippedByMemberCount = filteredByType.length - filteredByMemberCount.length
            const skippedByMissingName = filteredByMemberCount.length - finalGroups.length
            const totalSkipped = skippedByType + skippedByMemberCount + skippedByMissingName

            await updateRuntime(
              {
                skippedCount: totalSkipped,
                processedTargets: enrichedGroups.length,
                currentAction: 'scrape',
                currentLabel: `Menyimpan ${finalGroups.length} group valid dari ${enrichedGroups.length} hasil scrape.`,
              },
              {
                skippedByType,
                skippedByMemberCount,
                skippedByMissingName,
              }
            )

            let persistedCount = 0
            for (const [index, g] of finalGroups.entries()) {
              const persistedGroup = await FacebookGroup.firstOrCreate(
                { userId: campaign.userId, groupId: g.groupId },
                {
                  userId: campaign.userId,
                  groupId: g.groupId,
                  groupUrl: g.groupUrl,
                  groupType: g.groupType ?? 'public',
                  ...(g.groupName !== null ? { groupName: g.groupName } : {}),
                  ...(g.memberCount !== null ? { memberCount: g.memberCount } : {}),
                  sourceType:
                    (campaign.config as any)?.sourceType === 'friend_joined_group'
                      ? 'friend_list'
                      : 'keyword',
                  sourceKeyword: (campaign.config as any)?.keyword ?? null,
                  sourceFriendUrl: (campaign.config as any)?.friendProfileUrl ?? null,
                  ...(assignedGroupTags.length ? { tags: assignedGroupTags } : {}),
                }
              )

              persistedGroup.merge({
                groupUrl: g.groupUrl,
                ...(g.groupType !== null ? { groupType: g.groupType } : {}),
                ...(g.groupName !== null ? { groupName: g.groupName } : {}),
                ...(g.memberCount !== null ? { memberCount: g.memberCount } : {}),
                sourceType:
                  (campaign.config as any)?.sourceType === 'friend_joined_group'
                    ? 'friend_list'
                    : 'keyword',
                sourceKeyword: (campaign.config as any)?.keyword ?? null,
                sourceFriendUrl: (campaign.config as any)?.friendProfileUrl ?? null,
                ...(assignedGroupTags.length
                  ? {
                      tags: mergeGroupTags(
                        Array.isArray(persistedGroup.tags) ? (persistedGroup.tags as string[]) : [],
                        assignedGroupTags
                      ),
                    }
                  : {}),
              })
              await persistedGroup.save()
              persistedCount++

              if ((index + 1) % 5 === 0 || index === finalGroups.length - 1) {
                await updateRuntime(
                  {
                    successCount: persistedCount,
                    persistedCount,
                    currentAction: 'scrape',
                    currentLabel: `Menyimpan group valid ${persistedCount}/${finalGroups.length}.`,
                  },
                  {
                    currentGroupName: g.groupName ?? g.groupId,
                    currentGroupCode: g.groupId,
                  }
                )
              }
            }
            await updateRuntime(
              {
                processedTargets: enrichedGroups.length,
                successCount: finalGroups.length,
                skippedCount: totalSkipped,
                persistedCount: finalGroups.length,
                runningCount: 0,
                currentAction: 'scrape',
                currentLabel: `${finalGroups.length} group disimpan dari ${enrichedGroups.length} hasil scrape.`,
              },
              {
                completedBatches: scrapeBatch,
                activeBatches: 0,
              }
            )
            await log(
              campaign.id,
              'scrape',
              'success',
              `${finalGroups.length} group disimpan. ${skippedByType} dilewati karena tipe group, ${skippedByMemberCount} dilewati karena minimum member, ${skippedByMissingName} dilewati karena nama group kosong.`,
              candidate.account!.id
            )
            await notify(
              'scrape',
              'success',
              `${finalGroups.length} group disimpan. ${skippedByType} dilewati karena tipe group, ${skippedByMemberCount} dilewati karena minimum member, ${skippedByMissingName} dilewati karena nama group kosong.`,
              {
                accountId: candidate.account!.id,
                accountLabel: candidate.account!.label,
              }
            )
          },
          { markHadErrorOnFailure: false }
        )

        if (attempt.status === 'done') {
          scrapeSucceeded = true
          break
        }

        failedAccounts.push(attempt.accountLabel ?? candidate.account?.label ?? 'unknown')
        await updateRuntime(
          {
            failedCount: failedAccounts.length,
            runningCount: 0,
            currentAction: 'scrape_fallback',
            currentLabel: `${attempt.reason} Mencoba akun berikutnya.`,
          },
          {
            completedBatches: scrapeBatch,
            activeBatches: 0,
          }
        )
        await log(
          campaign.id,
          'scrape_fallback',
          attempt.status === 'checkpoint' ? 'checkpoint' : 'skipped',
          `${attempt.reason} Coba lanjut ke akun berikutnya.`,
          attempt.accountId ?? candidate.account?.id ?? null
        )
      }

      if (!scrapeSucceeded) {
        hadError = true
        throw new Error(
          `Semua akun scrape gagal dipakai: ${failedAccounts.length ? failedAccounts.join(', ') : 'tidak ada akun aktif'}`
        )
      }
    } else if (campaign.type === 'scrape_profile') {
      if (!accounts.length) throw new Error('Campaign scrape profile membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      const scrapeProfileType = config.scrapeProfileType ?? 'friend'
      const sourceTargets =
        scrapeProfileType === 'group_member'
          ? campaign.groups
              .map((row) => row.group)
              .filter((group): group is NonNullable<(typeof campaign.groups)[number]['group']> =>
                Boolean(group)
              )
              .map((group) => ({
                key: group.id,
                label: group.groupName ?? group.groupId,
                sourceUrl: group.groupUrl || `https://www.facebook.com/groups/${group.groupId}/members`,
                groupId: group.id,
              }))
          : [
              {
                key: config.pageUrl ?? 'page',
                label: config.pageUrl ?? 'Target URL',
                sourceUrl: config.pageUrl ?? null,
                groupId: null,
              },
            ]

      if (!sourceTargets.length || !sourceTargets.some((item) => item.sourceUrl)) {
        throw new Error('Scrape profile membutuhkan target group atau URL sumber yang valid.')
      }

      let scrapeSucceeded = false
      const failedAccounts: string[] = []
      let scrapeBatch = 0

      for (const candidate of accounts) {
        scrapeBatch++
        await updateRuntime(
          {
            currentBatch: scrapeBatch,
            totalBatches: accounts.length,
            currentAccountId: candidate.account?.id ?? null,
            currentAction: 'scrape_profile',
            currentLabel: `Batch scrape profile ${scrapeBatch}/${accounts.length}: ${candidate.account?.label ?? 'Akun'}.`,
            runningCount: 1,
          },
          {
            batchLabel: `Batch scrape profile ${scrapeBatch}/${accounts.length}`,
            currentAccountLabel: candidate.account?.label ?? null,
            completedBatches: scrapeBatch - 1,
            activeBatches: 1,
          }
        )

        const attempt = await withAccount(
          candidate,
          async (page) => {
            const assignedProfileTags = normalizeGroupTags(
              Array.isArray(config.profileTags) ? config.profileTags : []
            )
            const maxTargets =
              typeof campaign.maxTargets === 'number' && campaign.maxTargets > 0 ? campaign.maxTargets : null
            const minFriendCount =
              typeof config.minFriendCount === 'number' ? config.minFriendCount : null
            const discoveredProfiles = new Map<string, ScrapedProfile>()
            let processedCount = 0
            let skippedByFriendCount = 0
            let skippedByMissingName = 0
            let persistedCount = 0

            await updateRuntime(
              {
                targetType: 'hasil_scrape',
                totalTargets: null,
                discoveredCount: 0,
                processedTargets: 0,
                successCount: 0,
                skippedCount: 0,
                persistedCount: 0,
                currentAction: 'scrape_profile',
                currentLabel: `Mengumpulkan profile dari ${sourceTargets.length} sumber.`,
              },
              {
                batchLabel: `Batch scrape profile ${scrapeBatch}/${accounts.length}`,
              }
            )

            for (const [sourceIndex, source] of sourceTargets.entries()) {
              const remainingTargets =
                maxTargets === null ? null : Math.max(0, maxTargets - discoveredProfiles.size)
              if (remainingTargets !== null && remainingTargets === 0) break

              await updateRuntime(
                {
                  currentGroupId: source.groupId,
                  currentAction: 'scrape_profile',
                  currentLabel: `Sumber ${sourceIndex + 1}/${sourceTargets.length}: ${source.label}.`,
                },
                {
                  currentGroupName: source.label,
                  currentGroupCode: source.groupId ?? source.key,
                }
              )

              const found = await runScrapeProfile(page, config, {
                sourceUrl: source.sourceUrl,
                maxTargets: remainingTargets,
              })
              const newlyDiscovered: ScrapedProfile[] = []

              for (const profile of found) {
                if (!discoveredProfiles.has(profile.profileId)) {
                  discoveredProfiles.set(profile.profileId, profile)
                  newlyDiscovered.push(profile)
                }
              }

              await updateRuntime(
                {
                  totalTargets: discoveredProfiles.size,
                  discoveredCount: discoveredProfiles.size,
                  currentAction: 'scrape_profile',
                  currentLabel: `${discoveredProfiles.size} profile unik ditemukan sejauh ini.`,
                },
                {
                  currentGroupName: source.label,
                }
              )

              for (const profile of newlyDiscovered) {
                let resolvedProfile = profile
                processedCount++

                await updateRuntime(
                  {
                    totalTargets: discoveredProfiles.size,
                    processedTargets: processedCount,
                    currentAction: 'scrape_profile_metadata',
                    currentLabel: `Memproses metadata ${processedCount}/${discoveredProfiles.size} profile.`,
                  },
                  {
                    currentGroupCode: profile.profileId,
                  }
                )

                if (shouldRefreshScrapedProfileMetadata(profile, { minFriendCount })) {
                  try {
                    const metadata = await extractProfileMetadataFromPage(page, profile)
                    const preferredProfileName = preferProfileName(
                      profile.profileName,
                      metadata.profileName
                    )
                    resolvedProfile = {
                      ...profile,
                      profileId: metadata.profileId,
                      profileUrl: metadata.profileUrl,
                      profileName: preferredProfileName,
                      friendCount: metadata.friendCount ?? profile.friendCount,
                      mutualFriendCount: metadata.mutualFriendCount ?? profile.mutualFriendCount,
                      followerCount: metadata.followerCount ?? profile.followerCount,
                      followingCount: metadata.followingCount ?? profile.followingCount,
                    }
                  } catch (error) {
                    await log(
                      campaign.id,
                      'scrape_profile_metadata',
                      'skipped',
                      `Metadata profile ${profile.profileId} gagal diperdalam: ${(error as Error).message}`,
                      candidate.account!.id
                    )
                  }

                  await humanDelay(800)
                }

                if (!passesMinFriendCount(resolvedProfile.friendCount, minFriendCount)) {
                  skippedByFriendCount++
                  await updateRuntime({
                    totalTargets: discoveredProfiles.size,
                    processedTargets: processedCount,
                    skippedCount: skippedByFriendCount + skippedByMissingName,
                    currentLabel: `Lewati ${resolvedProfile.profileName ?? resolvedProfile.profileId}: friend count di bawah minimum.`,
                  })
                  continue
                }

                if (!resolvedProfile.profileName) {
                  skippedByMissingName++
                  await updateRuntime({
                    totalTargets: discoveredProfiles.size,
                    processedTargets: processedCount,
                    skippedCount: skippedByFriendCount + skippedByMissingName,
                    currentLabel: `Lewati ${resolvedProfile.profileId}: nama profile kosong.`,
                  })
                  continue
                }

                const persistedProfile = await FacebookProfile.firstOrCreate(
                  { userId: campaign.userId, profileId: resolvedProfile.profileId },
                  {
                    userId: campaign.userId,
                    profileId: resolvedProfile.profileId,
                    profileUrl: resolvedProfile.profileUrl,
                    profileName: resolvedProfile.profileName,
                    friendCount: resolvedProfile.friendCount,
                    mutualFriendCount: resolvedProfile.mutualFriendCount,
                    followerCount: resolvedProfile.followerCount,
                    followingCount: resolvedProfile.followingCount,
                    sourceType: resolvedProfile.sourceType,
                    sourceUrl: resolvedProfile.sourceUrl,
                    ...(assignedProfileTags.length ? { tags: assignedProfileTags } : {}),
                  }
                )

                const finalProfileName = preferProfileName(
                  persistedProfile.profileName,
                  resolvedProfile.profileName
                )
                persistedProfile.merge({
                  profileUrl: resolvedProfile.profileUrl,
                  ...(finalProfileName ? { profileName: finalProfileName } : {}),
                  ...(resolvedProfile.friendCount !== null
                    ? { friendCount: resolvedProfile.friendCount }
                    : {}),
                  ...(resolvedProfile.mutualFriendCount !== null
                    ? { mutualFriendCount: resolvedProfile.mutualFriendCount }
                    : {}),
                  ...(resolvedProfile.followerCount !== null
                    ? { followerCount: resolvedProfile.followerCount }
                    : {}),
                  ...(resolvedProfile.followingCount !== null
                    ? { followingCount: resolvedProfile.followingCount }
                    : {}),
                  sourceType: resolvedProfile.sourceType,
                  sourceUrl: resolvedProfile.sourceUrl,
                  ...(assignedProfileTags.length
                    ? {
                        tags: mergeGroupTags(
                          Array.isArray(persistedProfile.tags) ? (persistedProfile.tags as string[]) : [],
                          assignedProfileTags
                        ),
                      }
                    : {}),
                })
                await persistedProfile.save()
                persistedCount++

                await updateRuntime(
                  {
                    totalTargets: discoveredProfiles.size,
                    processedTargets: processedCount,
                    successCount: persistedCount,
                    persistedCount,
                    currentProfileId: persistedProfile.id,
                    currentAction: 'scrape_profile',
                    currentLabel: `Menyimpan profile valid ${persistedCount}/${discoveredProfiles.size}.`,
                  },
                  {
                    currentGroupName: resolvedProfile.profileName ?? resolvedProfile.profileId,
                    currentGroupCode: resolvedProfile.profileId,
                  }
                )
              }
            }

            const totalSkipped = skippedByFriendCount + skippedByMissingName
            await updateRuntime(
              {
                totalTargets: discoveredProfiles.size,
                processedTargets: processedCount,
                discoveredCount: discoveredProfiles.size,
                successCount: persistedCount,
                skippedCount: totalSkipped,
                persistedCount,
                runningCount: 0,
                currentAction: 'scrape_profile',
                currentLabel: `${persistedCount} profile disimpan dari ${discoveredProfiles.size} hasil scrape.`,
              },
              {
                completedBatches: scrapeBatch,
                activeBatches: 0,
                skippedByMemberCount: skippedByFriendCount,
                skippedByMissingName,
              }
            )

            await log(
              campaign.id,
              'scrape_profile',
              'success',
              `${persistedCount} profile disimpan. ${skippedByFriendCount} dilewati karena minimum friend, ${skippedByMissingName} dilewati karena nama profile kosong.`,
              candidate.account!.id
            )
          },
          { markHadErrorOnFailure: false }
        )

        if (attempt.status === 'done') {
          scrapeSucceeded = true
          break
        }

        failedAccounts.push(attempt.accountLabel ?? candidate.account?.label ?? 'unknown')
        await updateRuntime(
          {
            failedCount: failedAccounts.length,
            runningCount: 0,
            currentAction: 'scrape_fallback',
            currentLabel: `${attempt.reason} Mencoba akun berikutnya.`,
          },
          {
            completedBatches: scrapeBatch,
            activeBatches: 0,
          }
        )
        await log(
          campaign.id,
          'scrape_fallback',
          attempt.status === 'checkpoint' ? 'checkpoint' : 'skipped',
          `${attempt.reason} Coba lanjut ke akun berikutnya.`,
          attempt.accountId ?? candidate.account?.id ?? null
        )
      }

      if (!scrapeSucceeded) {
        hadError = true
        throw new Error(
          `Semua akun scrape profile gagal dipakai: ${failedAccounts.length ? failedAccounts.join(', ') : 'tidak ada akun aktif'}`
        )
      }
    } else if (campaign.type === 'auto_add_friend') {
      if (!accounts.length) throw new Error('Campaign auto add friend membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      const addFriendType = config.addFriendType ?? 'profile'
      const assignedProfileTags = normalizeGroupTags(
        Array.isArray(config.profileTags) ? config.profileTags : []
      )
      const minFriendCount =
        typeof config.minFriendCount === 'number' ? config.minFriendCount : null
      const maxTargets =
        typeof campaign.maxTargets === 'number' && campaign.maxTargets > 0 ? campaign.maxTargets : null

      const targetProfiles: Array<{
        campaignProfileId: string | null
        facebookProfileId: string | null
        profileId: string
        profileUrl: string | null
        profileName: string
      }> = addFriendType === 'group'
        ? []
        : addFriendType === 'any_facebook_url'
          ? [
              {
                campaignProfileId: null,
                facebookProfileId: null,
                profileId: String(config.anyFacebookUrl ?? 'manual-url'),
                profileUrl: String(config.anyFacebookUrl ?? ''),
                profileName: 'Any Facebook URL',
              },
            ]
          : campaign.profiles
              .map((row) => ({
                campaignProfileId: row.id,
                facebookProfileId: row.profile?.id ?? row.profileId,
                profileId: row.profile?.profileId ?? row.profileId,
                profileUrl: row.profile?.profileUrl ?? null,
                profileName: row.profile?.profileName ?? row.profile?.profileId ?? row.profileId,
              }))
              .filter((profile) => Boolean(profile.profileUrl))

      if (addFriendType === 'group') {
        if (!campaign.groups.length) {
          throw new Error('Mode auto add friend by group membutuhkan minimal 1 group target.')
        }

        let scrapeSucceeded = false
        const failedAccounts: string[] = []
        let scrapeBatch = 0

        for (const candidate of accounts) {
          scrapeBatch++
          await updateRuntime(
            {
              currentBatch: scrapeBatch,
              totalBatches: accounts.length,
              currentAccountId: candidate.account?.id ?? null,
              currentAction: 'scrape_profile',
              currentLabel: `Batch scrape member ${scrapeBatch}/${accounts.length}: ${candidate.account?.label ?? 'Akun'}.`,
              runningCount: 1,
            },
            {
              batchLabel: `Batch scrape member ${scrapeBatch}/${accounts.length}`,
              currentAccountLabel: candidate.account?.label ?? null,
              completedBatches: scrapeBatch - 1,
              activeBatches: 1,
            }
          )

          const attempt = await withAccount(
            candidate,
            async (page) => {
              const discoveredProfiles = new Map<string, ScrapedProfile>()

              await updateRuntime(
                {
                  targetType: 'hasil_scrape',
                  totalTargets: null,
                  discoveredCount: 0,
                  processedTargets: 0,
                  successCount: 0,
                  skippedCount: 0,
                  persistedCount: 0,
                  currentAction: 'scrape_profile',
                  currentLabel: `Mengumpulkan member dari ${campaign.groups.length} group.`,
                },
                {
                  batchLabel: `Batch scrape member ${scrapeBatch}/${accounts.length}`,
                }
              )

              for (const [groupIndex, campaignGroup] of campaign.groups.entries()) {
                const group = campaignGroup.group
                if (!group) continue

                const remainingTargets =
                  maxTargets === null ? null : Math.max(0, maxTargets - discoveredProfiles.size)
                if (remainingTargets !== null && remainingTargets === 0) break

                await updateRuntime(
                  {
                    currentGroupId: group.id,
                    currentAction: 'scrape_profile',
                    currentLabel: `Scrape member ${groupIndex + 1}/${campaign.groups.length}: ${group.groupName ?? group.groupId}.`,
                  },
                  {
                    currentGroupName: group.groupName ?? group.groupId,
                    currentGroupCode: group.groupId,
                  }
                )

                let found: ScrapedProfile[] = []
                try {
                  found = await runScrapeProfile(
                    page,
                    {
                      ...config,
                      scrapeProfileType: 'group_member',
                    },
                    {
                      sourceUrl:
                        group.groupUrl || `https://www.facebook.com/groups/${group.groupId}/members`,
                      maxTargets: remainingTargets,
                    }
                  )
                  const campaignGroupRow =
                    campaign.groups.find((row) => row.id === campaignGroup.id) ??
                    (await CampaignGroup.find(campaignGroup.id))
                  if (campaignGroupRow) {
                    campaignGroupRow.status = found.length ? 'done' : 'skipped'
                    await campaignGroupRow.save()
                  }
                } catch (error) {
                  const campaignGroupRow =
                    campaign.groups.find((row) => row.id === campaignGroup.id) ??
                    (await CampaignGroup.find(campaignGroup.id))
                  if (campaignGroupRow) {
                    campaignGroupRow.status = 'failed'
                    await campaignGroupRow.save()
                  }
                  throw error
                }

                for (const profile of found) {
                  if (!discoveredProfiles.has(profile.profileId)) {
                    discoveredProfiles.set(profile.profileId, profile)
                  }
                }

                await updateRuntime(
                  {
                    totalTargets: discoveredProfiles.size,
                    discoveredCount: discoveredProfiles.size,
                    currentAction: 'scrape_profile',
                    currentLabel: `${discoveredProfiles.size} profile unik ditemukan dari group target.`,
                  },
                  {
                    currentGroupName: group.groupName ?? group.groupId,
                    currentGroupCode: group.groupId,
                  }
                )
              }

              const discoveredList = [...discoveredProfiles.values()]
              let skippedByFriendCount = 0
              let skippedByMissingName = 0
              let persistedCount = 0

              for (const [index, profile] of discoveredList.entries()) {
                let resolvedProfile = profile

                await updateRuntime(
                  {
                    processedTargets: index + 1,
                    currentAction: 'scrape_profile_metadata',
                    currentLabel: `Memproses metadata ${index + 1}/${discoveredList.length} profile member.`,
                  },
                  {
                    currentGroupCode: profile.profileId,
                  }
                )

                if (shouldRefreshScrapedProfileMetadata(profile, { minFriendCount })) {
                  try {
                    const metadata = await extractProfileMetadataFromPage(page, profile)
                    const preferredProfileName = preferProfileName(
                      profile.profileName,
                      metadata.profileName
                    )
                    resolvedProfile = {
                      ...profile,
                      profileId: metadata.profileId,
                      profileUrl: metadata.profileUrl,
                      profileName: preferredProfileName,
                      friendCount: metadata.friendCount ?? profile.friendCount,
                      mutualFriendCount: metadata.mutualFriendCount ?? profile.mutualFriendCount,
                      followerCount: metadata.followerCount ?? profile.followerCount,
                      followingCount: metadata.followingCount ?? profile.followingCount,
                    }
                  } catch (error) {
                    await log(
                      campaign.id,
                      'scrape_profile_metadata',
                      'skipped',
                      `Metadata profile ${profile.profileId} gagal diperdalam: ${(error as Error).message}`,
                      candidate.account!.id
                    )
                  }

                  await humanDelay(800)
                }

                if (!passesMinFriendCount(resolvedProfile.friendCount, minFriendCount)) {
                  skippedByFriendCount++
                  continue
                }

                if (!resolvedProfile.profileName) {
                  skippedByMissingName++
                  continue
                }

                const persistedProfile = await FacebookProfile.firstOrCreate(
                  { userId: campaign.userId, profileId: resolvedProfile.profileId },
                  {
                    userId: campaign.userId,
                    profileId: resolvedProfile.profileId,
                    profileUrl: resolvedProfile.profileUrl,
                    profileName: resolvedProfile.profileName,
                    friendCount: resolvedProfile.friendCount,
                    mutualFriendCount: resolvedProfile.mutualFriendCount,
                    followerCount: resolvedProfile.followerCount,
                    followingCount: resolvedProfile.followingCount,
                    sourceType: 'group_member',
                    sourceUrl: resolvedProfile.sourceUrl,
                    ...(assignedProfileTags.length ? { tags: assignedProfileTags } : {}),
                  }
                )

                const finalProfileName = preferProfileName(
                  persistedProfile.profileName,
                  resolvedProfile.profileName
                )
                persistedProfile.merge({
                  profileUrl: resolvedProfile.profileUrl,
                  ...(finalProfileName ? { profileName: finalProfileName } : {}),
                  ...(resolvedProfile.friendCount !== null
                    ? { friendCount: resolvedProfile.friendCount }
                    : {}),
                  ...(resolvedProfile.mutualFriendCount !== null
                    ? { mutualFriendCount: resolvedProfile.mutualFriendCount }
                    : {}),
                  ...(resolvedProfile.followerCount !== null
                    ? { followerCount: resolvedProfile.followerCount }
                    : {}),
                  ...(resolvedProfile.followingCount !== null
                    ? { followingCount: resolvedProfile.followingCount }
                    : {}),
                  sourceType: 'group_member',
                  sourceUrl: resolvedProfile.sourceUrl,
                  ...(assignedProfileTags.length
                    ? {
                        tags: mergeGroupTags(
                          Array.isArray(persistedProfile.tags) ? (persistedProfile.tags as string[]) : [],
                          assignedProfileTags
                        ),
                      }
                    : {}),
                })
                await persistedProfile.save()

                const campaignProfile = await CampaignProfile.firstOrCreate(
                  {
                    campaignId: campaign.id,
                    profileId: persistedProfile.id,
                  },
                  {
                    campaignId: campaign.id,
                    profileId: persistedProfile.id,
                    status: 'pending',
                  }
                )

                campaignProfile.status = 'pending'
                await campaignProfile.save()

                targetProfiles.push({
                  campaignProfileId: campaignProfile.id,
                  facebookProfileId: persistedProfile.id,
                  profileId: persistedProfile.profileId,
                  profileUrl: persistedProfile.profileUrl,
                  profileName: persistedProfile.profileName ?? persistedProfile.profileId,
                })

                persistedCount++
                await updateRuntime(
                  {
                    successCount: persistedCount,
                    persistedCount,
                    currentAction: 'scrape_profile',
                    currentLabel: `Menyimpan profile member ${persistedCount}/${discoveredList.length}.`,
                  },
                  {
                    currentGroupName: persistedProfile.profileName ?? persistedProfile.profileId,
                    currentGroupCode: persistedProfile.profileId,
                  }
                )
              }

              const totalSkipped = skippedByFriendCount + skippedByMissingName
              await updateRuntime(
                {
                  totalTargets: discoveredList.length,
                  processedTargets: discoveredList.length,
                  discoveredCount: discoveredList.length,
                  successCount: persistedCount,
                  skippedCount: totalSkipped,
                  persistedCount,
                  runningCount: 0,
                  currentAction: 'scrape_profile',
                  currentLabel: `${persistedCount} profile member siap dipakai untuk add friend.`,
                },
                {
                  completedBatches: scrapeBatch,
                  activeBatches: 0,
                  skippedByMemberCount: skippedByFriendCount,
                  skippedByMissingName,
                }
              )

              await log(
                campaign.id,
                'scrape_profile',
                'success',
                `${persistedCount} profile member disiapkan untuk auto add friend.`,
                candidate.account!.id
              )
            },
            { markHadErrorOnFailure: false }
          )

          if (attempt.status === 'done') {
            scrapeSucceeded = true
            break
          }

          failedAccounts.push(attempt.accountLabel ?? candidate.account?.label ?? 'unknown')
          await updateRuntime(
            {
              failedCount: failedAccounts.length,
              runningCount: 0,
              currentAction: 'scrape_fallback',
              currentLabel: `${attempt.reason} Mencoba akun berikutnya.`,
            },
            {
              completedBatches: scrapeBatch,
              activeBatches: 0,
            }
          )
        }

        if (!scrapeSucceeded) {
          throw new Error(
            `Semua akun scrape member gagal dipakai: ${failedAccounts.length ? failedAccounts.join(', ') : 'tidak ada akun aktif'}`
          )
        }
      }

      if (!targetProfiles.length) {
        throw new Error('Tidak ada target profile yang siap diproses untuk auto add friend.')
      }

      const chunks = distribute(targetProfiles, accounts.length)
      const assignments = accounts.map((account, index) => ({ account, profiles: chunks[index] ?? [] }))
      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'profile',
          totalTargets: targetProfiles.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: assignments.length,
          currentAction: 'auto_add_friend',
          currentLabel: `Menyiapkan ${assignments.length} batch akun untuk add friend.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(
        assignments,
        campaign.maxConcurrency,
        async ({ account: campaignAccount, profiles }) => {
          batchCursor++
          const batchNumber = batchCursor
          activeBatches++

          await updateRuntime(
            {
              currentBatch: batchNumber,
              currentAccountId: campaignAccount.account?.id ?? null,
              currentAction: 'auto_add_friend',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
              runningCount: activeBatches,
            },
            {
              batchLabel: `Batch akun ${batchNumber}/${assignments.length}`,
              currentAccountLabel: campaignAccount.account?.label ?? null,
              completedBatches,
              activeBatches,
            }
          )

          await withAccount(campaignAccount, async (page) => {
            for (const targetProfile of profiles) {
              await updateRuntime(
                {
                  currentAction: 'auto_add_friend',
                  currentLabel: `Memproses add friend ${targetProfile.profileName}.`,
                  runningCount: activeBatches,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              const result = await runAutoAddFriend(page, {
                profileId: targetProfile.profileId,
                profileUrl: targetProfile.profileUrl,
              })

              if (targetProfile.campaignProfileId) {
                const campaignProfile =
                  campaign.profiles.find((row) => row.id === targetProfile.campaignProfileId) ??
                  (await CampaignProfile.find(targetProfile.campaignProfileId))
                if (campaignProfile) {
                  campaignProfile.status =
                    result.status === 'done'
                      ? 'done'
                      : result.status === 'skipped'
                        ? 'skipped'
                        : 'failed'
                  await campaignProfile.save()
                }
              }

              await log(
                campaign.id,
                'auto_add_friend',
                result.status === 'done' ? 'success' : result.status,
                result.message,
                campaignAccount.account?.id
              )
              await updateProfileLifecycle(targetProfile.facebookProfileId, {
                lifecycleStatus:
                  result.status === 'done' ? 'friend_requested' : result.status === 'failed' ? 'failed' : undefined,
                relationshipStatus: result.status === 'done' ? 'outgoing_request' : undefined,
                lastAction: 'auto_add_friend',
                lastActionStatus: result.status === 'done' ? 'success' : result.status,
                lastActionMessage: result.message,
              })

              await updateRuntime(
                {
                  processedTargets: runtime.processedTargets + 1,
                  successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
                  failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
                  skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
                  currentAction: 'auto_add_friend',
                  currentLabel: result.message,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              await humanDelay(campaign.maxDelayMs)
            }
          })

          activeBatches = Math.max(0, activeBatches - 1)
          completedBatches++
          await updateRuntime(
            {
              runningCount: activeBatches,
              currentAction: 'auto_add_friend',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length} selesai.`,
            },
            {
              completedBatches,
              activeBatches,
            }
          )
        }
      )
    } else if (campaign.type === 'auto_unfriend') {
      if (!accounts.length) throw new Error('Campaign auto unfriend membutuhkan minimal 1 akun.')

      const targetProfiles = campaign.profiles
        .map((row) => ({
          campaignProfileId: row.id,
          facebookProfileId: row.profile?.id ?? row.profileId,
          profileId: row.profile?.profileId ?? row.profileId,
          profileUrl: row.profile?.profileUrl ?? null,
          profileName: row.profile?.profileName ?? row.profile?.profileId ?? row.profileId,
        }))
        .filter((profile) => Boolean(profile.profileId))

      if (!targetProfiles.length) {
        throw new Error('Campaign auto unfriend membutuhkan profile target dari profile pool.')
      }

      const chunks = distribute(targetProfiles, accounts.length)
      const assignments = accounts.map((account, index) => ({ account, profiles: chunks[index] ?? [] }))
      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'profile',
          totalTargets: targetProfiles.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: assignments.length,
          currentAction: 'auto_unfriend',
          currentLabel: `Menyiapkan ${assignments.length} batch akun untuk auto unfriend.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(
        assignments,
        campaign.maxConcurrency,
        async ({ account: campaignAccount, profiles }) => {
          batchCursor++
          const batchNumber = batchCursor
          activeBatches++

          await updateRuntime(
            {
              currentBatch: batchNumber,
              currentAccountId: campaignAccount.account?.id ?? null,
              currentAction: 'auto_unfriend',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
              runningCount: activeBatches,
            },
            {
              batchLabel: `Batch akun ${batchNumber}/${assignments.length}`,
              currentAccountLabel: campaignAccount.account?.label ?? null,
              completedBatches,
              activeBatches,
            }
          )

          await withAccount(campaignAccount, async (page) => {
            for (const targetProfile of profiles) {
              await updateRuntime(
                {
                  currentAction: 'auto_unfriend',
                  currentLabel: `Memproses unfriend ${targetProfile.profileName}.`,
                  runningCount: activeBatches,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              const result = await runAutoUnfriend(page, {
                profileId: targetProfile.profileId,
                profileUrl: targetProfile.profileUrl,
              })

              const campaignProfile =
                campaign.profiles.find((row) => row.id === targetProfile.campaignProfileId) ??
                (await CampaignProfile.find(targetProfile.campaignProfileId))
              if (campaignProfile) {
                campaignProfile.status =
                  result.status === 'done'
                    ? 'done'
                    : result.status === 'skipped'
                      ? 'skipped'
                      : 'failed'
                await campaignProfile.save()
              }

              await log(
                campaign.id,
                'auto_unfriend',
                result.status === 'done' ? 'success' : result.status,
                result.message,
                campaignAccount.account?.id
              )
              await updateProfileLifecycle(targetProfile.facebookProfileId, {
                lifecycleStatus:
                  result.status === 'done' ? 'fresh' : result.status === 'failed' ? 'failed' : undefined,
                relationshipStatus: result.status === 'done' ? 'unknown' : undefined,
                lastAction: 'auto_unfriend',
                lastActionStatus: result.status === 'done' ? 'success' : result.status,
                lastActionMessage: result.message,
              })

              await updateRuntime(
                {
                  processedTargets: runtime.processedTargets + 1,
                  successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
                  failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
                  skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
                  currentAction: 'auto_unfriend',
                  currentLabel: result.message,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              await humanDelay(campaign.maxDelayMs)
            }
          })

          activeBatches = Math.max(0, activeBatches - 1)
          completedBatches++
          await updateRuntime(
            {
              runningCount: activeBatches,
              currentAction: 'auto_unfriend',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length} selesai.`,
            },
            {
              completedBatches,
              activeBatches,
            }
          )
        }
      )
    } else if (campaign.type === 'auto_like') {
      if (!accounts.length) throw new Error('Campaign auto like membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      if (!config.url) {
        throw new Error('Campaign auto like membutuhkan URL target.')
      }

      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'account',
          totalTargets: accounts.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: accounts.length,
          currentAction: 'auto_like',
          currentLabel: `Menyiapkan ${accounts.length} akun untuk auto like.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(accounts, campaign.maxConcurrency, async (campaignAccount) => {
        batchCursor++
        const batchNumber = batchCursor
        activeBatches++

        await updateRuntime(
          {
            currentBatch: batchNumber,
            currentAccountId: campaignAccount.account?.id ?? null,
            currentAction: 'auto_like',
            currentLabel: `Batch akun ${batchNumber}/${accounts.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
            runningCount: activeBatches,
          },
          {
            batchLabel: `Batch akun ${batchNumber}/${accounts.length}`,
            currentAccountLabel: campaignAccount.account?.label ?? null,
            completedBatches,
            activeBatches,
          }
        )

        await withAccount(campaignAccount, async (page) => {
          const result = await runAutoLike(page, config)

          await log(
            campaign.id,
            'auto_like',
            result.status === 'done' ? 'success' : result.status,
            result.message,
            campaignAccount.account?.id
          )

          await updateRuntime(
            {
              processedTargets: runtime.processedTargets + 1,
              successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
              failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
              skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
              currentAction: 'auto_like',
              currentLabel: result.message,
            },
            null
          )

          await humanDelay(randomizedCampaignDelay(campaign.maxDelayMs))
        })

        activeBatches = Math.max(0, activeBatches - 1)
        completedBatches++
        await updateRuntime(
          {
            runningCount: activeBatches,
            currentAction: 'auto_like',
            currentLabel: `Batch akun ${batchNumber}/${accounts.length} selesai.`,
          },
          {
            completedBatches,
            activeBatches,
          }
        )
      })
    } else if (campaign.type === 'auto_comment') {
      if (!accounts.length) throw new Error('Campaign auto comment membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      if (!config.url) {
        throw new Error('Campaign auto comment membutuhkan URL target.')
      }
      if (!config.caption) {
        throw new Error('Campaign auto comment membutuhkan caption comment.')
      }

      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'account',
          totalTargets: accounts.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: accounts.length,
          currentAction: 'auto_comment',
          currentLabel: `Menyiapkan ${accounts.length} akun untuk auto comment.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(accounts, campaign.maxConcurrency, async (campaignAccount) => {
        batchCursor++
        const batchNumber = batchCursor
        activeBatches++

        await updateRuntime(
          {
            currentBatch: batchNumber,
            currentAccountId: campaignAccount.account?.id ?? null,
            currentAction: 'auto_comment',
            currentLabel: `Batch akun ${batchNumber}/${accounts.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
            runningCount: activeBatches,
          },
          {
            batchLabel: `Batch akun ${batchNumber}/${accounts.length}`,
            currentAccountLabel: campaignAccount.account?.label ?? null,
            completedBatches,
            activeBatches,
          }
        )

        await withAccount(campaignAccount, async (page) => {
          const result = await runAutoComment(page, config)

          await log(
            campaign.id,
            'auto_comment',
            result.status === 'done' ? 'success' : result.status,
            result.message,
            campaignAccount.account?.id
          )

          await updateRuntime(
            {
              processedTargets: runtime.processedTargets + 1,
              successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
              failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
              skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
              currentAction: 'auto_comment',
              currentLabel: result.message,
            },
            null
          )

          await humanDelay(randomizedCampaignDelay(campaign.maxDelayMs))
        })

        activeBatches = Math.max(0, activeBatches - 1)
        completedBatches++
        await updateRuntime(
          {
            runningCount: activeBatches,
            currentAction: 'auto_comment',
            currentLabel: `Batch akun ${batchNumber}/${accounts.length} selesai.`,
          },
          {
            completedBatches,
            activeBatches,
          }
        )
      })
    } else if (campaign.type === 'auto_inbox') {
      if (!accounts.length) throw new Error('Campaign auto inbox membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      const inboxDuplicateCooldownHours = 24
      const targetProfiles = campaign.profiles
        .map((row) => ({
          campaignProfileId: row.id,
          facebookProfileId: row.profile?.id ?? row.profileId,
          profileId: row.profile?.profileId ?? row.profileId,
          profileUrl: row.profile?.profileUrl ?? null,
          profileName: row.profile?.profileName ?? row.profile?.profileId ?? row.profileId,
          lastAction: row.profile?.lastAction ?? null,
          lastActionStatus: row.profile?.lastActionStatus ?? null,
          lastActionAt: row.profile?.lastActionAt ?? null,
        }))
        .filter((profile) => Boolean(profile.profileId))

      if (!targetProfiles.length) {
        throw new Error('Campaign auto inbox membutuhkan profile target dari profile pool.')
      }

      const chunks = distribute(targetProfiles, accounts.length)
      const assignments = accounts.map((account, index) => ({ account, profiles: chunks[index] ?? [] }))
      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'profile',
          totalTargets: targetProfiles.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: assignments.length,
          currentAction: 'auto_inbox',
          currentLabel: `Menyiapkan ${assignments.length} batch akun untuk auto inbox.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
          skippedDuplicates: 0,
        }
      )

      await runPool(
        assignments,
        campaign.maxConcurrency,
        async ({ account: campaignAccount, profiles }) => {
          batchCursor++
          const batchNumber = batchCursor
          activeBatches++

          await updateRuntime(
            {
              currentBatch: batchNumber,
              currentAccountId: campaignAccount.account?.id ?? null,
              currentAction: 'auto_inbox',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
              runningCount: activeBatches,
            },
            {
              batchLabel: `Batch akun ${batchNumber}/${assignments.length}`,
              currentAccountLabel: campaignAccount.account?.label ?? null,
              completedBatches,
              activeBatches,
            }
          )

          await withAccount(campaignAccount, async (page) => {
            for (const targetProfile of profiles) {
              if (shouldSkipAutoInboxDuplicate(targetProfile, inboxDuplicateCooldownHours)) {
                const duplicateMessage = `Target "${targetProfile.profileName}" dilewati karena inbox sukses masih dalam cooldown ${inboxDuplicateCooldownHours} jam.`

                const campaignProfile =
                  campaign.profiles.find((row) => row.id === targetProfile.campaignProfileId) ??
                  (await CampaignProfile.find(targetProfile.campaignProfileId))
                if (campaignProfile) {
                  campaignProfile.status = 'skipped'
                  await campaignProfile.save()
                }

                await log(
                  campaign.id,
                  'auto_inbox',
                  'skipped',
                  duplicateMessage,
                  campaignAccount.account?.id
                )
                await updateProfileLifecycle(targetProfile.facebookProfileId, {
                  lastAction: 'auto_inbox',
                  lastActionStatus: 'skipped',
                  lastActionMessage: duplicateMessage,
                })

                await updateRuntime(
                  {
                    processedTargets: runtime.processedTargets + 1,
                    skippedCount: runtime.skippedCount + 1,
                    currentAction: 'auto_inbox',
                    currentLabel: duplicateMessage,
                  },
                  {
                    currentGroupName: targetProfile.profileName,
                    currentGroupCode: targetProfile.profileId,
                    skippedDuplicates: (runtime.meta?.skippedDuplicates ?? 0) + 1,
                  }
                )

                await humanDelay(randomizedCampaignDelay(campaign.maxDelayMs))
                continue
              }

              await updateRuntime(
                {
                  currentAction: 'auto_inbox',
                  currentLabel: `Memproses inbox ${targetProfile.profileName}.`,
                  runningCount: activeBatches,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              const result = await runAutoInbox(
                page,
                {
                  profileId: targetProfile.profileId,
                  profileUrl: targetProfile.profileUrl,
                  profileName: targetProfile.profileName,
                },
                config
              )

              const campaignProfile =
                campaign.profiles.find((row) => row.id === targetProfile.campaignProfileId) ??
                (await CampaignProfile.find(targetProfile.campaignProfileId))
              if (campaignProfile) {
                campaignProfile.status =
                  result.status === 'done'
                    ? 'done'
                    : result.status === 'skipped'
                      ? 'skipped'
                      : 'failed'
                await campaignProfile.save()
              }

              await log(
                campaign.id,
                'auto_inbox',
                result.status === 'done' ? 'success' : result.status,
                result.message,
                campaignAccount.account?.id
              )
              await updateProfileLifecycle(targetProfile.facebookProfileId, {
                lastAction: 'auto_inbox',
                lastActionStatus: result.status === 'done' ? 'success' : result.status,
                lastActionMessage: result.message,
              })

              await updateRuntime(
                {
                  processedTargets: runtime.processedTargets + 1,
                  successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
                  failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
                  skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
                  currentAction: 'auto_inbox',
                  currentLabel: result.message,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              await humanDelay(randomizedCampaignDelay(campaign.maxDelayMs))
            }
          })

          activeBatches = Math.max(0, activeBatches - 1)
          completedBatches++
          await updateRuntime(
            {
              runningCount: activeBatches,
              currentAction: 'auto_inbox',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length} selesai.`,
            },
            {
              completedBatches,
              activeBatches,
            }
          )
        }
      )
    } else if (campaign.type === 'auto_delete') {
      if (!accounts.length) throw new Error('Campaign auto delete membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      if (!config.url) {
        throw new Error('Campaign auto delete membutuhkan URL target.')
      }

      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'account',
          totalTargets: accounts.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: accounts.length,
          currentAction: 'auto_delete',
          currentLabel: `Menyiapkan ${accounts.length} akun untuk auto delete.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(accounts, campaign.maxConcurrency, async (campaignAccount) => {
        batchCursor++
        const batchNumber = batchCursor
        activeBatches++

        await updateRuntime(
          {
            currentBatch: batchNumber,
            currentAccountId: campaignAccount.account?.id ?? null,
            currentAction: 'auto_delete',
            currentLabel: `Batch akun ${batchNumber}/${accounts.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
            runningCount: activeBatches,
          },
          {
            batchLabel: `Batch akun ${batchNumber}/${accounts.length}`,
            currentAccountLabel: campaignAccount.account?.label ?? null,
            completedBatches,
            activeBatches,
          }
        )

        await withAccount(campaignAccount, async (page) => {
          const result = await runAutoDelete(page, config)

          await log(
            campaign.id,
            'auto_delete',
            result.status === 'done' ? 'success' : result.status,
            result.message,
            campaignAccount.account?.id
          )

          await updateRuntime(
            {
              processedTargets: runtime.processedTargets + 1,
              successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
              failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
              skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
              currentAction: 'auto_delete',
              currentLabel: result.message,
            },
            null
          )

          await humanDelay(randomizedCampaignDelay(campaign.maxDelayMs))
        })

        activeBatches = Math.max(0, activeBatches - 1)
        completedBatches++
        await updateRuntime(
          {
            runningCount: activeBatches,
            currentAction: 'auto_delete',
            currentLabel: `Batch akun ${batchNumber}/${accounts.length} selesai.`,
          },
          {
            completedBatches,
            activeBatches,
          }
        )
      })
    } else if (campaign.type === 'auto_confirm') {
      if (!accounts.length) throw new Error('Campaign auto confirm membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      const assignments = accounts.map((account) => ({ account }))
      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'account',
          totalTargets: assignments.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: assignments.length,
          currentAction: 'auto_confirm',
          currentLabel: `Menyiapkan ${assignments.length} akun untuk auto confirm.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(assignments, campaign.maxConcurrency, async ({ account: campaignAccount }) => {
        batchCursor++
        const batchNumber = batchCursor
        activeBatches++
        const confirmOutcome: {
          status: 'done' | 'skipped' | 'failed'
          message: string
        } = {
          status: 'failed',
          message: 'Auto confirm selesai.',
        }

        await updateRuntime(
          {
            currentBatch: batchNumber,
            currentAccountId: campaignAccount.account?.id ?? null,
            currentAction: 'auto_confirm',
            currentLabel: `Batch akun ${batchNumber}/${assignments.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
            runningCount: activeBatches,
          },
          {
            batchLabel: `Batch akun ${batchNumber}/${assignments.length}`,
            currentAccountLabel: campaignAccount.account?.label ?? null,
            completedBatches,
            activeBatches,
          }
        )

        const attempt = await withAccount(campaignAccount, async (page) => {
          const result = await runAutoConfirm(page, config)
          confirmOutcome.status = result.status
          confirmOutcome.message = result.message
          await log(
            campaign.id,
            'auto_confirm',
            result.status === 'done' ? 'success' : result.status,
            result.message,
            campaignAccount.account?.id
          )
        })

        const resultMessage =
          attempt.status !== 'done'
            ? attempt.reason
            : confirmOutcome.message
        const wasSuccessful = attempt.status === 'done' && confirmOutcome.status === 'done'
        const wasSkipped = attempt.status === 'done' && confirmOutcome.status === 'skipped'
        const wasFailed = !wasSuccessful && !wasSkipped

        await updateRuntime(
          {
            processedTargets: runtime.processedTargets + 1,
            successCount:
              runtime.successCount +
              (wasSuccessful ? 1 : 0),
            failedCount:
              runtime.failedCount +
              (wasFailed ? 1 : 0),
            skippedCount:
              runtime.skippedCount +
              (wasSkipped ? 1 : 0),
            currentAction: 'auto_confirm',
            currentLabel: resultMessage,
            runningCount: Math.max(0, activeBatches - 1),
          },
          {
            completedBatches: completedBatches + 1,
            activeBatches: Math.max(0, activeBatches - 1),
          }
        )

        activeBatches = Math.max(0, activeBatches - 1)
        completedBatches++
      })
    } else if (campaign.type === 'auto_invite') {
      if (!accounts.length) throw new Error('Campaign auto invite membutuhkan minimal 1 akun.')

      const config = (campaign.config as any) ?? {}
      const targetProfiles = campaign.profiles
        .map((row) => ({
          campaignProfileId: row.id,
          facebookProfileId: row.profile?.id ?? row.profileId,
          profileId: row.profile?.profileId ?? row.profileId,
          profileUrl: row.profile?.profileUrl ?? null,
          profileName: row.profile?.profileName ?? row.profile?.profileId ?? row.profileId,
        }))
        .filter((profile) => Boolean(profile.profileName))

      if (!config.url) {
        throw new Error('Campaign auto invite membutuhkan URL target invite.')
      }

      if (!targetProfiles.length) {
        throw new Error('Campaign auto invite membutuhkan profile target dari profile pool.')
      }

      const chunks = distribute(targetProfiles, accounts.length)
      const assignments = accounts.map((account, index) => ({ account, profiles: chunks[index] ?? [] }))
      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'profile',
          totalTargets: targetProfiles.length,
          processedTargets: 0,
          successCount: 0,
          failedCount: 0,
          skippedCount: 0,
          totalBatches: assignments.length,
          currentAction: 'auto_invite',
          currentLabel: `Menyiapkan ${assignments.length} batch akun untuk auto invite.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(
        assignments,
        campaign.maxConcurrency,
        async ({ account: campaignAccount, profiles }) => {
          batchCursor++
          const batchNumber = batchCursor
          activeBatches++

          await updateRuntime(
            {
              currentBatch: batchNumber,
              currentAccountId: campaignAccount.account?.id ?? null,
              currentAction: 'auto_invite',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
              runningCount: activeBatches,
            },
            {
              batchLabel: `Batch akun ${batchNumber}/${assignments.length}`,
              currentAccountLabel: campaignAccount.account?.label ?? null,
              completedBatches,
              activeBatches,
            }
          )

          await withAccount(campaignAccount, async (page) => {
            for (const targetProfile of profiles) {
              await updateRuntime(
                {
                  currentAction: 'auto_invite',
                  currentLabel: `Memproses invite ${targetProfile.profileName}.`,
                  runningCount: activeBatches,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              const result = await runAutoInvite(
                page,
                {
                  profileId: targetProfile.profileId,
                  profileUrl: targetProfile.profileUrl,
                  profileName: targetProfile.profileName,
                },
                config
              )

              const campaignProfile =
                campaign.profiles.find((row) => row.id === targetProfile.campaignProfileId) ??
                (await CampaignProfile.find(targetProfile.campaignProfileId))
              if (campaignProfile) {
                campaignProfile.status =
                  result.status === 'done'
                    ? 'done'
                    : result.status === 'skipped'
                      ? 'skipped'
                      : 'failed'
                await campaignProfile.save()
              }

              await log(
                campaign.id,
                'auto_invite',
                result.status === 'done' ? 'success' : result.status,
                result.message,
                campaignAccount.account?.id
              )
              await updateProfileLifecycle(targetProfile.facebookProfileId, {
                lifecycleStatus:
                  result.status === 'done' ? 'invited' : result.status === 'failed' ? 'failed' : undefined,
                lastAction: 'auto_invite',
                lastActionStatus: result.status === 'done' ? 'success' : result.status,
                lastActionMessage: result.message,
              })

              await updateRuntime(
                {
                  processedTargets: runtime.processedTargets + 1,
                  successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
                  failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
                  skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
                  currentAction: 'auto_invite',
                  currentLabel: result.message,
                },
                {
                  currentGroupName: targetProfile.profileName,
                  currentGroupCode: targetProfile.profileId,
                }
              )

              await humanDelay(campaign.maxDelayMs)
            }
          })

          activeBatches = Math.max(0, activeBatches - 1)
          completedBatches++
          await updateRuntime(
            {
              runningCount: activeBatches,
              currentAction: 'auto_invite',
              currentLabel: `Batch akun ${batchNumber}/${assignments.length} selesai.`,
            },
            {
              completedBatches,
              activeBatches,
            }
          )
        }
      )
    } else {
      const config = (campaign.config as any) ?? {}
      const groupTargets = campaign.groups.map((campaignGroup) => ({
        campaignGroup,
        dbGroupId: campaignGroup.group?.id ?? campaignGroup.groupId,
        groupId: campaignGroup.group?.groupId ?? campaignGroup.groupId,
        groupUrl: campaignGroup.group?.groupUrl ?? null,
        groupName: campaignGroup.group?.groupName ?? campaignGroup.group?.groupId ?? campaignGroup.groupId,
        memberCount: campaignGroup.group?.memberCount ?? null,
        isManual: false,
      }))
      const manualGroupUrl =
        campaign.type === 'auto_post' ? String(config.manualGroupUrl ?? '').trim() : ''
      const manualTargets = manualGroupUrl
        ? [
            {
              campaignGroup: null,
              dbGroupId: null,
              groupId: 'manual-group-url',
              groupUrl: manualGroupUrl,
              groupName: 'Manual Group URL',
              memberCount: null,
              isManual: true,
            },
          ]
        : []
      const runTargets = [...groupTargets, ...manualTargets].filter((target, index, allTargets) => {
        const identity = target.groupUrl || target.groupId
        return allTargets.findIndex((item) => (item.groupUrl || item.groupId) === identity) === index
      })
      // Distribute the group list across accounts (chunked), then run accounts
      // in parallel up to maxConcurrency — so each group is handled once.
      const chunks = distribute(runTargets, accounts.length)
      const assignments = accounts.map((account, i) => ({ account, groups: chunks[i] ?? [] }))
      let batchCursor = 0
      let completedBatches = 0
      let activeBatches = 0

      await updateRuntime(
        {
          targetType: 'group',
          totalTargets: runTargets.length,
          totalBatches: assignments.length,
          currentAction: campaign.type,
          currentLabel: `Menyiapkan ${assignments.length} batch akun.`,
        },
        {
          completedBatches: 0,
          activeBatches: 0,
        }
      )

      await runPool(
        assignments,
        campaign.maxConcurrency,
        async ({ account: campaignAccount, groups: assignedTargets }) => {
          batchCursor++
          const batchNumber = batchCursor
          activeBatches++
          let joinsThisRun = 0
          const dailyLimit = campaign.type === 'auto_join' ? Number(config.dailyJoinLimit ?? 0) : 0
          const priorJoins =
            dailyLimit > 0 && campaignAccount.account
              ? await countTodayJoins(campaignAccount.account.id)
              : 0

          await updateRuntime(
            {
              currentBatch: batchNumber,
              currentAccountId: campaignAccount.account?.id ?? null,
              currentAction: campaign.type,
              currentLabel: `Batch akun ${batchNumber}/${assignments.length}: ${campaignAccount.account?.label ?? 'Akun'}.`,
              runningCount: activeBatches,
            },
            {
              batchLabel: `Batch akun ${batchNumber}/${assignments.length}`,
              currentAccountLabel: campaignAccount.account?.label ?? null,
              completedBatches,
              activeBatches,
            }
          )

          await withAccount(campaignAccount, async (page) => {
            for (const targetGroup of assignedTargets) {
              const groupName = targetGroup.groupName ?? targetGroup.groupId

              await updateRuntime(
                {
                  currentGroupId: targetGroup.dbGroupId,
                  currentAction: campaign.type,
                  currentLabel: `${
                    campaign.type === 'auto_share'
                      ? 'Auto share'
                      : campaign.type === 'auto_post'
                        ? 'Auto post'
                        : 'Auto join'
                  } ${groupName}.`,
                  runningCount: activeBatches,
                },
                {
                  currentGroupName: groupName,
                  currentGroupCode: targetGroup.groupId,
                }
              )

              if (dailyLimit > 0 && priorJoins + joinsThisRun >= dailyLimit) {
                await log(
                  campaign.id,
                  'auto_join',
                  'skipped',
                  `Batas join harian (${dailyLimit}) tercapai.`,
                  campaignAccount.account?.id,
                  targetGroup.dbGroupId
                )
                await updateRuntime({
                  currentAction: campaign.type,
                  currentLabel: `Batas join harian (${dailyLimit}) tercapai untuk "${campaignAccount.account?.label ?? 'akun'}".`,
                })
                break
              }
              if (!targetGroup.isManual && !passesMinGroupMember(targetGroup.memberCount, campaign.minGroupMember)) {
                if (targetGroup.campaignGroup) {
                  targetGroup.campaignGroup.status = 'skipped'
                  targetGroup.campaignGroup.processedAt = DateTime.now()
                  await targetGroup.campaignGroup.save()
                }
                await log(
                  campaign.id,
                  campaign.type,
                  'skipped',
                  targetGroup.memberCount === null
                    ? `Dilewati karena member count belum tersedia, minimum ${campaign.minGroupMember}.`
                    : `Dilewati karena member ${targetGroup.memberCount} di bawah minimum ${campaign.minGroupMember}.`,
                  campaignAccount.account?.id,
                  targetGroup.dbGroupId
                )
                await updateRuntime({
                  processedTargets: runtime.processedTargets + 1,
                  skippedCount: runtime.skippedCount + 1,
                  currentLabel:
                    targetGroup.memberCount === null
                      ? `Lewati ${groupName}: member count belum tersedia.`
                      : `Lewati ${groupName}: member ${targetGroup.memberCount} di bawah minimum.`,
                })
                continue
              }

              const target = { groupId: targetGroup.groupId, groupUrl: targetGroup.groupUrl }
              let result =
                campaign.type === 'auto_share'
                  ? await runAutoShare(page, target, config)
                  : campaign.type === 'auto_post'
                    ? await runAutoPost(page, target, config)
                  : await runAutoJoin(page, target)

              // Retry failed share/post runs (config.retryFailed), up to 3 attempts total.
              let attempts = 1
              while (
                (campaign.type === 'auto_share' || campaign.type === 'auto_post') &&
                result.status === 'failed' &&
                config.retryFailed &&
                attempts < 3
              ) {
                await humanDelay(campaign.maxDelayMs)
                result =
                  campaign.type === 'auto_post'
                    ? await runAutoPost(page, target, config)
                    : await runAutoShare(page, target, config)
                attempts++
              }

              if (campaign.type === 'auto_join' && result.status === 'done') joinsThisRun++

              if (targetGroup.campaignGroup) {
                targetGroup.campaignGroup.status =
                  result.status === 'done'
                    ? 'done'
                    : result.status === 'skipped'
                      ? 'skipped'
                      : 'failed'
                targetGroup.campaignGroup.processedAt = DateTime.now()
                await targetGroup.campaignGroup.save()
              }

              await log(
                campaign.id,
                campaign.type,
                result.status === 'done' ? 'success' : result.status,
                attempts > 1 ? `${result.message} (percobaan ${attempts})` : result.message,
                campaignAccount.account?.id,
                targetGroup.dbGroupId
              )
              await updateRuntime({
                processedTargets: runtime.processedTargets + 1,
                successCount: runtime.successCount + (result.status === 'done' ? 1 : 0),
                failedCount: runtime.failedCount + (result.status === 'failed' ? 1 : 0),
                skippedCount: runtime.skippedCount + (result.status === 'skipped' ? 1 : 0),
                currentLabel:
                  attempts > 1 ? `${result.message} (percobaan ${attempts})` : result.message,
              })
              await humanDelay(campaign.maxDelayMs)
            }
          })

          activeBatches = Math.max(0, activeBatches - 1)
          completedBatches++
          await updateRuntime(
            {
              runningCount: activeBatches,
              currentAction: campaign.type,
              currentLabel: `Batch akun ${batchNumber}/${assignments.length} selesai.`,
            },
            {
              completedBatches,
              activeBatches,
            }
          )
        }
      )
    }
    campaign.status = 'completed'
  } catch (error) {
    hadError = true
    campaign.status = 'failed'
    await updateRuntime({
      status: 'failed',
      runningCount: 0,
      currentAction: 'campaign_error',
      currentLabel: (error as Error).message,
    })
    await log(campaign.id, 'campaign_error', 'failed', (error as Error).message)
    await notify('campaign_error', 'failed', (error as Error).message, {
      campaignStatus: 'failed',
    })
  }

  campaign.endedAt = DateTime.now()
  await campaign.save()
  await updateRuntime({
    status: campaign.status,
    runningCount: 0,
    currentAction: 'campaign_end',
    currentLabel: `Selesai — status: ${campaign.status}.`,
  })
  await log(
    campaign.id,
    'campaign_end',
    hadError ? 'failed' : 'success',
    `Selesai — status: ${campaign.status}.`
  )
  await notify(
    'campaign_end',
    hadError ? 'failed' : 'success',
    `Selesai — status: ${campaign.status}.`,
    {
      campaignStatus: campaign.status,
    }
  )
}
