import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import Campaign from '#models/campaign'
import CampaignAccount from '#models/campaign_account'
import CampaignProfile from '#models/campaign_profile'
import CampaignRuntimeState from '#models/campaign_runtime_state'
import FacebookAccount from '#models/facebook_account'
import FacebookProfile from '#models/facebook_profile'
import SessionLog from '#models/session_log'
import { publishCampaignJob } from '#services/queue/amqp_publisher'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

const ACCOUNT_LABEL = 'Santi Similikity'
const INVITE_PAGE_URL = 'https://www.facebook.com/NadivaBeautyShop/'
const POLL_INTERVAL_MS = 4000
const TIMEOUT_MS = 4 * 60 * 1000
const MAX_PROFILES = 2

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForCampaignResult(campaignId: string) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < TIMEOUT_MS) {
    const campaign = await Campaign.findOrFail(campaignId)
    if (['completed', 'failed', 'paused'].includes(campaign.status)) {
      const logs = await SessionLog.query()
        .where('campaign_id', campaignId)
        .orderBy('created_at', 'desc')

      return {
        campaign,
        logs: logs.map((row) => ({
          action: row.action,
          status: row.status,
          message: row.message ?? '',
        })),
      }
    }

    await sleep(POLL_INTERVAL_MS)
  }

  throw new Error('Timeout menunggu campaign auto_invite page_follower selesai.')
}

export default class SmokeAutoInvitePageFollower extends BaseCommand {
  static commandName = 'smoke:auto-invite-page-follower'
  static description = 'Smoke nyata auto_invite page_follower memakai worker dan friend pool'
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
      this.logger.error('Tidak ada candidate profile friend untuk smoke auto invite page follower.')
      return
    }

    const stamp = DateTime.now().toFormat('yyyyLLdd-HHmmss')
    const campaign = await Campaign.create({
      userId: account.userId,
      name: `SMOKE Auto Invite Page Follower ${stamp}`,
      type: 'auto_invite',
      status: 'running',
      config: {
        inviteType: 'page_follower',
        url: INVITE_PAGE_URL,
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

    this.logger.info(`Campaign smoke dibuat: ${campaign.id}`)
    this.logger.info(
      `Target profiles: ${candidateProfiles.map((profile) => profile.profileName ?? profile.profileId).join(' | ')}`
    )
    this.logger.info(`Target page: ${INVITE_PAGE_URL}`)

    try {
      await publishCampaignJob({
        campaignId: campaign.id,
        userId: account.userId,
        type: 'auto_invite',
        enqueuedAt: DateTime.now().toISO()!,
      })

      const result = await waitForCampaignResult(campaign.id)
      const inviteLog = result.logs.find((row) => row.action === 'auto_invite')

      this.logger.info(`Campaign status akhir: ${result.campaign.status}`)
      for (const log of result.logs.slice(0, 12)) {
        this.logger.info(`${log.action}/${log.status} :: ${log.message}`)
      }

      if (!inviteLog) {
        this.logger.error('Log auto_invite tidak ditemukan, smoke dianggap gagal.')
        return
      }

      if (inviteLog.status !== 'success') {
        this.logger.error(`Auto invite page follower selesai tetapi log utama bukan success: ${inviteLog.status}`)
        return
      }

      this.logger.success(`Smoke auto_invite page follower berhasil: ${inviteLog.message}`)
    } finally {
      await db.transaction(async (trx) => {
        await SessionLog.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await CampaignRuntimeState.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await CampaignProfile.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await CampaignAccount.query({ client: trx }).where('campaign_id', campaign.id).delete()
        await Campaign.query({ client: trx }).where('id', campaign.id).delete()
      })

      this.logger.info('Cleanup smoke auto_invite page follower selesai.')
    }
  }
}
