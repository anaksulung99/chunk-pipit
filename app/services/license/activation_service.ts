import License from '#models/license'
import DeviceActivation from '#models/device_activation'
import type User from '#models/user'
import ActivationException from '#exceptions/activation_exception'
import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'

export type ActivatePayload = {
  email: string
  licenseKey: string
  deviceId: string
  deviceName?: string
  os: string
  osVersion?: string
  appVersion?: string
  ip?: string | null
}

export type VerifyPayload = {
  licenseKey: string
  deviceId: string
  ip?: string | null
}

export type ActivationResult = {
  user: User
  license: License
  device: DeviceActivation
}

/**
 * Owns the "1 email · 1 license · 1 device" enforcement.
 *
 * The DB also guards this with a partial unique index
 * (`uq_active_device_per_license`, only one row per license WHERE status =
 * 'active'); the checks here surface friendly errors before hitting it.
 */
export class ActivationService {
  /**
   * First-time activation. Binds the license to this physical device, or
   * idempotently refreshes the binding if the same device re-activates.
   */
  async activate(payload: ActivatePayload): Promise<ActivationResult> {
    return db.transaction(async (trx) => {
      const license = await License.query({ client: trx })
        .where('key', payload.licenseKey)
        .preload('user')
        .first()

      if (!license) {
        throw new ActivationException('Lisensi tidak ditemukan.', 'E_LICENSE_NOT_FOUND', 404)
      }
      if (!license.isUsable) {
        throw new ActivationException(
          'Lisensi tidak aktif atau sudah kedaluwarsa.',
          'E_LICENSE_INACTIVE',
          403
        )
      }

      const user = license.user
      if (!user || user.email.toLowerCase() !== payload.email.toLowerCase()) {
        throw new ActivationException(
          'Email tidak cocok dengan lisensi ini.',
          'E_EMAIL_MISMATCH',
          403
        )
      }
      if (!user.isActive) {
        throw new ActivationException('Akun pengguna dinonaktifkan.', 'E_USER_INACTIVE', 403)
      }

      // Same physical device re-activating: idempotent refresh (unless revoked).
      const existing = await DeviceActivation.query({ client: trx })
        .where('license_id', license.id)
        .where('device_id', payload.deviceId)
        .first()

      if (existing) {
        if (existing.status === 'revoked') {
          throw new ActivationException(
            'Akses perangkat ini telah dicabut. Hubungi superadmin.',
            'E_DEVICE_REVOKED',
            403
          )
        }
        existing.useTransaction(trx)
        existing.merge({
          deviceName: payload.deviceName ?? existing.deviceName,
          osVersion: payload.osVersion ?? existing.osVersion,
          appVersion: payload.appVersion ?? existing.appVersion,
          lastIp: payload.ip ?? existing.lastIp,
          lastVerifiedAt: DateTime.now(),
        })
        await existing.save()
        return { user, license, device: existing }
      }

      // New device: enforce the single-active-device slot.
      const activeDevices = await DeviceActivation.query({ client: trx })
        .where('license_id', license.id)
        .where('status', 'active')

      if (activeDevices.length >= license.maxDevices) {
        throw new ActivationException(
          'Lisensi ini sudah aktif di perangkat lain.',
          'E_DEVICE_LIMIT',
          409
        )
      }

      const device = await DeviceActivation.create(
        {
          licenseId: license.id,
          userId: user.id,
          deviceId: payload.deviceId,
          deviceName: payload.deviceName ?? null,
          os: payload.os,
          osVersion: payload.osVersion ?? null,
          appVersion: payload.appVersion ?? null,
          status: 'active',
          lastIp: payload.ip ?? null,
          firstActivatedAt: DateTime.now(),
          lastVerifiedAt: DateTime.now(),
        },
        { client: trx }
      )

      return { user, license, device }
    })
  }

  /**
   * Per-launch verification (online required). Confirms the license is still
   * usable and this device is still the bound, active device.
   */
  async verify(payload: VerifyPayload): Promise<ActivationResult> {
    return db.transaction(async (trx) => {
      const license = await License.query({ client: trx })
        .where('key', payload.licenseKey)
        .preload('user')
        .first()

      if (!license) {
        throw new ActivationException('Lisensi tidak ditemukan.', 'E_LICENSE_NOT_FOUND', 404)
      }
      if (!license.isUsable) {
        throw new ActivationException(
          'Lisensi tidak aktif atau sudah kedaluwarsa.',
          'E_LICENSE_INACTIVE',
          403
        )
      }

      const user = license.user
      if (!user || !user.isActive) {
        throw new ActivationException('Akun pengguna dinonaktifkan.', 'E_USER_INACTIVE', 403)
      }

      const device = await DeviceActivation.query({ client: trx })
        .where('license_id', license.id)
        .where('device_id', payload.deviceId)
        .where('status', 'active')
        .first()

      if (!device) {
        throw new ActivationException(
          'Perangkat ini tidak terdaftar / aktif untuk lisensi ini.',
          'E_DEVICE_NOT_ACTIVE',
          403
        )
      }

      device.useTransaction(trx)
      device.merge({ lastIp: payload.ip ?? device.lastIp, lastVerifiedAt: DateTime.now() })
      await device.save()

      return { user, license, device }
    })
  }
}
