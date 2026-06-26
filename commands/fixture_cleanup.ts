import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import {
  FIXTURE_ACCOUNT_LABELS,
  FIXTURE_CAMPAIGN_NAMES,
  FIXTURE_GROUP_IDS,
} from '#services/fixtures/smoke_fixtures'
import db from '@adonisjs/lucid/services/db'

type Flags = {
  userId?: string
}

export default class FixtureCleanup extends BaseCommand {
  static commandName = 'fixture:cleanup'
  static description = 'Bersihkan fixture/dev data uji yang aman untuk user tertentu'
  static options: CommandOptions = { startApp: true }

  private parseFlags(): Flags {
    const parsedFlags = ((this as any).parsed?.flags ?? {}) as Record<string, unknown>
    const userIdValue = parsedFlags.userId ?? parsedFlags['user-id']

    return {
      userId: typeof userIdValue === 'string' ? userIdValue : undefined,
    }
  }

  async run() {
    const flags = this.parseFlags()
    if (!flags.userId) {
      this.logger.error('Flag --user-id wajib diisi agar cleanup tidak menyentuh user lain.')
      return
    }

    const { default: User } = await import('#models/user')
    const { default: Campaign } = await import('#models/campaign')
    const { default: CampaignGroup } = await import('#models/campaign_group')
    const { default: CampaignAccount } = await import('#models/campaign_account')
    const { default: SessionLog } = await import('#models/session_log')
    const { default: FacebookGroup } = await import('#models/facebook_group')
    const { default: FacebookAccount } = await import('#models/facebook_account')

    const user = await User.find(flags.userId)
    if (!user) {
      this.logger.error(`User ${flags.userId} tidak ditemukan.`)
      return
    }

    const summary = {
      sessionLogs: 0,
      campaignGroups: 0,
      campaignAccounts: 0,
      campaigns: 0,
      groups: 0,
      accounts: 0,
    }

    await db.transaction(async (trx) => {
      const campaigns = await Campaign.query({ client: trx })
        .where('user_id', user.id)
        .whereIn('name', FIXTURE_CAMPAIGN_NAMES)
        .select('id', 'name')

      const campaignIds = campaigns.map((campaign) => campaign.id)
      summary.campaigns = campaigns.length

      if (campaignIds.length) {
        summary.sessionLogs = (
          await SessionLog.query({ client: trx }).whereIn('campaign_id', campaignIds).select('id')
        ).length

        summary.campaignGroups = (
          await CampaignGroup.query({ client: trx }).whereIn('campaign_id', campaignIds).select('id')
        ).length

        summary.campaignAccounts = (
          await CampaignAccount.query({ client: trx }).whereIn('campaign_id', campaignIds).select('id')
        ).length

        await SessionLog.query({ client: trx }).whereIn('campaign_id', campaignIds).delete()
        await CampaignGroup.query({ client: trx }).whereIn('campaign_id', campaignIds).delete()
        await CampaignAccount.query({ client: trx }).whereIn('campaign_id', campaignIds).delete()
        await Campaign.query({ client: trx }).whereIn('id', campaignIds).delete()
      }

      summary.groups = (
        await FacebookGroup.query({ client: trx })
          .where('user_id', user.id)
          .whereIn('group_id', FIXTURE_GROUP_IDS)
          .select('id')
      ).length

      summary.accounts = (
        await FacebookAccount.query({ client: trx })
          .where('user_id', user.id)
          .whereIn('label', FIXTURE_ACCOUNT_LABELS)
          .select('id')
      ).length

      await FacebookGroup.query({ client: trx })
        .where('user_id', user.id)
        .whereIn('group_id', FIXTURE_GROUP_IDS)
        .delete()

      await FacebookAccount.query({ client: trx })
        .where('user_id', user.id)
        .whereIn('label', FIXTURE_ACCOUNT_LABELS)
        .delete()
    })

    this.logger.success('Fixture/dev data berhasil dibersihkan.')
    this.logger.info(`User            : ${user.id} (${user.email})`)
    this.logger.info(`Session logs    : ${summary.sessionLogs}`)
    this.logger.info(`Campaign groups : ${summary.campaignGroups}`)
    this.logger.info(`Campaign accs   : ${summary.campaignAccounts}`)
    this.logger.info(`Campaigns       : ${summary.campaigns}`)
    this.logger.info(`Groups          : ${summary.groups}`)
    this.logger.info(`Accounts        : ${summary.accounts}`)
  }
}

FixtureCleanup.defineFlag('userId', {
  type: 'string',
  flagName: 'user-id',
  description: 'User target yang fixture/dev datanya akan dibersihkan',
})
