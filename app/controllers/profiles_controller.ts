import FacebookProfile from '#models/facebook_profile'
import { mergeGroupTags, splitGroupTags } from '#services/group/tags'
import { bulkProfileValidator } from '#validators/profile'
import type { HttpContext } from '@adonisjs/core/http'

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
        allOwn.flatMap((item) => (Array.isArray(item.tags) ? (item.tags as string[]).filter(Boolean) : []))
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
      await FacebookProfile.query().whereIn('id', targets.map((row) => row.id)).delete()
      session.flash('success', `${targets.length} profile dihapus.`)
      return response.redirect().back()
    }

    const tags = splitGroupTags(payload.tagsText)
    if (
      ['add_tags', 'set_tags', 'remove_tags'].includes(payload.action) &&
      !tags.length
    ) {
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
}
