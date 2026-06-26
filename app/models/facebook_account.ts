import { FacebookAccountSchema } from '#database/schema'
import User from '#models/user'
import AccountCookie from '#models/account_cookie'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class FacebookAccount extends FacebookAccountSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => AccountCookie, { foreignKey: 'accountId' })
  declare cookies: HasMany<typeof AccountCookie>
}
