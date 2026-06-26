import { UserSchema } from '#database/schema'
import License from '#models/license'
import DeviceActivation from '#models/device_activation'
import PersonalSetting from '#models/personal_setting'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { hasOne, hasMany } from '@adonisjs/lucid/orm'
import type { HasOne, HasMany } from '@adonisjs/lucid/types/relations'
import { DbAccessTokensProvider, AccessToken } from '@adonisjs/auth/access_tokens'

export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  @hasOne(() => License)
  declare license: HasOne<typeof License>

  @hasMany(() => DeviceActivation)
  declare deviceActivations: HasMany<typeof DeviceActivation>

  @hasOne(() => PersonalSetting)
  declare personalSetting: HasOne<typeof PersonalSetting>

  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }

    return `${first.slice(0, 2)}`.toUpperCase()
  }

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '7 days',
    prefix: 'oat_',
    table: 'auth_access_tokens',
    type: 'auth_token',
    tokenSecretLength: 40,
  })
  currentAccessToken?: AccessToken
}
