import type { HttpContext } from '@adonisjs/core/http'
import Antidetect from '#models/antidetect'
import Proxy from '#models/proxy'
import { DateTime } from 'luxon'
import { FingerprintGenerator, type BrowserFingerprintWithHeaders } from 'fingerprint-generator'
import { createAntidetectValidator, bulkDeleteAntidetectValidator } from '#validators/antidetect'
import { type AntidetectBrowserEngine } from '#services/antidetect/preset'
import { AntidetectService } from '#services/antidetect/antidetect_service'

const SORTABLE = ['created_at', 'name', 'os_name', 'browser_name'] as const
const activeAntidetectServices = new Map<string, AntidetectService>()

export default class AntidetectsController {
  private scoped(
    userId: string,
    filters: {
      search?: string
      engine?: string
      deviceType?: string
      osName?: string
      browserName?: string
      language?: string
      timezone?: string
      startDate?: string
      endDate?: string
    }
  ) {
    const query = Antidetect.query().where('user_id', userId)
    if (filters.engine && filters.engine !== 'all') query.where('engine', filters.engine)
    if (filters.deviceType && filters.deviceType !== 'all')
      query.where('device_type', filters.deviceType)
    if (filters.osName) query.where('os_name', filters.osName)
    if (filters.browserName) query.where('browser_name', filters.browserName)
    if (filters.language) query.where('language', filters.language)
    if (filters.timezone) query.where('timezone', filters.timezone)

    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) =>
        sub
          .whereILike('name', term)
          .orWhereILike('user_agent', term)
          .orWhereILike('os_name', term)
          .orWhereILike('browser_name', term)
      )
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

  async index({ request, inertia, auth }: HttpContext) {
    const user = auth.user!
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('per_page', 15)) || 15, 100)
    const search = request.input('search')?.toString().trim() || undefined
    const engine = request.input('engine')?.toString().trim() || undefined
    const deviceType =
      request.input('deviceType')?.toString().trim() ||
      request.input('device_type')?.toString().trim() ||
      undefined
    const osName =
      request.input('osName')?.toString().trim() ||
      request.input('os_name')?.toString().trim() ||
      undefined
    const browserName =
      request.input('browserName')?.toString().trim() ||
      request.input('browser_name')?.toString().trim() ||
      undefined
    const language = request.input('language')?.toString().trim() || undefined
    const timezone = request.input('timezone')?.toString().trim() || undefined
    const startDateInput = request.input('startDate')?.toString()
    const endDateInput = request.input('endDate')?.toString()
    const startDate = this.validDate(startDateInput)
    const endDate = this.validDate(endDateInput)

    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, {
      search,
      engine,
      deviceType,
      osName,
      browserName,
      language,
      timezone,
      startDate,
      endDate,
    })
      .orderBy(sort, order)
      .preload('proxy')
      .paginate(page, perPage)

    const data = result.all().map((fp) => ({
      id: fp.id,
      name: fp.name,
      userId: fp.userId,
      engine: fp.engine,
      deviceType: fp.deviceType,
      osName: fp.osName,
      osVersion: fp.osVersion,
      browserName: fp.browserName,
      browserVersion: fp.browserVersion,
      userAgent: fp.userAgent,
      language: fp.language,
      timezone: fp.timezone,
      locale: fp.locale,
      proxyId: fp.proxyId,
      screenHeight: fp.screenHeight,
      screenWidth: fp.screenWidth,
      deviceScaleFactor: fp.deviceScaleFactor,
      isMobile: fp.isMobile,
      hasTouch: fp.hasTouch,
      canvasMode: fp.canvasMode,
      canvasSeed: fp.canvasSeed,
      webglVendor: fp.webglVendor,
      webglRenderer: fp.webglRenderer,
      hardwareConcurrency: fp.hardwareConcurrency,
      deviceMemory: fp.deviceMemory,
      rawFingerprint: fp.rawFingerprint,
      createdAt: fp.createdAt ? fp.createdAt.toISO() : null,
      updatedAt: fp.updatedAt ? fp.updatedAt.toISO() : null,
    }))

    const allOwn = await Antidetect.query()
      .where('user_id', user.id)
      .select('id', 'os_name', 'browser_name')
      .orderBy('id', 'asc')
    const proxies = await Proxy.query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')
      .select('id', 'protocol', 'host', 'port', 'status', 'country')

    const stats = {
      total: allOwn.length,
      windows: allOwn.filter((fp) => fp.osName === 'windows').length,
      linux: allOwn.filter((fp) => fp.osName === 'linux').length,
      macos: allOwn.filter((fp) => fp.osName === 'macos').length,
      android: allOwn.filter((fp) => fp.osName === 'android').length,
      ios: allOwn.filter((fp) => fp.osName === 'ios').length,
      chrome: allOwn.filter((fp) => fp.browserName === 'chrome').length,
      firefox: allOwn.filter((fp) => fp.browserName === 'firefox').length,
      safari: allOwn.filter((fp) => fp.browserName === 'safari').length,
      edge: allOwn.filter((fp) => fp.browserName === 'edge').length,
      chromeMobile: allOwn.filter((fp) => fp.browserName === 'chrome_mobile').length,
      safariMobile: allOwn.filter((fp) => fp.browserName === 'safari_mobile').length,
      firefoxMobile: allOwn.filter((fp) => fp.browserName === 'firefox_mobile').length,
    }

    return inertia.render('antidetects/index', {
      antidetects: {
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
        engine: engine ?? 'all',
        deviceType: deviceType ?? 'all',
        osName: osName ?? 'all',
        browserName: browserName ?? 'all',
        language: language ?? 'all',
        timezone: timezone ?? 'all',
        sort,
        order,
        perPage,
        startDate: startDate ?? '',
        endDate: endDate ?? '',
      },
      proxies: proxies.map((proxy) => ({
        id: proxy.id,
        label: `${proxy.protocol}://${proxy.host}:${proxy.port}`,
        status: proxy.status,
        country: proxy.country,
      })),
    })
  }

  async store({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(createAntidetectValidator)
    const userId = auth.user!.id
    const proxyId = await this.resolveOwnedProxyId(userId, payload.proxyId)

    if (payload.proxyId && !proxyId) {
      session.flash('error', 'Proxy tidak valid atau bukan milik akun ini.')
      return response.redirect().back()
    }

    const fingerprint = new FingerprintGenerator()

    const generate = fingerprint.getFingerprint({
      devices: [payload.deviceType],
      operatingSystems: [payload.osName],
      browsers: this.resolveBrowser(
        payload.engine as AntidetectBrowserEngine,
        payload.browserName
      ) as any,
      locales: payload.language ? [payload.language] : ['en-US'],
    })

    await Antidetect.create({
      ...payload,
      proxyId,
      userId,
      rawFingerprint: generate,
    })

    session.flash('success', 'Antidetect created successfully')
    return response.redirect().back()
  }

  async update({ request, response, session, auth, params }: HttpContext) {
    const userId = auth.user!.id
    const src = await Antidetect.query()
      .where('id', params.id)
      .where('user_id', userId)
      .firstOrFail()

    if (!src) {
      session.flash('error', 'ID antidetect tidak valid.')
      return response.redirect().back()
    }

    const payload = await request.validateUsing(createAntidetectValidator)
    const proxyId = await this.resolveOwnedProxyId(userId, payload.proxyId)
    if (payload.proxyId && !proxyId) {
      session.flash('error', 'Proxy tidak valid atau bukan milik akun ini.')
      return response.redirect().back()
    }

    let generated: BrowserFingerprintWithHeaders | null = src.rawFingerprint
    if (
      payload.engine !== src.engine ||
      payload.deviceType !== src.deviceType ||
      payload.osName !== src.osName ||
      payload.browserName !== src.browserName
    ) {
      try {
        const fingerprint = new FingerprintGenerator()

        generated = fingerprint.getFingerprint({
          devices: [payload.deviceType],
          operatingSystems: [payload.osName],
          browsers: this.resolveBrowser(
            payload.engine as AntidetectBrowserEngine,
            payload.browserName
          ) as any,
          locales: payload.language ? [payload.language] : ['en-US'],
        })
      } catch {
        session.flash(
          'error',
          `Kombinasi ${payload.osName} + ${payload.browserName} tidak didukung generator.`
        )
        return response.redirect().back()
      }
    }

    await src
      .merge({
        name: payload.name,
        engine: payload.engine,
        deviceType: payload.deviceType,
        osName: payload.osName,
        osVersion: payload.osVersion,
        browserName: payload.browserName,
        browserVersion: payload.browserVersion,
        userAgent: payload.userAgent,
        language: payload.language,
        timezone: payload.timezone,
        locale: payload.locale,
        proxyId,
        screenHeight: payload.screenHeight,
        screenWidth: payload.screenWidth,
        deviceScaleFactor: payload.deviceScaleFactor,
        isMobile: payload.isMobile,
        hasTouch: payload.hasTouch,
        canvasMode: payload.canvasMode,
        canvasSeed: payload.canvasSeed,
        webglVendor: payload.webglVendor,
        webglRenderer: payload.webglRenderer,
        hardwareConcurrency: payload.hardwareConcurrency,
        deviceMemory: payload.deviceMemory,
        rawFingerprint: generated,
      })
      .save()

    session.flash('success', `Antidetect "${src.name}" diperbarui.`)
    return response.redirect().back()
  }

  async clone({ params, response, session, auth }: HttpContext) {
    const userId = auth.user!.id
    const src = await Antidetect.query()
      .where('id', params.id)
      .where('user_id', userId)
      .firstOrFail()

    await Antidetect.create({
      name: `${src.name} (copy)`,
      engine: src.engine,
      userId,
      deviceType: src.deviceType,
      osName: src.osName,
      osVersion: src.osVersion,
      browserName: src.browserName,
      browserVersion: src.browserVersion,
      userAgent: src.userAgent,
      language: src.language,
      timezone: src.timezone,
      locale: src.locale,
      proxyId: src.proxyId,
      screenHeight: src.screenHeight,
      screenWidth: src.screenWidth,
      deviceScaleFactor: src.deviceScaleFactor,
      isMobile: src.isMobile,
      hasTouch: src.hasTouch,
      canvasMode: src.canvasMode,
      canvasSeed: src.canvasSeed,
      webglVendor: src.webglVendor,
      webglRenderer: src.webglRenderer,
      hardwareConcurrency: src.hardwareConcurrency,
      deviceMemory: src.deviceMemory,
      rawFingerprint: src.rawFingerprint,
    })

    session.flash('success', `Antidetect "${src.name}" cloned successfully.`)
    return response.redirect().back()
  }

  async destroy({ params, response, session, auth }: HttpContext) {
    const ad = await Antidetect.query()
      .where('id', params.id)
      .where('user_id', auth.user!.id)
      .firstOrFail()
    await ad.delete()
    session.flash('success', 'Antidetect dihapus.')
    return response.redirect().back()
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkDeleteAntidetectValidator)
    const userId = auth.user!.id

    let ids: string[] = []
    if (payload.mode === 'ids') {
      ids = payload.ids ?? []
    } else {
      const query = this.scoped(userId, {
        search: payload.filters?.search,
        engine: payload.filters?.engine,
        deviceType: payload.filters?.deviceType,
        osName: payload.filters?.osName,
        browserName: payload.filters?.browserName,
        language: payload.filters?.language,
        timezone: payload.filters?.timezone,
        startDate: this.validDate(payload.filters?.startDate),
        endDate: this.validDate(payload.filters?.endDate),
      })
      if (payload.excludedIds?.length) query.whereNotIn('id', payload.excludedIds)
      // eslint-disable-next-line @unicorn/no-await-expression-member
      ids = (await query.select('id')).map((row) => row.id)
    }

    if (!ids.length) {
      session.flash('error', 'Tidak ada antidetect terpilih.')
      return response.redirect().back()
    }

    await Antidetect.query().where('user_id', userId).whereIn('id', ids).delete()
    session.flash('success', `${ids.length} antidetect dihapus.`)
    return response.redirect().back()
  }

  async start({ params, response, auth }: HttpContext) {
    const id = params.id
    let antidetectService: AntidetectService | null = null
    try {
      const ad = await Antidetect.query()
        .where('id', id)
        .where('user_id', auth.user!.id)
        .preload('proxy')
        .firstOrFail()

      const activeKey = `${auth.user!.id}:${ad.id}`
      const previousService = activeAntidetectServices.get(activeKey)
      if (previousService) {
        await previousService.closeAll().catch(() => {})
        activeAntidetectServices.delete(activeKey)
      }

      antidetectService = new AntidetectService(ad)
      await antidetectService.launchBrowser()
      activeAntidetectServices.set(activeKey, antidetectService)

      return response.ok({
        ok: true,
        message: `Antidetect "${ad.name}" dimulai.`,
      })
    } catch (error) {
      if (antidetectService) {
        await antidetectService.closeAll()
      }
      return response.internalServerError({
        ok: false,
        message: error instanceof Error ? error.message : 'Antidetect gagal dimulai.',
      })
    }
  }

  private validDate(value?: string) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
    return DateTime.fromISO(value, { zone: 'utc' }).isValid ? value : undefined
  }

  private resolveBrowser(engine: AntidetectBrowserEngine, browserName?: string): string[] {
    if (browserName) {
      const b = browserName.toLowerCase()
      if (b.includes('firefox')) return ['firefox']
      if (b.includes('safari')) return ['safari']
      if (b.includes('edge')) return ['edge']
      return ['chrome']
    }
    if (engine === 'firefox') return ['firefox']
    if (engine === 'webkit') return ['safari']
    return ['chrome']
  }

  private async resolveOwnedProxyId(userId: string, proxyId?: string | null) {
    if (!proxyId) return null
    const proxy = await Proxy.query().where('user_id', userId).where('id', proxyId).first()
    return proxy?.id ?? null
  }
}
