import { FacebookProfileSchema } from '#database/schema'
import User from '#models/user'
import CampaignProfile from '#models/campaign_profile'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class FacebookProfile extends FacebookProfileSchema {
  @column({
    prepare: (value: string[] | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null)),
  })
  declare tags: string[] | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => CampaignProfile, { foreignKey: 'profileId' })
  declare campaignProfiles: HasMany<typeof CampaignProfile>
}
