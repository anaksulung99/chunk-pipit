import { FingerprintProfileSchema } from '#database/schema'
import User from '#models/user'
import Campaign from '#models/campaign'

import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class FingerprintProfile extends FingerprintProfileSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => Campaign)
  declare campaigns: HasMany<typeof Campaign>
}
