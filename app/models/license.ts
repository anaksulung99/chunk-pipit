import { LicenseSchema } from '#database/schema'
import User from '#models/user'
import DeviceActivation from '#models/device_activation'
import { DateTime } from 'luxon'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'

export default class License extends LicenseSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @hasMany(() => DeviceActivation)
  declare devices: HasMany<typeof DeviceActivation>

  /**
   * A license can be used for activation/verification only when it is active
   * and not past its expiry date.
   */
  get isUsable() {
    if (this.status !== 'active') return false
    if (this.expiresAt && this.expiresAt < DateTime.now()) return false
    return true
  }
}
