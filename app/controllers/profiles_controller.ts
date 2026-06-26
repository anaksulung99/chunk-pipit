import FacebookProfile from '#models/facebook_profile'
import { mergeGroupTags, splitGroupTags } from '#services/group/tags'
import { bulkProfileValidator } from '#validators/profile'
import type { HttpContext } from '@adonisjs/core/http'
import { readFile } from 'node:fs/promises'

const SOURCE_TYPES = ['group_member', 'page_profile_follower', 'friend', 'engagement_post'] as const
const LIFECYCLE_STATUSES = [
  'fresh',
  'friend_requested',
  'friend_connected',
  'invited',
  'failed',
] as const
const RELATIONSHIP_STATUSES = ['unknown', 'outgoing_request', 'incoming_request', 'friend'] as const

type CsvRow = Record<string, string>
type ImportProfileRow = {
  userId: string
  profileId: string
  profileName: string | null
  profileUrl: string | null
  friendCount: number | null
  mutualFriendCount: number | null
  followerCount: number | null
  followingCount: number | null
  sourceType: (typeof SOURCE_TYPES)[number]
  sourceUrl: string | null
  lifecycleStatus: (typeof LIFECYCLE_STATUSES)[number]
  relationshipStatus: (typeof RELATIONSHIP_STATUSES)[number]
  tags: string[]
}

const SORTABLE = [
  'created_at',
  'profile_id',
  'profile_name',
  'friend_count',
  'source_type',
  'lifecycle_status',
] as const

export default class ProfilesController {
  private scoped(
    userId: string,
    filters: {
      search?: string
      source?: string
      profileTag?: string
    }
  ) {
    const query = FacebookProfile.query().where('user_id', userId)

    if (filters.source && filters.source !== 'all') query.where('source_type', filters.source)
    if (filters.profileTag && filters.profileTag !== 'all') {
      if (filters.profileTag === '__untagged__') {
        query.where((sub) => {
          sub.whereNull('tags').orWhereRaw(`tags = '[]'::jsonb`)
        })
      } else {
        query.whereRaw(`coalesce(tags, '[]'::jsonb) @> ?::jsonb`, [
          JSON.stringify([filters.profileTag]),
        ])
      }
    }
    if (filters.search) {
      const term = `%${filters.search}%`
      query.where((sub) => {
        sub
          .whereILike('profile_id', term)
          .orWhereILike('profile_name', term)
          .orWhereILike('profile_url', term)
      })
    }

    return query
  }

  async index({ request, inertia, auth }: HttpContext) {
    const user = auth.user!
    const page = Number(request.input('page', 1)) || 1
    const perPage = Math.min(Number(request.input('per_page', 15)) || 15, 100)
    const search = request.input('search')?.toString().trim() || undefined
    const source = request.input('source')?.toString() || 'all'
    const profileTag = request.input('profileTag')?.toString() || 'all'
    const sortInput = request.input('sort', 'created_at')
    const sort = (SORTABLE as readonly string[]).includes(sortInput) ? sortInput : 'created_at'
    const order = request.input('order') === 'asc' ? 'asc' : 'desc'

    const result = await this.scoped(user.id, { search, source, profileTag })
      .orderBy(sort, order)
      .paginate(page, perPage)

    const allOwn = await FacebookProfile.query()
      .where('user_id', user.id)
      .select('id', 'friend_count', 'source_type', 'tags')
      .orderBy('id', 'asc')

    const stats = {
      totalProfile: allOwn.length,
      qualifiedProfile: allOwn.filter((item) => (item.friendCount ?? 0) >= 100).length,
      taggedProfile: allOwn.filter(
        (item) => Array.isArray(item.tags) && (item.tags as string[]).length > 0
      ).length,
      groupMemberProfile: allOwn.filter((item) => item.sourceType === 'group_member').length,
      invitedProfile: allOwn.filter((item) => item.lifecycleStatus === 'invited').length,
    }
    const profileTagOptions = Array.from(
      new Set(
        allOwn.flatMap((item) =>
          Array.isArray(item.tags) ? (item.tags as string[]).filter(Boolean) : []
        )
      )
    ).sort((left, right) => left.localeCompare(right, 'id'))

    return inertia.render('profile/index', {
      profiles: {
        data: result.all().map((profile) => ({
          id: profile.id,
          profileId: profile.profileId,
          profileName: profile.profileName,
          profileUrl: profile.profileUrl,
          friendCount: profile.friendCount,
          mutualFriendCount: profile.mutualFriendCount,
          followerCount: profile.followerCount,
          followingCount: profile.followingCount,
          sourceType: profile.sourceType,
          sourceUrl: profile.sourceUrl,
          lifecycleStatus: profile.lifecycleStatus,
          relationshipStatus: profile.relationshipStatus,
          lastAction: profile.lastAction,
          lastActionStatus: profile.lastActionStatus,
          lastActionMessage: profile.lastActionMessage,
          lastActionAt: profile.lastActionAt ? profile.lastActionAt.toISO() : null,
          tags: Array.isArray(profile.tags) ? (profile.tags as string[]) : [],
          createdAt: profile.createdAt ? profile.createdAt.toISO() : null,
        })),
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
        source,
        profileTag,
        sort,
        order,
        perPage,
      },
      profileTagOptions,
    })
  }

  async bulk({ request, response, session, auth }: HttpContext) {
    const payload = await request.validateUsing(bulkProfileValidator)
    const userId = auth.user!.id

    let query =
      payload.mode === 'all_matching'
        ? this.scoped(userId, {
            search: payload.filters?.search,
            source: payload.filters?.source,
            profileTag: payload.filters?.profileTag,
          })
        : FacebookProfile.query().where('user_id', userId)

    if (payload.mode === 'ids') {
      if (!payload.ids?.length) {
        session.flash('error', 'Pilih minimal satu profile.')
        return response.redirect().back()
      }
      query = query.whereIn('id', payload.ids)
    } else if (payload.excludedIds?.length) {
      query = query.whereNotIn('id', payload.excludedIds)
    }

    const targets = await query

    if (!targets.length) {
      session.flash('error', 'Tidak ada profile yang cocok untuk diproses.')
      return response.redirect().back()
    }

    if (payload.action === 'delete') {
      await FacebookProfile.query()
        .whereIn(
          'id',
          targets.map((row) => row.id)
        )
        .delete()
      session.flash('success', `${targets.length} profile dihapus.`)
      return response.redirect().back()
    }

    const tags = splitGroupTags(payload.tagsText)
    if (['add_tags', 'set_tags', 'remove_tags'].includes(payload.action) && !tags.length) {
      session.flash('error', 'Isi minimal satu label profile.')
      return response.redirect().back()
    }

    for (const profile of targets) {
      const currentTags = Array.isArray(profile.tags) ? (profile.tags as string[]) : []
      if (payload.action === 'add_tags') profile.tags = mergeGroupTags(currentTags, tags)
      if (payload.action === 'set_tags') profile.tags = tags
      if (payload.action === 'remove_tags')
        profile.tags = currentTags.filter((tag) => !tags.includes(tag))
      if (payload.action === 'clear_tags') profile.tags = []
      await profile.save()
    }

    session.flash('success', `${targets.length} profile diperbarui.`)
    return response.redirect().back()
  }

  async import({ request, response, session, auth }: HttpContext) {
    const userId = auth.user!.id
    const file = request.file('file', {
      extnames: ['csv'],
      size: '10mb',
    })

    if (!file) {
      session.flash('error', 'Pilih file CSV terlebih dahulu.')
      return response.redirect().back()
    }

    if (!file.isValid || !file.tmpPath) {
      session.flash('error', file.errors?.[0]?.message ?? 'File CSV tidak valid.')
      return response.redirect().back()
    }

    const defaultSource = this.pickEnum(
      request.input('sourceType')?.toString(),
      SOURCE_TYPES,
      'friend'
    )
    const defaultTags = splitGroupTags(request.input('tagsText')?.toString())

    const csv = await readFile(file.tmpPath, 'utf8')
    const { rows, errors } = this.parseProfileCsv(csv, userId, defaultSource, defaultTags)

    if (!rows.length) {
      session.flash(
        'error',
        errors.length
          ? `Tidak ada profile valid. ${errors.slice(0, 3).join(' ')}`
          : 'Tidak ada profile valid di file CSV.'
      )
      return response.redirect().back()
    }

    const uniqueRows = Array.from(
      new Map(rows.map((row) => [`${row.userId}:${row.profileId}`, row])).values()
    )
    const existing = await FacebookProfile.query()
      .where('user_id', userId)
      .whereIn(
        'profile_id',
        uniqueRows.map((row) => row.profileId)
      )
      .select('profile_id')
    const existingIds = new Set(existing.map((row) => row.profileId))

    for (const row of uniqueRows) {
      await FacebookProfile.updateOrCreate(
        { userId: row.userId, profileId: row.profileId },
        row
      )
    }

    const updated = uniqueRows.filter((row) => existingIds.has(row.profileId)).length
    const created = uniqueRows.length - updated
    const skipped = errors.length + (rows.length - uniqueRows.length)

    session.flash(
      'success',
      `Import selesai. ${created} profile baru, ${updated} profile diperbarui${
        skipped ? `, ${skipped} baris dilewati` : ''
      }.`
    )
    return response.redirect().back()
  }

  private parseProfileCsv(
    csv: string,
    userId: string,
    defaultSource: (typeof SOURCE_TYPES)[number],
    defaultTags: string[]
  ) {
    const lines = this.parseCsv(csv.replace(/^\uFEFF/, ''))
    const [header, ...records] = lines
    const rows: ImportProfileRow[] = []
    const errors: string[] = []

    if (!header?.length) return { rows, errors: ['Header CSV tidak ditemukan.'] }

    const normalizedHeader = header.map((value) => this.normalizeHeader(value))

    for (const [index, record] of records.entries()) {
      if (!record.some((value) => value.trim())) continue

      const raw: CsvRow = {}
      normalizedHeader.forEach((key, columnIndex) => {
        raw[key] = record[columnIndex]?.trim() ?? ''
      })

      const profileUrl = this.pickString(raw, ['profileurl', 'url', 'facebookurl', 'link'])
      const profileId =
        this.pickString(raw, ['profileid', 'fbid', 'facebookid', 'userid']) ||
        this.extractProfileId(profileUrl)

      if (!profileId) {
        errors.push(`Baris ${index + 2}: profile_id/profile_url kosong.`)
        continue
      }

      const sourceType = this.pickEnum(
        this.pickString(raw, ['sourcetype', 'source']),
        SOURCE_TYPES,
        defaultSource
      )
      const lifecycleStatus = this.pickEnum(
        this.pickString(raw, ['lifecyclestatus', 'lifecycle']),
        LIFECYCLE_STATUSES,
        'fresh'
      )
      const relationshipStatus = this.pickEnum(
        this.pickString(raw, ['relationshipstatus', 'relationship']),
        RELATIONSHIP_STATUSES,
        'unknown'
      )
      const rowTags = splitGroupTags(this.pickString(raw, ['tags', 'tag', 'labels', 'label']))

      rows.push({
        userId,
        profileId: profileId.slice(0, 80),
        profileName: this.nullableString(this.pickString(raw, ['profilename', 'name', 'fullname'])),
        profileUrl: this.nullableString(profileUrl)?.slice(0, 500) ?? null,
        friendCount: this.nullableNumber(this.pickString(raw, ['friendcount', 'friends'])),
        mutualFriendCount: this.nullableNumber(
          this.pickString(raw, ['mutualfriendcount', 'mutualfriends', 'mutual'])
        ),
        followerCount: this.nullableNumber(this.pickString(raw, ['followercount', 'followers'])),
        followingCount: this.nullableNumber(this.pickString(raw, ['followingcount', 'following'])),
        sourceType,
        sourceUrl: this.nullableString(this.pickString(raw, ['sourceurl', 'sourceLink']))?.slice(
          0,
          500
        ) ?? null,
        lifecycleStatus,
        relationshipStatus,
        tags: mergeGroupTags(defaultTags, rowTags),
      })
    }

    return { rows, errors }
  }

  private parseCsv(input: string) {
    const rows: string[][] = []
    let row: string[] = []
    let cell = ''
    let quoted = false

    for (let index = 0; index < input.length; index++) {
      const char = input[index]
      const next = input[index + 1]

      if (char === '"') {
        if (quoted && next === '"') {
          cell += '"'
          index++
        } else {
          quoted = !quoted
        }
        continue
      }

      if (char === ',' && !quoted) {
        row.push(cell)
        cell = ''
        continue
      }

      if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && next === '\n') index++
        row.push(cell)
        rows.push(row)
        row = []
        cell = ''
        continue
      }

      cell += char
    }

    row.push(cell)
    if (row.some((value) => value.trim())) rows.push(row)
    return rows
  }

  private normalizeHeader(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '')
  }

  private pickString(row: CsvRow, keys: string[]) {
    for (const key of keys) {
      const value = row[this.normalizeHeader(key)]
      if (value) return value.trim()
    }
    return ''
  }

  private nullableString(value: string) {
    const trimmed = value.trim()
    return trimmed.length ? trimmed : null
  }

  private nullableNumber(value: string) {
    if (!value.trim()) return null
    const normalized = value.replace(/[^\d-]/g, '')
    const number = Number(normalized)
    return Number.isFinite(number) ? number : null
  }

  private pickEnum<const Values extends readonly string[]>(
    value: string | undefined,
    values: Values,
    fallback: Values[number]
  ) {
    return values.includes(value ?? '') ? (value as Values[number]) : fallback
  }

  private extractProfileId(url: string) {
    if (!url) return ''

    try {
      const parsed = new URL(url)
      const id = parsed.searchParams.get('id')
      if (id) return id

      const segments = parsed.pathname.split('/').filter(Boolean)
      if (segments[0] === 'profile.php') return ''
      return segments.at(-1) ?? ''
    } catch {
      return ''
    }
  }
}
