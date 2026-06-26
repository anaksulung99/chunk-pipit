import { FacebookGroupSchema } from '#database/schema'
import User from '#models/user'
import CampaignGroup from '#models/campaign_group'
import { belongsTo, column, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class FacebookGroup extends FacebookGroupSchema {
  /**
   * Override the generated `tags` column so a JS array round-trips through the
   * jsonb column. node-postgres serialises a top-level JS array as a Postgres
   * array literal (not JSON), so we must stringify on write ourselves.
   */
  @column({
    prepare: (value: string[] | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null)),
  })
  declare tags: string[] | null

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => CampaignGroup, { foreignKey: 'groupId' })
  declare campaignGroups: HasMany<typeof CampaignGroup>
}
