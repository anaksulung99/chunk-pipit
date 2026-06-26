import { SessionLogSchema } from '#database/schema'
import Campaign from '#models/campaign'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class SessionLog extends SessionLogSchema {
  @belongsTo(() => Campaign, { foreignKey: 'campaignId' })
  declare campaign: BelongsTo<typeof Campaign>
}
