import { ProxySchema } from '#database/schema'
import User from '#models/user'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class Proxy extends ProxySchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  /** Connection string form: proto://[user:pass@]host:port */
  get url() {
    const auth = this.username ? `${this.username}:${this.password ?? ''}@` : ''
    return `${this.protocol}://${auth}${this.host}:${this.port}`
  }
}
