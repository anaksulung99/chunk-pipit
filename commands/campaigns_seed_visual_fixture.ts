import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { CAMPAIGN_VISUAL_FIXTURE } from '#services/fixtures/smoke_fixtures'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

type Flags = {
  userId?: string
  reset: boolean
}

export default class CampaignsSeedVisualFixture extends BaseCommand {
  static commandName = 'campaigns:seed-visual-fixture'
  static description = 'Siapkan fixture aman untuk smoke test visual halaman campaigns/:id'
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

    let campaignId = ''

    await db.transaction(async (trx) => {
      const group =
        (await FacebookGroup.query({ client: trx })
          .where('user_id', user.id)
          .where('group_id', CAMPAIGN_VISUAL_FIXTURE.groupId)
          .first()) ??
        (await FacebookGroup.create(
          {
            userId: user.id,
            groupId: CAMPAIGN_VISUAL_FIXTURE.groupId,
            groupName: CAMPAIGN_VISUAL_FIXTURE.groupName,
            groupUrl: `https://www.facebook.com/groups/${CAMPAIGN_VISUAL_FIXTURE.groupId}`,
            groupType: 'public',
            memberCount: 128450,
            sourceType: 'keyword',
            sourceKeyword: 'visual fixture campaign',
            tags: [...CAMPAIGN_VISUAL_FIXTURE.groupTags, CAMPAIGN_VISUAL_FIXTURE.key],
          },
          { client: trx }
        ))

      group.merge({
        groupName: CAMPAIGN_VISUAL_FIXTURE.groupName,
        groupUrl: `https://www.facebook.com/groups/${CAMPAIGN_VISUAL_FIXTURE.groupId}`,
        groupType: 'public',
        memberCount: 128450,
        sourceType: 'keyword',
        sourceKeyword: 'visual fixture campaign',
        tags: [...CAMPAIGN_VISUAL_FIXTURE.groupTags, CAMPAIGN_VISUAL_FIXTURE.key],
      })
      await group.save()

      const accounts = []
      for (const [index, accountSeed] of CAMPAIGN_VISUAL_FIXTURE.accountSeeds.entries()) {
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
              notes: `Fixture ${CAMPAIGN_VISUAL_FIXTURE.key}`,
            },
            { client: trx }
          ))

        account.merge({
          fbUserId: accountSeed.fbUserId,
          sessionStatus: accountSeed.sessionStatus,
          notes: `Fixture ${CAMPAIGN_VISUAL_FIXTURE.key}`,
          lastUsedAt: DateTime.now().minus({ minutes: 40 - index * 10 }),
        })
        await account.save()
        accounts.push(account)
      }

      const campaign =
        (await Campaign.query({ client: trx })
          .where('user_id', user.id)
          .where('name', CAMPAIGN_VISUAL_FIXTURE.campaignSeed.name)
          .first()) ??
        (await Campaign.create(
          {
            userId: user.id,
            name: CAMPAIGN_VISUAL_FIXTURE.campaignSeed.name,
            type: CAMPAIGN_VISUAL_FIXTURE.campaignSeed.type,
            status: CAMPAIGN_VISUAL_FIXTURE.campaignSeed.status,
            config: {
              sourceType: 'keyword',
              keyword: 'Grey Anatomy',
              groupTags: CAMPAIGN_VISUAL_FIXTURE.groupTags,
            },
            targetGroupType: 'public',
            useProxy: false,
            maxConcurrency: 1,
            maxAccounts: 2,
            maxDelayMs: 1500,
            maxTargets: 30,
            headless: true,
            advanceMode: false,
            minGroupMember: 50000,
            startedAt: DateTime.now().minus({ minutes: 18 }),
            endedAt: DateTime.now().minus({ minutes: 12 }),
          },
          { client: trx }
        ))

      campaign.merge({
        type: CAMPAIGN_VISUAL_FIXTURE.campaignSeed.type,
        status: CAMPAIGN_VISUAL_FIXTURE.campaignSeed.status,
        config: {
          sourceType: 'keyword',
          keyword: 'Grey Anatomy',
          groupTags: CAMPAIGN_VISUAL_FIXTURE.groupTags,
        },
        targetGroupType: 'public',
        useProxy: false,
        maxConcurrency: 1,
        maxAccounts: 2,
        maxDelayMs: 1500,
        maxTargets: 30,
        headless: true,
        advanceMode: false,
        minGroupMember: 50000,
        startedAt: DateTime.now().minus({ minutes: 18 }),
        endedAt: DateTime.now().minus({ minutes: 12 }),
      })
      await campaign.save()
      campaignId = campaign.id

      if (flags.reset) {
        await SessionLog.query({ client: trx })
          .where('campaign_id', campaign.id)
          .where('worker_id', CAMPAIGN_VISUAL_FIXTURE.key)
          .delete()
      }

      await CampaignGroup.query({ client: trx }).where('campaign_id', campaign.id).delete()
      await CampaignAccount.query({ client: trx }).where('campaign_id', campaign.id).delete()

      await CampaignGroup.create(
        {
          campaignId: campaign.id,
          groupId: group.id,
          status: 'done',
          processedAt: DateTime.now().minus({ minutes: 12 }),
        },
        { client: trx }
      )

      await CampaignAccount.createMany(
        [
          { campaignId: campaign.id, accountId: accounts[0].id, status: 'error' },
          { campaignId: campaign.id, accountId: accounts[1].id, status: 'done' },
        ],
        { client: trx }
      )

      await SessionLog.query({ client: trx })
        .where('campaign_id', campaign.id)
        .where('worker_id', CAMPAIGN_VISUAL_FIXTURE.key)
        .delete()

      const now = DateTime.now()
      const logs = [
        {
          accountId: accounts[0].id,
          action: 'session_verify',
          status: 'checkpoint' as const,
          message: `Akun "${accounts[0].label}" tidak aktif: logged_out.`,
          createdAt: now.minus({ minutes: 17 }),
        },
        {
          accountId: accounts[0].id,
          action: 'scrape_fallback',
          status: 'checkpoint' as const,
          message: `Akun "${accounts[0].label}" tidak aktif: logged_out. Coba lanjut ke akun berikutnya.`,
          createdAt: now.minus({ minutes: 16 }),
        },
        {
          accountId: accounts[1].id,
          action: 'session_prepare',
          status: 'success' as const,
          message: `10 cookie didekripsi untuk "${accounts[1].label}".`,
          createdAt: now.minus({ minutes: 15 }),
          durationMs: 620,
        },
        {
          accountId: accounts[1].id,
          groupId: group.id,
          action: 'scrape',
          status: 'success' as const,
          message:
            '12 group disimpan. 1 dilewati karena tipe group, 3 dilewati karena minimum member, 0 dilewati karena nama group kosong.',
          createdAt: now.minus({ minutes: 12 }),
          durationMs: 4380,
        },
      ]

      for (const row of logs) {
        await SessionLog.create(
          {
            campaignId: campaign.id,
            accountId: row.accountId,
            groupId: row.groupId ?? null,
            action: row.action,
            status: row.status,
            message: row.message,
            durationMs: row.durationMs ?? null,
            workerId: CAMPAIGN_VISUAL_FIXTURE.key,
            createdAt: row.createdAt,
          },
          { client: trx }
        )
      }
    })

    this.logger.success('Fixture visual campaign siap dipakai.')
    this.logger.info(`User        : ${user.id} (${user.email})`)
    this.logger.info(`Campaign URL: /campaigns/${campaignId}`)
    this.logger.info(`Fixture Key : ${CAMPAIGN_VISUAL_FIXTURE.key}`)
  }
}

CampaignsSeedVisualFixture.defineFlag('userId', {
  type: 'string',
  flagName: 'user-id',
  description: 'User target yang akan menerima fixture visual campaign',
})

CampaignsSeedVisualFixture.defineFlag('reset', {
  type: 'boolean',
  flagName: 'reset',
  description: 'Reset ulang relasi/log fixture sebelum membuat dataset baru',
})
