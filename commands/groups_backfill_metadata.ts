import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

type Flags = {
  userId?: string
  accountId?: string
  groupId?: string
  limit: number
  headed: boolean
}

export default class GroupsBackfillMetadata extends BaseCommand {
  static commandName = 'groups:backfill-metadata'
  static description =
    'Isi group_name, member_count, dan koreksi group_type untuk facebook_groups yang perlu dirapikan'
  static options: CommandOptions = { startApp: true }

  private shouldRefreshGroupName(currentName: string | null, nextName: string | null, force: boolean) {
    if (nextName === null) return false
    if (force) return currentName !== nextName
    if (currentName === null) return true
    return /^foto profil\b/i.test(currentName) && currentName !== nextName
  }

  private shouldRefreshMemberCount(
    currentMemberCount: number | null,
    nextMemberCount: number | null,
    force: boolean
  ) {
    if (nextMemberCount === null) return false
    return force ? currentMemberCount !== nextMemberCount : currentMemberCount === null
  }

  private parseFlags(): Flags {
    const parsedFlags = ((this as any).parsed?.flags ?? {}) as Record<string, unknown>
    const userIdValue = parsedFlags.userId ?? parsedFlags['user-id']
    const accountIdValue = parsedFlags.accountId ?? parsedFlags['account-id']
    const groupIdValue = parsedFlags.groupId ?? parsedFlags['group-id']
    const limitValue =
      typeof parsedFlags.limit === 'number'
        ? parsedFlags.limit
        : Number.parseInt(String(parsedFlags.limit ?? '25'), 10)

    return {
      userId: typeof userIdValue === 'string' ? userIdValue : undefined,
      accountId: typeof accountIdValue === 'string' ? accountIdValue : undefined,
      groupId: typeof groupIdValue === 'string' ? groupIdValue : undefined,
      limit: Number.isFinite(limitValue) && limitValue > 0 ? limitValue : 25,
      headed: Boolean(parsedFlags.headed),
    }
  }

  async run() {
    const flags = this.parseFlags()
    const { default: FacebookGroup } = await import('#models/facebook_group')
    const { default: FacebookAccount } = await import('#models/facebook_account')
    const { loadPlaywrightCookies } = await import('#services/automation/cookie_loader')
    const { launchSession, verifySession, closeSession } =
      await import('#services/automation/browser_session')
    const { extractGroupMetadataFromPage } = await import('#services/automation/handlers')
    const { humanDelay } = await import('#services/automation/human')

    let userId = flags.userId
    let account =
      flags.accountId
        ? await FacebookAccount.query().where('id', flags.accountId!).first()
        : null

    if (!account && !userId) {
      const rows = await FacebookGroup.query()
        .where((query) => query.whereNull('group_name').orWhereNull('member_count'))
        .select('user_id')

      const userIds = Array.from(new Set(rows.map((row) => row.userId)))

      if (userIds.length === 0) {
        this.logger.info('Tidak ada group yang perlu dibackfill.')
        return
      }

      if (userIds.length > 1) {
        this.logger.error(
          'Ditemukan group kosong milik beberapa user. Jalankan lagi dengan --user-id atau --account-id.'
        )
        return
      }

      userId = userIds[0]
    }

    if (!account) {
      account =
        (await FacebookAccount.query()
          .where('user_id', userId!)
          .whereNot('session_status', 'logged_out')
          .orderBy('last_used_at', 'desc')
          .first()) ??
        (await FacebookAccount.query()
          .where('user_id', userId!)
          .orderBy('last_used_at', 'desc')
          .first())
    }

    if (!account) {
      this.logger.error('Tidak ditemukan akun Facebook yang bisa dipakai untuk backfill.')
      return
    }

    const groupsQuery = FacebookGroup.query().where('user_id', account.userId).orderBy('updated_at', 'asc')

    if (flags.groupId) {
      groupsQuery.where('group_id', flags.groupId)
    } else {
      groupsQuery.where((query) => query.whereNull('group_name').orWhereNull('member_count'))
    }

    const groups = await groupsQuery.limit(flags.limit)

    if (!groups.length) {
      this.logger.info('Tidak ada row group yang cocok untuk dibackfill.')
      return
    }

    const cookies = await loadPlaywrightCookies(account.id)
    if (!cookies.length) {
      this.logger.error(`Akun "${account.label}" tidak punya cookies yang bisa dipakai.`)
      return
    }

    this.logger.info(
      `Menyiapkan backfill ${groups.length} group memakai akun "${account.label}" (${flags.headed ? 'headed' : 'headless'}).`
    )

    const session = await launchSession({
      cookies,
      headless: !flags.headed,
    })

    let updated = 0
    let skipped = 0
    let failed = 0

    try {
      const state = await verifySession(session.page)
      if (state !== 'active') {
        this.logger.error(`Session akun tidak aktif: ${state}. Login ulang akun lalu coba lagi.`)
        return
      }

      for (const group of groups) {
        try {
          const metadata = await extractGroupMetadataFromPage(session.page, {
            groupId: group.groupId,
            groupUrl: group.groupUrl,
          })
          const forceRefresh = Boolean(flags.groupId)

          const updates: {
            groupName?: string
            memberCount?: number
            groupType?: 'public' | 'private'
          } = {}
          if (this.shouldRefreshGroupName(group.groupName, metadata.groupName, forceRefresh))
            updates.groupName = metadata.groupName!
          if (this.shouldRefreshMemberCount(group.memberCount, metadata.memberCount, forceRefresh))
            updates.memberCount = metadata.memberCount!
          if (metadata.groupType !== null && metadata.groupType !== group.groupType)
            updates.groupType = metadata.groupType

          if (Object.keys(updates).length === 0) {
            skipped++
            this.logger.info(`skip ${group.groupId} — metadata masih belum terbaca.`)
          } else {
            group.merge(updates)
            await group.save()
            updated++
            this.logger.info(
              `update ${group.groupId} — type=${group.groupType} name=${group.groupName ?? '-'} members=${group.memberCount ?? '-'}`
            )
          }
        } catch (error) {
          failed++
          this.logger.error(
            `fail ${group.groupId} — ${error instanceof Error ? error.message : String(error)}`
          )
        }

        await humanDelay(1500)
      }
    } finally {
      await closeSession(session)
    }

    this.logger.info(`Selesai. updated=${updated}, skipped=${skipped}, failed=${failed}`)
  }
}

GroupsBackfillMetadata.defineFlag('userId', {
  type: 'string',
  flagName: 'user-id',
  description: 'Batasi backfill ke user tertentu',
})

GroupsBackfillMetadata.defineFlag('accountId', {
  type: 'string',
  flagName: 'account-id',
  description: 'Pilih akun Facebook tertentu untuk dipakai saat backfill',
})

GroupsBackfillMetadata.defineFlag('groupId', {
  type: 'string',
  flagName: 'group-id',
  description: 'Backfill hanya untuk satu Facebook group tertentu',
})

GroupsBackfillMetadata.defineFlag('limit', {
  type: 'number',
  flagName: 'limit',
  description: 'Jumlah maksimum row group yang diproses dalam satu run',
})

GroupsBackfillMetadata.defineFlag('headed', {
  type: 'boolean',
  flagName: 'headed',
  description: 'Jalankan browser Playwright dalam mode headed',
})
