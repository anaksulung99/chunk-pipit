import License from '#models/license'
import DeviceActivation from '#models/device_activation'
import { updateLicenseStatusValidator, bulkLicenseValidator } from '#validators/license'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'

const SORTABLE = ['created_at', 'key', 'status', 'expires_at'] as const

export default class LicensesController {
  /**
   * Builds the filtered (but un-preloaded) license query shared by the list and
   * the "all matching" bulk action, so both target exactly the same set.
   */
  private filteredQuery(filters: {
    search?: string
    status?: string
    startDate?: string
    endDate?: string
  }) {
    const query = License.query()

    if (filters.status && filters.status !== 'all') {
      query.where('status', filters.status)
    }

    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => {
        sub.whereILike('key', term).orWhereHas('user', (u) => u.whereILike('email', term))
      })
    }

    if (filters.startDate) {
      query.where(
        'created_at',
        '>=',
        DateTime.fromISO(filters.startDate, { zone: 'utc' }).startOf('day').toSQL()!
      )
    }
    if (filters.endDate) {
      query.where(
        'created_at',
        '<=',
        DateTime.fromISO(filters.endDate, { zone: 'utc' }).endOf('day').toSQL()!
      )
    }

    return query
  }

  async index({ request, inertia }: HttpContext) {
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('per_page', 15)) || 15, 100)
    const search = request.input('search')?.toString().trim() || undefined
    const status = request.input('status')?.toString() || 'all'
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.filteredQuery({ search, status, startDate, endDate })
      .preload('user')
      .preload('devices')
      .orderBy(sort, order)
      .paginate(page, perPage)

    const data = result.all().map((license) => {
      const devices = license.devices ?? []
      const active = devices.filter((d) => d.status === 'active')
      const primary = active[0]
      return {
        id: license.id,
        key: license.key,
        status: license.status,
        maxDevices: license.maxDevices,
        plan: license.plan,
        expiresAt: license.expiresAt ? license.expiresAt.toISO() : null,
        createdAt: license.createdAt ? license.createdAt.toISO() : null,
        user: license.user
          ? { email: license.user.email, fullName: license.user.fullName, role: license.user.role }
          : null,
        devicesTotal: devices.length,
        activeDevices: active.length,
        activeDevice: primary
          ? {
              name: primary.deviceName,
              os: primary.os,
              deviceId: primary.deviceId,
              lastVerifiedAt: primary.lastVerifiedAt ? primary.lastVerifiedAt.toISO() : null,
            }
          : null,
      }
    })

    const allLicense = await License.query().select('id', 'status').orderBy('id', 'asc')

    const stats = {
      total: allLicense.length,
      active: allLicense.filter((l) => l.status === 'active').length,
      suspended: allLicense.filter((l) => l.status === 'suspended').length,
      revoked: allLicense.filter((l) => l.status === 'revoked').length,
      expired: allLicense.filter((l) => l.status === 'expired').length,
    }

    return inertia.render('licenses/index', {
      licenses: {
        data,
        stats,
        meta: {
          total: result.total,
          perPage: result.perPage,
          currentPage: result.currentPage,
          lastPage: result.lastPage,
          firstPage: result.firstPage,
        },
      },
      filters: {
        search: search ?? '',
        status,
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
    })
  }

  async updateStatus({ params, request, response, session }: HttpContext) {
    const { status } = await request.validateUsing(updateLicenseStatusValidator)
    const license = await License.findOrFail(params.id)
    license.status = status
    await license.save()
    session.flash('success', `Status lisensi "${license.key}" diubah ke ${status}.`)
    return response.redirect().back()
  }

  /** Revoke every active device for a license — frees the slot to move machines. */
  async resetDevices({ params, response, session }: HttpContext) {
    const license = await License.findOrFail(params.id)
    const devices = await DeviceActivation.query()
      .where('license_id', license.id)
      .where('status', 'active')

    for (const device of devices) {
      device.status = 'revoked'
      device.revokedAt = DateTime.now()
      await device.save()
    }

    session.flash('success', `Binding perangkat di-reset (${devices.length} perangkat dicabut).`)
    return response.redirect().back()
  }

  async bulk({ request, response, session }: HttpContext) {
    const payload = await request.validateUsing(bulkLicenseValidator)
    const targetStatus = payload.action === 'suspend' ? 'suspended' : 'active'

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.filteredQuery({
        search: payload.filters?.search,
        status: payload.filters?.status,
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      const matched = await query.select('id')
      ids = matched.map((row) => row.id)
    }

    if (ids.length) {
      await License.query().whereIn('id', ids).update({ status: targetStatus })
    }

    session.flash('success', `${ids.length} lisensi diperbarui (${targetStatus}).`)
    return response.redirect().back()
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }
}
