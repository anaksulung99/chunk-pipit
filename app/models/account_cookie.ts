import { AccountCookySchema } from '#database/schema'
import FacebookAccount from '#models/facebook_account'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class AccountCookie extends AccountCookySchema {
  @belongsTo(() => FacebookAccount, { foreignKey: 'accountId' })
  declare account: BelongsTo<typeof FacebookAccount>
}
