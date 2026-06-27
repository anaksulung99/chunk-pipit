import { AntidetectSchema } from '#database/schema'
import User from '#models/user'
import Proxy from '#models/proxy'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Antidetect extends AntidetectSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Proxy)
  declare proxy: BelongsTo<typeof Proxy>
}
