import { CampaignAccountSchema } from '#database/schema'
import Campaign from '#models/campaign'
import FacebookAccount from '#models/facebook_account'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class CampaignAccount extends CampaignAccountSchema {
  @belongsTo(() => Campaign, { foreignKey: 'campaignId' })
  declare campaign: BelongsTo<typeof Campaign>

  @belongsTo(() => FacebookAccount, { foreignKey: 'accountId' })
  declare account: BelongsTo<typeof FacebookAccount>
}
