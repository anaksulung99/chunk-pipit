import { CampaignProfileSchema } from '#database/schema'
import Campaign from '#models/campaign'
import FacebookProfile from '#models/facebook_profile'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class CampaignProfile extends CampaignProfileSchema {
  @belongsTo(() => Campaign, { foreignKey: 'campaignId' })
  declare campaign: BelongsTo<typeof Campaign>

  @belongsTo(() => FacebookProfile, { foreignKey: 'profileId' })
  declare profile: BelongsTo<typeof FacebookProfile>
}
