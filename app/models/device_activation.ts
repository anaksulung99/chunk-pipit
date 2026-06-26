import { DeviceActivationSchema } from '#database/schema'
import User from '#models/user'
import License from '#models/license'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'

export default class DeviceActivation extends DeviceActivationSchema {
  @belongsTo(() => License)
  declare license: BelongsTo<typeof License>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  get isActive() {
    return this.status === 'active'
  }
}
