import type { Page } from 'playwright'
import { humanDelay } from '#services/automation/human'

export type ActionResult = { status: 'done' | 'skipped' | 'failed'; message: string }
export type ScrapedGroup = {
  groupId: string
  groupName: string | null
  groupUrl: string
  memberCount: number | null
  groupType: 'public' | 'private' | null
}
export type ScrapedProfile = {
  profileId: string
  profileName: string | null
  profileUrl: string
  friendCount: number | null
  mutualFriendCount: number | null
  followerCount: number | null
  followingCount: number | null
  sourceType: string
  sourceUrl: string | null
}

type GroupTarget = { groupId: string; groupUrl: string | null }
type ProfileTarget = { profileId: string; profileUrl: string | null }
type CampaignConfig = {
  url?: string
  caption?: string
  keyword?: string
  friendProfileUrl?: string
  sourceType?: string
  pageUrl?: string
  scrapeProfileType?: string
  inviteType?: string
  confirmType?: string
}

function groupUrl(g: GroupTarget) {
  return g.groupUrl || `https://www.facebook.com/groups/${g.groupId}`
}

function profileUrl(profile: ProfileTarget) {
  return normalizeFacebookUrl(profile.profileUrl) || canonicalProfileUrl(profile.profileId)
}

function normalizeText(value: string | null | undefined) {
  return value?.replace(/\s+/g, ' ').trim() || ''
}

function normalizeFacebookUrl(value: string | null | undefined) {
  const text = normalizeText(value)
  if (!text) return ''
  return text
    .replace(/^https?:\/\/m\.facebook\.com/i, 'https://www.facebook.com')
    .replace(/^https?:\/\/web\.facebook\.com/i, 'https://www.facebook.com')
    .replace(/^\/+/, 'https://www.facebook.com/')
    .replace(/#.*$/, '')
    .replace(/\/$/, '')
}

function fallbackProfileName(profileId: string | null | undefined) {
  const normalized = normalizeText(profileId)
  if (!normalized) return null
  if (/^\d+$/.test(normalized)) return null

  const text = normalized
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  const lowered = text.toLowerCase()
  if (['facebook', 'meta', 'profile', 'user'].includes(lowered)) return null

  return text.replace(/\b\w/g, (char) => char.toUpperCase())
}

function isBlockedProfileId(profileId: string | null | undefined) {
  const normalized = normalizeText(profileId).toLowerCase()
  if (!normalized) return true

  return new Set([
    'l.php',
    'watch',
    'reel',
    'reels',
    'marketplace',
    'commerce',
    'listing',
    'stories',
    'privacy',
    'policies',
    'saved',
    'memories',
  ]).has(normalized)
}

function isBlockedProfileName(value: string | null | undefined) {
  const lowered = cleanProfileNameCandidate(value).toLowerCase()
  if (!lowered) return false

  const blockedPhrases = [
    'saved',
    'tersimpan',
    'manage page',
    'kelola halaman',
    'privacy center',
    'pusat privasi',
    'facebook terms and policies',
    'ketentuan dan kebijakan facebook',
    'memories',
    'kenangan',
    'this page is not available',
    "this page isn't available",
    'halaman ini tidak tersedia',
  ]

  return blockedPhrases.some((item) => lowered === item || lowered.includes(item))
}

function canonicalProfileUrl(profileId: string | null | undefined) {
  const normalized = normalizeText(profileId)
  if (!normalized) return 'https://www.facebook.com'
  if (/^\d+$/.test(normalized)) {
    return `https://www.facebook.com/profile.php?id=${normalized}`
  }
  return `https://www.facebook.com/${normalized}`
}

function isValidProfileUrl(url: string | null | undefined) {
  const normalized = normalizeFacebookUrl(url)
  if (!normalized) return false
  return profileUrlToId(normalized) !== null
}

function cleanGroupNameCandidate(value: string | null | undefined) {
  let text = normalizeText(value)
  if (!text) return ''

  text = text
    .replace(/^foto profil\s*[:\-|]?\s*/i, '')
    .replace(/^profile photo\s*[:\-|]?\s*/i, '')
    .replace(/^photo de profil\s*[:\-|]?\s*/i, '')
    .trim()

  // Facebook titles often prepend notification counters before the real group name.
  for (let index = 0; index < 3; index++) {
    const nextText = text
      .replace(/^\((?:\d+|\d+\+)\)\s*/i, '')
      .replace(/^\[(?:\d+|\d+\+)\]\s*/i, '')
      .replace(/^\{(?:\d+|\d+\+)\}\s*/i, '')
      .replace(/^\d+\+\s*/i, '')
      .replace(/^\d+\s+new notifications?\s*/i, '')
      .replace(/^\d+\s+notifikasi baru\s*/i, '')
      .replace(/^\d+\s+new messages?\s*/i, '')
      .replace(/^\d+\s+pesan baru\s*/i, '')
      .replace(/^\d+\s+new posts?\s*/i, '')
      .replace(/^\d+\s+postingan baru\s*/i, '')
      .trim()

    if (nextText === text) break
    text = nextText
  }

  text = text.replace(/\s*[-|]\s*facebook.*$/i, '').replace(/\s*[-|]\s*meta.*$/i, '')

  return normalizeText(text)
}

function pickGroupName(...candidates: Array<string | null | undefined>) {
  const blocked = [
    'see more',
    'lihat selengkapnya',
    'public group',
    'private group',
    'grup publik',
    'grup privat',
  ]

  for (const candidate of candidates) {
    const text = cleanGroupNameCandidate(candidate)
    if (!text) continue
    const lowered = text.toLowerCase()
    if (blocked.some((item) => lowered === item)) continue
    if (/(anggota|members?)\b/i.test(text)) continue
    if (text.startsWith('/groups/')) continue
    return text
  }

  return null
}

function parseMemberCount(text: string | null | undefined) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return null

  const match = normalized.match(
    /(\d{1,3}(?:[.,]\d{1,3})*(?:[.,]\d+)?)\s*(k|m|b|rb|ribu|jt|juta|mn|million|billion)?\s*(anggota|member|members)\b/
  )
  if (!match) return null

  const rawNumber = match[1]
  const suffix = match[2] ?? ''
  const compact = rawNumber.replace(/\s+/g, '')
  const hasSuffix = suffix.length > 0
  const numeric = hasSuffix
    ? Number.parseFloat(compact.replace(/\./g, '').replace(',', '.'))
    : Number.parseInt(compact.replace(/[.,]/g, ''), 10)

  if (Number.isNaN(numeric)) return null

  const multiplier =
    suffix === 'k' || suffix === 'rb' || suffix === 'ribu'
      ? 1_000
      : suffix === 'm' ||
          suffix === 'mn' ||
          suffix === 'jt' ||
          suffix === 'juta' ||
          suffix === 'million'
        ? 1_000_000
        : suffix === 'b' || suffix === 'billion'
          ? 1_000_000_000
          : 1

  return Math.round(numeric * multiplier)
}

function parseGroupType(...candidates: Array<string | null | undefined>) {
  for (const candidate of candidates) {
    const text = normalizeText(candidate).toLowerCase()
    if (!text) continue

    if (
      /\b(private group|grup privat|grup private|private community|komunitas privat)\b/i.test(text)
    ) {
      return 'private'
    }

    if (
      /\b(public group|grup publik|grup public|public community|komunitas publik)\b/i.test(text)
    ) {
      return 'public'
    }
  }

  return null
}

function cleanDocumentTitle(title: string | null | undefined) {
  const text = normalizeText(title)
  if (!text) return null

  return pickGroupName(
    text.split('|')[0],
    text.split('-')[0],
    text.replace(/\s*-\s*Facebook.*$/i, ''),
    text.replace(/\s*\|\s*Facebook.*$/i, '')
  )
}

function parseCountByLabels(text: string | null | undefined, labels: string[]): number | null {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return null

  const labelPattern = labels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const match = normalized.match(
    new RegExp(
      `(\\d{1,3}(?:[.,]\\d{1,3})*(?:[.,]\\d+)?)\\s*(k|m|b|rb|ribu|jt|juta|mn|million|billion)?\\s*(?:${labelPattern})\\b`,
      'i'
    )
  )

  if (!match) return null

  const rawNumber = match[1]
  const suffix = (match[2] ?? '').toLowerCase()
  const compact = rawNumber.replace(/\s+/g, '')
  const hasSuffix = suffix.length > 0
  const numeric = hasSuffix
    ? Number.parseFloat(compact.replace(/\./g, '').replace(',', '.'))
    : Number.parseInt(compact.replace(/[.,]/g, ''), 10)

  if (Number.isNaN(numeric)) return null

  const multiplier =
    suffix === 'k' || suffix === 'rb' || suffix === 'ribu'
      ? 1_000
      : suffix === 'm' ||
          suffix === 'mn' ||
          suffix === 'jt' ||
          suffix === 'juta' ||
          suffix === 'million'
        ? 1_000_000
        : suffix === 'b' || suffix === 'billion'
          ? 1_000_000_000
          : 1

  return Math.round(numeric * multiplier)
}

function profileUrlToId(url: string) {
  const normalized = normalizeFacebookUrl(url)
  if (!normalized) return null

  let parsed: URL
  try {
    parsed = new URL(normalized)
  } catch {
    return null
  }

  if (!/(^|\.)facebook\.com$/i.test(parsed.hostname)) return null

  if (/^\/profile\.php$/i.test(parsed.pathname)) {
    const profilePhpId = parsed.searchParams.get('id')
    return normalizeText(profilePhpId) || null
  }

  const segment = parsed.pathname.split('/').filter(Boolean)[0]
  if (!segment) return null

  const blocked = new Set([
    'groups',
    'events',
    'l.php',
    'watch',
    'reel',
    'reels',
    'posts',
    'permalink',
    'marketplace',
    'commerce',
    'listing',
    'search',
    'photos',
    'photo',
    'videos',
    'story.php',
    'stories',
    'messages',
    'settings',
    'help',
    'privacy',
    'policies',
    'gaming',
    'share',
    'saved',
    'friends',
    'followers',
    'following',
    'members',
    'people',
    'pages',
    'hashtag',
    'login',
    'plugins',
    'home.php',
    'home',
  ])

  if (blocked.has(segment.toLowerCase())) return null
  return segment
}

function cleanProfileNameCandidate(value: string | null | undefined) {
  let text = normalizeText(value)
  if (!text) return ''

  text = text
    .replace(/^foto profil\s*[:\-|]?\s*/i, '')
    .replace(/^profile photo\s*[:\-|]?\s*/i, '')
    .replace(/^lihat profil\s*[:\-|]?\s*/i, '')
    .replace(/^see profile\s*[:\-|]?\s*/i, '')
    .replace(
      /\s*(?:memposting ke|posted to|posted in|added a post in|shared to|shared in)\s+.*$/i,
      ''
    )
    .trim()

  return normalizeText(text)
}

function pickProfileName(...candidates: Array<string | null | undefined>) {
  const blocked = [
    'add friend',
    'tambahkan teman',
    'follow',
    'ikuti',
    'message',
    'pesan',
    'see more',
    'lihat selengkapnya',
    'friend',
    'teman',
    'friends',
    'facebook',
    'meta',
    'video',
    'watch',
    'saved',
    'tersimpan',
    'manage page',
    'kelola halaman',
    'privacy center',
    'pusat privasi',
    'facebook terms and policies',
    'ketentuan dan kebijakan facebook',
  ]

  for (const candidate of candidates) {
    const text = cleanProfileNameCandidate(candidate)
    if (!text) continue
    const lowered = text.toLowerCase()
    if (blocked.some((item) => lowered === item || lowered.includes(item))) continue
    if (isBlockedProfileName(text)) continue
    if (/^(https?:\/\/|\/)/i.test(text)) continue
    if (
      /(buat pin|access your chats|obrolan anda|perangkat mana pun|device|chat pin)/i.test(lowered)
    )
      continue
    if (/(followers?|following|mutual|teman)\b/i.test(lowered) && text.split(' ').length <= 3)
      continue
    return text
  }

  return null
}

function resolveScrapeProfileUrl(config: CampaignConfig, sourceUrl?: string | null) {
  const base = normalizeFacebookUrl(sourceUrl ?? config.pageUrl)
  if (!base) return ''

  if (config.scrapeProfileType === 'friend') {
    return /\/friends$/i.test(base) ? base : `${base}/friends`
  }
  if (config.scrapeProfileType === 'page_profile_follower') {
    return /\/followers$/i.test(base) ? base : `${base}/followers`
  }
  if (config.scrapeProfileType === 'engagement_post') return base
  return base
}

export async function extractProfileMetadataFromPage(
  page: Page,
  profile: Pick<ScrapedProfile, 'profileId' | 'profileUrl'>
): Promise<
  Pick<
    ScrapedProfile,
    | 'profileId'
    | 'profileName'
    | 'profileUrl'
    | 'friendCount'
    | 'mutualFriendCount'
    | 'followerCount'
    | 'followingCount'
  >
> {
  const targetUrl = normalizeFacebookUrl(profile.profileUrl)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const snapshot = (await page.evaluate(`(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, [role="heading"]'))
      .map((node) => node.textContent || '')
      .slice(0, 12)

    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="title"]')?.getAttribute('content') ||
      ''

    return {
      url: window.location.href,
      title: document.title,
      ogTitle,
      headings,
      bodyText: document.body?.innerText?.slice(0, 16000) || '',
    }
  })()`)) as {
    url: string
    title: string
    ogTitle: string
    headings: string[]
    bodyText: string
  }

  const resolvedUrl = normalizeFacebookUrl(snapshot.url) || targetUrl
  const resolvedProfileId = profileUrlToId(resolvedUrl) ?? profile.profileId
  const finalProfileUrl = isValidProfileUrl(resolvedUrl)
    ? canonicalProfileUrl(resolvedProfileId)
    : canonicalProfileUrl(profile.profileId)
  return {
    profileId: resolvedProfileId,
    profileUrl: finalProfileUrl,
    profileName:
      pickProfileName(snapshot.ogTitle, cleanDocumentTitle(snapshot.title), ...snapshot.headings) ??
      fallbackProfileName(resolvedProfileId),
    friendCount: parseCountByLabels(snapshot.bodyText, ['friends', 'friend', 'teman']),
    mutualFriendCount: parseCountByLabels(snapshot.bodyText, [
      'mutual friends',
      'mutual friend',
      'teman bersama',
    ]),
    followerCount: parseCountByLabels(snapshot.bodyText, ['followers', 'follower', 'pengikut']),
    followingCount: parseCountByLabels(snapshot.bodyText, ['following', 'mengikuti']),
  }
}

export async function runScrapeProfile(
  page: Page,
  config: CampaignConfig,
  options?: {
    sourceUrl?: string | null
    maxTargets?: number | null
  }
): Promise<ScrapedProfile[]> {
  const targetUrl = resolveScrapeProfileUrl(config, options?.sourceUrl)
  if (!targetUrl) return []

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(3000)

  for (let i = 0; i < 5; i++) {
    await page.evaluate('window.scrollBy(0, window.innerHeight)')
    await humanDelay(1500)
  }

  const rows = (await page.locator('a[href]').evaluateAll((links) =>
    links.map((link) => {
      const href = link.getAttribute('href') || ''
      const container =
        link.closest(
          '[role="article"], [role="listitem"], [role="row"], [role="gridcell"], [data-visualcompletion]'
        ) || link.parentElement

      const heading =
        container?.querySelector('[role="heading"]')?.textContent ||
        link.querySelector('[role="heading"]')?.textContent ||
        ''

      return {
        href,
        linkText: link.textContent || '',
        ariaLabel: link.getAttribute('aria-label') || '',
        headingText: heading,
        containerText: container?.textContent || '',
      }
    })
  )) as Array<{
    href: string
    linkText: string
    ariaLabel: string
    headingText: string
    containerText: string
  }>

  const seen = new Set<string>()
  const out: ScrapedProfile[] = []

  for (const row of rows) {
    const resolvedUrl = normalizeFacebookUrl(row.href)
    const profileId = profileUrlToId(resolvedUrl)
    if (!resolvedUrl || !profileId || seen.has(profileId)) continue

    const resolvedProfileName = pickProfileName(row.headingText, row.linkText, row.ariaLabel)
    if (isBlockedProfileId(profileId)) continue
    if (config.scrapeProfileType === 'engagement_post' && !resolvedProfileName) continue

    seen.add(profileId)

    out.push({
      profileId,
      profileUrl: canonicalProfileUrl(profileId),
      profileName: resolvedProfileName ?? fallbackProfileName(profileId),
      friendCount: parseCountByLabels(row.containerText, ['friends', 'friend', 'teman']),
      mutualFriendCount: parseCountByLabels(row.containerText, [
        'mutual friends',
        'mutual friend',
        'teman bersama',
      ]),
      followerCount: parseCountByLabels(row.containerText, ['followers', 'follower', 'pengikut']),
      followingCount: parseCountByLabels(row.containerText, ['following', 'mengikuti']),
      sourceType: config.scrapeProfileType ?? 'friend',
      sourceUrl: options?.sourceUrl ?? config.pageUrl ?? null,
    })

    if (options?.maxTargets && out.length >= options.maxTargets) break
  }

  return out
}

export async function extractGroupMetadataFromPage(
  page: Page,
  group: GroupTarget
): Promise<Pick<ScrapedGroup, 'groupId' | 'groupName' | 'groupUrl' | 'memberCount' | 'groupType'>> {
  const targetUrl = groupUrl(group)

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const snapshot = (await page.evaluate(`(() => {
    const headings = Array.from(document.querySelectorAll('h1, h2, [role="heading"]'))
      .map((node) => node.textContent || '')
      .slice(0, 12)

    const ogTitle =
      document.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
      document.querySelector('meta[name="title"]')?.getAttribute('content') ||
      ''

    return {
      url: window.location.href,
      title: document.title,
      ogTitle,
      headings,
      bodyText: document.body?.innerText?.slice(0, 12000) || '',
    }
  })()`)) as {
    url: string
    title: string
    ogTitle: string
    headings: string[]
    bodyText: string
  }

  const idFromUrl = snapshot.url.match(/\/groups\/([0-9A-Za-z._-]+)/)?.[1] ?? group.groupId

  return {
    groupId: idFromUrl,
    groupUrl: `https://www.facebook.com/groups/${idFromUrl}`,
    groupName: pickGroupName(
      snapshot.ogTitle,
      cleanDocumentTitle(snapshot.title),
      ...snapshot.headings
    ),
    memberCount: parseMemberCount(snapshot.bodyText),
    groupType: parseGroupType(
      snapshot.ogTitle,
      snapshot.title,
      ...snapshot.headings,
      snapshot.bodyText
    ),
  }
}

/* -------------------------------------------------------------------------- */
/* ⚠️  Facebook DOM is anti-bot and changes frequently. The selectors below    */
/*     are best-effort starting points — validate/adjust with a throwaway      */
/*     account before relying on them.                                         */
/* -------------------------------------------------------------------------- */

export async function runAutoShare(
  page: Page,
  group: GroupTarget,
  config: CampaignConfig
): Promise<ActionResult> {
  await page.goto(groupUrl(group), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const composer = page
    .locator(
      '[role="button"]:has-text("Tulis sesuatu"), [role="button"]:has-text("Write something"), [role="button"]:has-text("Buat postingan")'
    )
    .first()
  if ((await composer.count()) === 0) {
    return { status: 'skipped', message: 'Composer tidak ditemukan (bukan member / DOM berubah).' }
  }

  await composer.click()
  await humanDelay(1500)
  const editor = page.locator('[role="textbox"][contenteditable="true"]').first()
  if ((await editor.count()) === 0)
    return { status: 'failed', message: 'Editor post tidak ditemukan.' }

  await editor.click()
  const text = [config.caption, config.url].filter(Boolean).join('\n\n')
  await editor.type(text, { delay: 30 })
  await humanDelay(2000)

  const postBtn = page
    .locator('[aria-label="Posting"], [aria-label="Post"], div[role="button"]:has-text("Posting")')
    .first()
  if ((await postBtn.count()) === 0)
    return { status: 'failed', message: 'Tombol Post tidak ditemukan.' }

  await postBtn.click()
  await humanDelay(3500)
  return { status: 'done', message: 'Post terkirim (disarankan verifikasi manual).' }
}

export async function runAutoJoin(page: Page, group: GroupTarget): Promise<ActionResult> {
  await page.goto(groupUrl(group), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const joinBtn = page
    .locator(
      '[aria-label="Gabung ke grup"], [aria-label="Join group"], div[role="button"]:has-text("Gabung"), div[role="button"]:has-text("Join")'
    )
    .first()
  if ((await joinBtn.count()) === 0) {
    return { status: 'skipped', message: 'Sudah member / tombol Join tidak ada.' }
  }

  await joinBtn.click()
  await humanDelay(2500)
  return { status: 'done', message: 'Join diklik (public=joined, private=request sent).' }
}

export async function runAutoAddFriend(page: Page, profile: ProfileTarget): Promise<ActionResult> {
  await page.goto(profileUrl(profile), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const addFriendBtn = page
    .locator(
      '[aria-label="Tambahkan teman"], [aria-label="Add friend"], div[role="button"]:has-text("Tambahkan teman"), div[role="button"]:has-text("Add friend")'
    )
    .first()

  if ((await addFriendBtn.count()) === 0) {
    return { status: 'skipped', message: 'Tombol Add Friend tidak ditemukan atau sudah berteman.' }
  }

  await addFriendBtn.click()
  await humanDelay(2500)
  return { status: 'done', message: 'Permintaan pertemanan dikirim.' }
}

export async function runAutoConfirm(
  page: Page,
  config: Pick<CampaignConfig, 'confirmType'>
): Promise<ActionResult & { processedCount: number }> {
  if ((config.confirmType ?? 'friend') !== 'friend') {
    return {
      status: 'skipped',
      message: 'Auto confirm tipe group belum diimplementasikan.',
      processedCount: 0,
    }
  }

  await page.goto('https://www.facebook.com/friends/requests', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await humanDelay(2500)

  const confirmButtons = page.locator(
    '[aria-label="Konfirmasi"], [aria-label="Confirm"], div[role="button"]:has-text("Konfirmasi"), div[role="button"]:has-text("Confirm")'
  )

  const initialCount = await confirmButtons.count()
  if (initialCount === 0) {
    return {
      status: 'skipped',
      message: 'Tidak ada permintaan pertemanan yang siap dikonfirmasi.',
      processedCount: 0,
    }
  }

  let processedCount = 0
  const maxProcessed = Math.min(initialCount, 10)
  for (let index = 0; index < maxProcessed; index++) {
    const button = confirmButtons.first()
    if ((await button.count()) === 0) break
    await button.click()
    processedCount++
    await humanDelay(1800)
  }

  return {
    status: 'done',
    message: `${processedCount} permintaan pertemanan dikonfirmasi.`,
    processedCount,
  }
}

export async function runAutoInvite(
  page: Page,
  profile: ProfileTarget & { profileName?: string | null },
  config: Pick<CampaignConfig, 'inviteType' | 'url'>
): Promise<ActionResult> {
  const inviteTargetUrl = normalizeFacebookUrl(config.url)
  if (!inviteTargetUrl) {
    return { status: 'failed', message: 'URL target invite belum diisi.' }
  }

  await page.goto(inviteTargetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const inviteOpenButton = page
    .locator(
      [
        '[aria-label="Undang teman"]',
        '[aria-label="Invite friends"]',
        '[aria-label="Undang"]',
        '[aria-label="Invite"]',
        'div[role="button"]:has-text("Undang teman")',
        'div[role="button"]:has-text("Invite friends")',
        'div[role="button"]:has-text("Undang")',
        'div[role="button"]:has-text("Invite")',
      ].join(', ')
    )
    .first()

  if ((await inviteOpenButton.count()) === 0) {
    return {
      status: 'skipped',
      message: `Tombol invite ${config.inviteType ?? 'target'} tidak ditemukan.`,
    }
  }

  await inviteOpenButton.click()
  await humanDelay(2000)

  const dialog = page.locator('div[role="dialog"]').last()
  if ((await dialog.count()) === 0) {
    return { status: 'failed', message: 'Dialog invite tidak muncul.' }
  }

  const targetName = normalizeText(profile.profileName) || fallbackProfileName(profile.profileId)
  if (!targetName) {
    return {
      status: 'skipped',
      message: 'Nama profile target tidak cukup jelas untuk pencarian invite.',
    }
  }

  const searchInput = dialog
    .locator(
      [
        'input[type="search"]',
        'input[placeholder*="Cari"]',
        'input[placeholder*="Search"]',
        'input[aria-label*="Cari"]',
        'input[aria-label*="Search"]',
      ].join(', ')
    )
    .first()

  if ((await searchInput.count()) > 0) {
    await searchInput.click()
    await searchInput.fill('')
    await searchInput.type(targetName, { delay: 35 })
    await humanDelay(1800)
  }

  const candidateRow = dialog
    .locator('[role="row"], [role="listitem"], [role="option"], li, div[data-visualcompletion]')
    .filter({ hasText: targetName })
    .first()

  if ((await candidateRow.count()) === 0) {
    return {
      status: 'skipped',
      message: `Target "${targetName}" tidak muncul di dialog invite.`,
    }
  }

  const chooseTarget = candidateRow
    .locator(
      [
        '[role="checkbox"]',
        'input[type="checkbox"]',
        '[aria-label="Undang"]',
        '[aria-label="Invite"]',
        'div[role="button"]:has-text("Undang")',
        'div[role="button"]:has-text("Invite")',
      ].join(', ')
    )
    .first()

  if ((await chooseTarget.count()) === 0) {
    await candidateRow.click()
  } else {
    await chooseTarget.click()
  }
  await humanDelay(1500)

  const sendButton = dialog
    .locator(
      [
        '[aria-label="Kirim undangan"]',
        '[aria-label="Send invites"]',
        '[aria-label="Kirim"]',
        '[aria-label="Send"]',
        'div[role="button"]:has-text("Kirim undangan")',
        'div[role="button"]:has-text("Send invites")',
        'div[role="button"]:has-text("Kirim")',
        'div[role="button"]:has-text("Send")',
      ].join(', ')
    )
    .first()

  if ((await sendButton.count()) > 0) {
    await sendButton.click()
    await humanDelay(2000)
  }

  return {
    status: 'done',
    message: `Invite untuk "${targetName}" dikirim.`,
  }
}

export async function runScrapeGroup(page: Page, config: CampaignConfig): Promise<ScrapedGroup[]> {
  if (config.sourceType === 'friend_joined_group' && config.friendProfileUrl) {
    const base = config.friendProfileUrl.replace(/\/$/, '')
    await page.goto(`${base}/groups`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  } else {
    await page.goto(
      `https://www.facebook.com/search/groups/?q=${encodeURIComponent(config.keyword ?? '')}`,
      { waitUntil: 'domcontentloaded', timeout: 60000 }
    )
  }
  await humanDelay(3000)

  // Scroll a few times to load more results (string form avoids DOM lib types).
  for (let i = 0; i < 5; i++) {
    await page.evaluate('window.scrollBy(0, window.innerHeight)')
    await humanDelay(1500)
  }

  const anchors = page.locator('a[href*="/groups/"]')
  const rows = await anchors.evaluateAll((links) =>
    links.map((link) => {
      const href = link.getAttribute('href') || ''
      const container =
        link.closest(
          '[role="article"], [role="listitem"], [role="feed"] > div, [data-visualcompletion]'
        ) || link.parentElement

      const heading =
        container?.querySelector('[role="heading"]')?.textContent ||
        link.querySelector('[role="heading"]')?.textContent ||
        ''

      return {
        href,
        linkText: link.textContent || '',
        ariaLabel: link.getAttribute('aria-label') || '',
        headingText: heading,
        containerText: container?.textContent || '',
      }
    })
  )

  const seen = new Set<string>()
  const out: ScrapedGroup[] = []
  for (const row of rows) {
    const match = row.href.match(/\/groups\/([0-9A-Za-z._-]+)/)
    if (!match) continue
    const id = match[1]
    if (id === 'search' || id === 'feed' || seen.has(id)) continue
    seen.add(id)

    out.push({
      groupId: id,
      groupName: pickGroupName(row.headingText, row.linkText, row.ariaLabel),
      groupUrl: `https://www.facebook.com/groups/${id}`,
      memberCount: parseMemberCount(row.containerText),
      groupType: parseGroupType(row.ariaLabel, row.headingText, row.linkText, row.containerText),
    })
  }
  return out
}
