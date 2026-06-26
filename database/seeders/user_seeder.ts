import { BaseSeeder } from '@adonisjs/lucid/seeders'
import User from '#models/user'
import License from '#models/license'
import { generateLicenseKey } from '#services/license/license_key'
import env from '#start/env'
import logger from '@adonisjs/core/services/logger'

/**
 * Seeds the default superadmin (from DEFAULT_ADMIN_* env) and an active
 * license bound to that user, so device activation can be tested end-to-end.
 *
 * Idempotent: re-running keeps the existing user/license. The license key is
 * printed once so it can be used as the activation key.
 */
export default class extends BaseSeeder {
  async run() {
    const email = env.get('DEFAULT_ADMIN_EMAIL')
    const password = env.get('DEFAULT_ADMIN_PASSWORD')

    if (!email || !password) {
      logger.warn(
        '[seeder] DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD belum diset — seeding admin dilewati.'
      )
      return
    }

    // Password is auto-hashed by the withAuthFinder mixin on the User model.
    const user = await User.firstOrCreate(
      { email },
      {
        email,
        password,
        fullName: env.get('DEFAULT_ADMIN_NAME') ?? 'Super Admin',
        role: 'superadmin',
        isActive: true,
      }
    )

    const license = await License.firstOrCreate(
      { userId: user.id },
      {
        userId: user.id,
        key: env.get('DEFAULT_ADMIN_LICENSE_KEY') || generateLicenseKey(),
        status: 'active',
        maxDevices: 1,
      }
    )

    logger.info('[seeder] Default admin + license siap:')
    logger.info(`[seeder]   email   : ${user.email}`)
    logger.info(`[seeder]   role    : ${user.role}`)
    logger.info(`[seeder]   license : ${license.key}`)
  }
}
