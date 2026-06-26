import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { GROUP_DETAIL_FIXTURE } from '#services/fixtures/smoke_fixtures'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

type Flags = {
  userId?: string
  reset: boolean
}

const FIXTURE_KEY = GROUP_DETAIL_FIXTURE.key
const FIXTURE_GROUP_ID = GROUP_DETAIL_FIXTURE.detailGroupId
const FIXTURE_GROUP_NAME = GROUP_DETAIL_FIXTURE.detailGroupName
const FIXTURE_SMALL_GROUP_ID = GROUP_DETAIL_FIXTURE.smallGroupId
const FIXTURE_SMALL_GROUP_NAME = GROUP_DETAIL_FIXTURE.smallGroupName
const FIXTURE_CAMPAIGNS = GROUP_DETAIL_FIXTURE.campaignSeeds
const FIXTURE_ACCOUNTS = GROUP_DETAIL_FIXTURE.accountSeeds

export default class GroupsSeedDetailFixture extends BaseCommand {
  static commandName = 'groups:seed-detail-fixture'
  static description = 'Siapkan fixture aman untuk smoke test deterministik halaman groups/:id'
  static options: CommandOptions = { startApp: true }

  private parseFlags(): Flags {
    const parsedFlags = ((this as any).parsed?.flags ?? {}) as Record<string, unknown>
    const userIdValue = parsedFlags.userId ?? parsedFlags['user-id']
    const resetValue = parsedFlags.reset ?? parsedFlags['reset']

    return {
      userId: typeof userIdValue === 'string' ? userIdValue : undefined,
      reset: Boolean(resetValue),
    }
  }

  async run() {
    const flags = this.parseFlags()
    if (!flags.userId) {
      this.logger.error('Flag --user-id wajib diisi agar fixture tidak salah masuk ke user lain.')
      return
    }

    const { default: User } = await import('#models/user')
    const { default: FacebookGroup } = await import('#models/facebook_group')
    const { default: FacebookAccount } = await import('#models/facebook_account')
    const { default: Campaign } = await import('#models/campaign')
    const { default: CampaignGroup } = await import('#models/campaign_group')
    const { default: CampaignAccount } = await import('#models/campaign_account')
    const { default: SessionLog } = await import('#models/session_log')

    const user = await User.find(flags.userId)
    if (!user) {
      this.logger.error(`User ${flags.userId} tidak ditemukan.`)
      return
    }

    let detailGroupId = ''

    await db.transaction(async (trx) => {
      const group =
        (await FacebookGroup.query({ client: trx })
          .where('user_id', user.id)
          .where('group_id', FIXTURE_GROUP_ID)
          .first()) ??
        (await FacebookGroup.create(
          {
            userId: user.id,
            groupId: FIXTURE_GROUP_ID,
            groupName: FIXTURE_GROUP_NAME,
            groupUrl: `https://www.facebook.com/groups/${FIXTURE_GROUP_ID}`,
            groupType: 'public',
            memberCount: 25432,
            sourceType: 'keyword',
            sourceKeyword: 'fixture group detail',
            sourceFriendUrl: null,
            tags: [FIXTURE_KEY, 'smoke-test', 'analytics'],
          },
          { client: trx }
        ))

      group.merge({
        groupName: FIXTURE_GROUP_NAME,
        groupUrl: `https://www.facebook.com/groups/${FIXTURE_GROUP_ID}`,
        groupType: 'public',
        memberCount: 25432,
        sourceType: 'keyword',
        sourceKeyword: 'fixture group detail',
        sourceFriendUrl: null,
        tags: [FIXTURE_KEY, 'smoke-test', 'analytics'],
      })
      await group.save()
      detailGroupId = group.id

      const smallGroup =
        (await FacebookGroup.query({ client: trx })
          .where('user_id', user.id)
          .where('group_id', FIXTURE_SMALL_GROUP_ID)
          .first()) ??
        (await FacebookGroup.create(
          {
            userId: user.id,
            groupId: FIXTURE_SMALL_GROUP_ID,
            groupName: FIXTURE_SMALL_GROUP_NAME,
            groupUrl: `https://www.facebook.com/groups/${FIXTURE_SMALL_GROUP_ID}`,
            groupType: 'private',
            memberCount: 10,
            sourceType: 'keyword',
            sourceKeyword: 'fixture min group member',
            sourceFriendUrl: null,
            tags: [FIXTURE_KEY, 'smoke-test', 'minimum-group-member'],
          },
          { client: trx }
        ))

      smallGroup.merge({
        groupName: FIXTURE_SMALL_GROUP_NAME,
        groupUrl: `https://www.facebook.com/groups/${FIXTURE_SMALL_GROUP_ID}`,
        groupType: 'private',
        memberCount: 10,
        sourceType: 'keyword',
        sourceKeyword: 'fixture min group member',
        sourceFriendUrl: null,
        tags: [FIXTURE_KEY, 'smoke-test', 'minimum-group-member'],
      })
      await smallGroup.save()

      const accounts = []
      for (const accountSeed of FIXTURE_ACCOUNTS) {
        const account =
          (await FacebookAccount.query({ client: trx })
            .where('user_id', user.id)
            .where('label', accountSeed.label)
            .first()) ??
          (await FacebookAccount.create(
            {
              userId: user.id,
              label: accountSeed.label,
              fbUserId: accountSeed.fbUserId,
              sessionStatus: accountSeed.sessionStatus,
              notes: `Fixture ${FIXTURE_KEY}`,
              profileUrl: null,
            },
            { client: trx }
          ))

        account.merge({
          fbUserId: accountSeed.fbUserId,
          sessionStatus: accountSeed.sessionStatus,
          notes: `Fixture ${FIXTURE_KEY}`,
          profileUrl: null,
          lastUsedAt: DateTime.now().minus({ hours: accounts.length + 1 }),
        })
        await account.save()
        accounts.push(account)
      }

      const campaigns = []
      for (const [index, campaignSeed] of FIXTURE_CAMPAIGNS.entries()) {
        const campaign =
          (await Campaign.query({ client: trx })
            .where('user_id', user.id)
            .where('name', campaignSeed.name)
            .first()) ??
          (await Campaign.create(
            {
              userId: user.id,
              name: campaignSeed.name,
              type: campaignSeed.type,
              status: campaignSeed.status,
              config:
                campaignSeed.type === 'auto_share'
                  ? { url: 'https://example.com/fixture', caption: 'Fixture smoke test' }
                  : { dailyJoinLimit: 5 },
              targetGroupType: 'public',
              useProxy: false,
              maxConcurrency: 1,
              maxAccounts: 2,
              maxDelayMs: 1500,
              maxTargets: 10,
              headless: true,
              advanceMode: false,
              minGroupMember: 1000,
              startedAt: DateTime.now().minus({ hours: 6 - index }),
              endedAt:
                campaignSeed.status === 'completed'
                  ? DateTime.now().minus({ hours: 5 - index })
                  : null,
            },
            { client: trx }
          ))

        campaign.merge({
          type: campaignSeed.type,
          status: campaignSeed.status,
          config:
            campaignSeed.type === 'auto_share'
              ? { url: 'https://example.com/fixture', caption: 'Fixture smoke test' }
              : { dailyJoinLimit: 5 },
          targetGroupType: 'public',
          useProxy: false,
          maxConcurrency: 1,
          maxAccounts: 2,
          maxDelayMs: 1500,
          maxTargets: 10,
          headless: true,
          advanceMode: false,
          minGroupMember: 1000,
          startedAt: DateTime.now().minus({ hours: 6 - index }),
          endedAt:
            campaignSeed.status === 'completed' ? DateTime.now().minus({ hours: 5 - index }) : null,
        })
        await campaign.save()
        campaigns.push(campaign)
      }

      if (flags.reset) {
        await SessionLog.query({ client: trx })
          .whereIn(
            'campaign_id',
            campaigns.map((campaign) => campaign.id)
          )
          .where('worker_id', FIXTURE_KEY)
          .delete()
      }

      await CampaignGroup.query({ client: trx })
        .whereIn(
          'campaign_id',
          campaigns.map((campaign) => campaign.id)
        )
        .delete()
      await CampaignAccount.query({ client: trx })
        .whereIn(
          'campaign_id',
          campaigns.map((campaign) => campaign.id)
        )
        .delete()

      for (const campaign of campaigns) {
        await CampaignGroup.create(
          {
            campaignId: campaign.id,
            groupId: group.id,
            status: campaign.status === 'completed' ? 'done' : 'pending',
            processedAt:
              campaign.status === 'completed'
                ? DateTime.now().minus({ hours: 4 })
                : DateTime.now().minus({ hours: 1 }),
          },
          { client: trx }
        )

        for (const [index, account] of accounts.entries()) {
          await CampaignAccount.create(
            {
              campaignId: campaign.id,
              accountId: account.id,
              status: index === 0 ? 'done' : campaign.status === 'completed' ? 'done' : 'running',
            },
            { client: trx }
          )
        }
      }

      await SessionLog.query({ client: trx })
        .whereIn(
          'campaign_id',
          campaigns.map((campaign) => campaign.id)
        )
        .where('worker_id', FIXTURE_KEY)
        .delete()

      const now = DateTime.now()
      const logs = [
        {
          campaignId: campaigns[0].id,
          accountId: accounts[0].id,
          action: 'auto_share',
          status: 'success',
          message: 'Fixture share success ke group.',
          durationMs: 2100,
          createdAt: now.minus({ hours: 4, minutes: 40 }),
        },
        {
          campaignId: campaigns[0].id,
          accountId: accounts[1].id,
          action: 'auto_share',
          status: 'failed',
          message: 'Fixture share gagal karena rate limit.',
          durationMs: 3400,
          createdAt: now.minus({ hours: 4, minutes: 5 }),
        },
        {
          campaignId: campaigns[1].id,
          accountId: accounts[0].id,
          action: 'auto_join',
          status: 'checkpoint',
          message: 'Fixture checkpoint saat verifikasi join.',
          durationMs: 1850,
          createdAt: now.minus({ hours: 1, minutes: 25 }),
        },
        {
          campaignId: campaigns[1].id,
          accountId: accounts[1].id,
          action: 'auto_join',
          status: 'success',
          message: 'Fixture join request berhasil dikirim.',
          durationMs: 1620,
          createdAt: now.minus({ hours: 1, minutes: 10 }),
        },
      ]

      for (const row of logs) {
        await SessionLog.create(
          {
            campaignId: row.campaignId,
            accountId: row.accountId,
            groupId: group.id,
            action: row.action,
            status: row.status,
            message: row.message,
            durationMs: row.durationMs,
            workerId: FIXTURE_KEY,
            createdAt: row.createdAt,
          },
          { client: trx }
        )
      }
    })

    this.logger.success('Fixture group detail siap dipakai.')
    this.logger.info(`User        : ${user.id} (${user.email})`)
    this.logger.info(`Group URL   : /groups/${detailGroupId}`)
    this.logger.info(`Fixture Key : ${FIXTURE_KEY}`)
  }
}

GroupsSeedDetailFixture.defineFlag('userId', {
  type: 'string',
  flagName: 'user-id',
  description: 'User target yang akan menerima fixture smoke test',
})

GroupsSeedDetailFixture.defineFlag('reset', {
  type: 'boolean',
  flagName: 'reset',
  description: 'Reset ulang relasi/log fixture sebelum membuat dataset baru',
})
