import type { HttpContext } from '@adonisjs/core/http'
import User from '#models/user'
import License from '#models/license'
import { updateOwnProfiileValidator, updateProfilePasswordValidator } from '#validators/user'

export default class UserProfilesController {
  async profile({ inertia, auth, response }: HttpContext) {
    if (!auth.user) {
      return response.unauthorized()
    }

    const results = await License.query().where('user_id', auth.user.id).preload('devices')
    const licenses = results.map((license) => ({
      id: license.id,
      userId: license.userId,
      key: license.key,
      status: license.status,
      maxDevices: license.maxDevices,
      plan: license.plan,
      notes: license.notes,
      issuedAt: license.issuedAt.toISO(),
      expiresAt: license.expiresAt?.toISO() ?? null,
      createdAt: license.createdAt.toISO(),
      updatedAt: license.updatedAt?.toISO() ?? null,
      devices: license.devices.map((device) => ({
        id: device.id,
        licenseId: device.licenseId,
        userId: device.userId,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        os: device.os,
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        status: device.status,
        lastIp: device.lastIp,
        firstActivatedAt: device.firstActivatedAt.toISO(),
        lastVerifiedAt: device.lastVerifiedAt?.toISO() ?? null,
        revokedAt: device.revokedAt?.toISO() ?? null,
        createdAt: device.createdAt.toISO(),
        updatedAt: device.updatedAt?.toISO() ?? null,
      })),
    }))

    return inertia.render('settings/profile', {
      licenses,
    })
  }

  async update({ auth, request, response, session }: HttpContext) {
    try {
      const id = auth.user?.id
      if (!id) {
        return response.unauthorized()
      }

      const payload = await request.validateUsing(updateOwnProfiileValidator(id))

      const user = await User.query().where('id', id).firstOrFail()
      user
        .merge({
          fullName: payload.fullName,
          email: payload.email,
        })
        .save()
    } catch (error) {
      session.flash('error', 'Profile update failed')
      return response.redirect().back()
    }

    session.flash('success', 'Profile updated')
    return response.redirect().back()
  }

  async password({ auth, request, response, session }: HttpContext) {
    try {
      const id = auth.user?.id
      if (!id) {
        return response.unauthorized()
      }

      const payload = await request.validateUsing(updateProfilePasswordValidator)

      const user = await User.query().where('id', id).firstOrFail()
      user
        .merge({
          password: payload.password,
        })
        .save()
    } catch (error) {
      session.flash('error', 'Password update failed')
      return response.redirect().back()
    }

    session.flash('success', 'Password updated')
    return response.redirect().back()
  }

}
