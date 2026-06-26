import { CampaignSchema } from '#database/schema'
import User from '#models/user'
import FingerprintProfile from '#models/fingerprint_profile'
import CampaignAccount from '#models/campaign_account'
import CampaignGroup from '#models/campaign_group'
import SessionLog from '#models/session_log'
import CampaignProfile from '#models/campaign_profile'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class Campaign extends CampaignSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => FingerprintProfile, { foreignKey: 'fingerprintId' })
  declare fingerprint: BelongsTo<typeof FingerprintProfile>

  @hasMany(() => CampaignAccount, { foreignKey: 'campaignId' })
  declare accounts: HasMany<typeof CampaignAccount>

  @hasMany(() => CampaignGroup, { foreignKey: 'campaignId' })
  declare groups: HasMany<typeof CampaignGroup>

  @hasMany(() => SessionLog, { foreignKey: 'campaignId' })
  declare logs: HasMany<typeof SessionLog>

  @hasMany(() => CampaignProfile, { foreignKey: 'campaignId' })
  declare profiles: HasMany<typeof CampaignProfile>
}
