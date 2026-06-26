import { CampaignGroupSchema } from '#database/schema'
import Campaign from '#models/campaign'
import FacebookGroup from '#models/facebook_group'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class CampaignGroup extends CampaignGroupSchema {
  @belongsTo(() => Campaign, { foreignKey: 'campaignId' })
  declare campaign: BelongsTo<typeof Campaign>

  @belongsTo(() => FacebookGroup, { foreignKey: 'groupId' })
  declare group: BelongsTo<typeof FacebookGroup>
}
