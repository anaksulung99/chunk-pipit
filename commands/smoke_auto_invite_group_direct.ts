import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Campaign from '#models/campaign'
import CampaignAccount from '#models/campaign_account'
import CampaignProfile from '#models/campaign_profile'
import CampaignRuntimeState from '#models/campaign_runtime_state'
import FacebookAccount from '#models/facebook_account'
import FacebookProfile from '#models/facebook_profile'
import SessionLog from '#models/session_log'
import { runCampaign } from '#services/automation/campaign_runner'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

const ACCOUNT_LABEL = 'Santi Similikity'
const INVITE_GROUP_URL = 'https://www.facebook.com/groups/757725261434785'
const MAX_PROFILES = 2

export default class SmokeAutoInviteGroupDirect extends BaseCommand {
  static commandName = 'smoke:auto-invite-group-direct'
  static description = 'Smoke langsung auto_invite group tanpa queue worker untuk isolasi runtime'
  static options: CommandOptions = { startApp: true }

  async run() {
    const account = await FacebookAccount.query()
      .whereILike('label', `%${ACCOUNT_LABEL}%`)
      .orderBy('updated_at', 'desc')
      .first()

    if (!account) {
      this.logger.error(`Akun "${ACCOUNT_LABEL}" tidak ditemukan.`)
      return
    }

    const candidateProfiles = await FacebookProfile.query()
      .where('user_id', account.userId)
      .where('relationship_status', 'friend')
      .whereNotNull('profile_name')
      .orderBy('last_action_at', 'desc')
      .limit(MAX_PROFILES)

    if (!candidateProfiles.length) {
      this.logger.error('Tidak ada candidate profile friend untuk smoke auto invite direct.')
      return
    }

    const stamp = DateTime.now().toFormat('yyyyLLdd-HHmmss')
    const campaign = await Campaign.create({
      userId: account.userId,
      name: `SMOKE Auto Invite Group Direct ${stamp}`,
      type: 'auto_invite',
      status: 'running',
      config: {
        inviteType: 'group',
        url: INVITE_GROUP_URL,
      },
      useProxy: false,
      maxConcurrency: 1,
      maxAccounts: 1,
      maxDelayMs: 1500,
      headless: false,
      advanceMode: false,
    })

    await CampaignAccount.create({
      campaignId: campaign.id,
      accountId: account.id,
      status: 'running',
    })

    await CampaignProfile.createMany(
      candidateProfiles.map((profile) => ({
        campaignId: campaign.id,
        profileId: profile.id,
        status: 'pending' as const,
      }))
    )

    this.logger.info(`Campaign direct smoke dibuat: ${campaign.id}`)
    this.logger.info(
      `Target profiles: ${candidateProfiles.map((profile) => profile.profileName ?? profile.profileId).join(' | ')}`
    )
    this.logger.info(`Target group: ${INVITE_GROUP_URL}`)

    try {
      await runCampaign(campaign.id)

      const resultCampaign = await Campaign.findOrFail(campaign.id)
      const logs = await SessionLog.query().where('campaign_id', campaign.id).orderBy('created_at', 'desc')
      const inviteLog = logs.find((row) => row.action === 'auto_invite')

      this.logger.info(`Campaign status akhir: ${resultCampaign.status}`)
      for (const log of logs.slice(0, 12)) {
        this.logger.info(`${log.action}/${log.status} :: ${log.message ?? ''}`)
      }

      if (!inviteLog) {
        this.logger.error('Log auto_invite tidak ditemukan pada direct smoke.')
        return
      }

      if (inviteLog.status !== 'success') {
        this.logger.error(`Auto invite direct selesai tetapi log utama bukan success: ${inviteLog.status}`)
        return
      }

      this.logger.success(`Smoke auto_invite group direct berhasil: ${inviteLog.message}`)
    } finally {
      await db.transaction(async (trx) => {
        await SessionLog.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await CampaignRuntimeState.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await CampaignProfile.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await CampaignAccount.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await Campaign.query({ client: trx }).where('id', campaign.id).delete()
      })

      this.logger.info('Cleanup smoke auto_invite direct selesai.')
    }
  }
}
