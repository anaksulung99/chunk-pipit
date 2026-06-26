import type { Locator, Page } from 'playwright'
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

async function firstVisibleLocator(root: Page | Locator, selectors: string[]) {
  for (const selector of selectors) {
    const locator = root.locator(selector).first()
    if ((await locator.count()) === 0) continue
    try {
      if (await locator.isVisible()) return locator
    } catch {
      continue
    }
  }

  return null
}

async function firstVisibleCandidate(candidates: Locator[]) {
  for (const candidate of candidates) {
    const locator = candidate.first()
    if ((await locator.count()) === 0) continue
    try {
      if (await locator.isVisible()) return locator
    } catch {
      continue
    }
  }

  return null
}

async function lastVisibleDialog(page: Page) {
  const dialogs = page.locator('div[role="dialog"]')
  const count = await dialogs.count()
  for (let index = count - 1; index >= 0; index--) {
    const dialog = dialogs.nth(index)
    try {
      if (await dialog.isVisible()) return dialog
    } catch {
      continue
    }
  }

  return null
}

async function closeTopDialog(page: Page) {
  try {
    await page.keyboard.press('Escape')
    await humanDelay(800)
  } catch {
    // ignore
  }
}

async function clickBestEffort(locator: Locator) {
  await locator.click({ force: true }).catch(async () => {
    await locator.evaluate((node) => {
      ;(node as HTMLElement).click()
    })
  })
}

async function waitForVisibleCandidate(
  candidates: Locator[],
  waitsMs: number[] = [0, 1200, 2500, 4000]
) {
  for (const waitMs of waitsMs) {
    if (waitMs > 0) await humanDelay(waitMs)
    const candidate = await firstVisibleCandidate(candidates)
    if (candidate) return candidate
  }

  return null
}

async function replaceInputValue(locator: Locator, value: string) {
  await locator.click()

  try {
    await locator.fill('')
    await locator.fill(value)
    return
  } catch {
    // Some Facebook search fields are contenteditable rather than plain inputs.
  }

  await locator.press('Control+A')
  await locator.press('Backspace')
  await locator.type(value, { delay: 35 })
}

function inviteSearchTerms(profile: ProfileTarget & { profileName?: string | null }) {
  const terms: string[] = []
  const seen = new Set<string>()

  const push = (value: string | null | undefined) => {
    const normalized = normalizeText(value)
    if (!normalized) return
    const key = normalized.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    terms.push(normalized)
  }

  const targetName = normalizeText(profile.profileName) || fallbackProfileName(profile.profileId)
  push(targetName)

  const withoutAlias = normalizeText(targetName?.replace(/\s*\([^)]*\)\s*/g, ' '))
  if (withoutAlias && withoutAlias !== targetName) push(withoutAlias)

  const firstTwoWords = withoutAlias.split(' ').slice(0, 2).join(' ')
  if (firstTwoWords.split(' ').length >= 2) push(firstTwoWords)

  if (!/^\d+$/.test(profile.profileId)) {
    push(fallbackProfileName(profile.profileId))
  }

  return terms
}

function isChatLikeInviteDialog(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'search messenger',
    'chats',
    'new message',
    'new message requests',
    'see all in messenger',
    'messenger',
    'obrolan',
    'pesan baru',
    'permintaan pesan',
  ]

  return markers.some((item) => normalized.includes(item))
}

function isGroupExpertDialog(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = ['add group experts', 'tambahkan pakar grup', 'group experts']
  return markers.some((item) => normalized.includes(item))
}

function isLoginWallText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'log in',
    'forgotten account',
    'forgotten password',
    'create new account',
    'email address or phone number',
    'password',
    'see more from',
    'scan the qr code',
    'lupa akun',
    'buat akun baru',
    'alamat email atau nomor telepon',
    'kata sandi',
  ]

  return markers.some((item) => normalized.includes(item))
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
    'recover',
    'business',
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
    'konten ini tidak tersedia saat ini',
    "this content isn't available right now",
    'content not available',
  ]

  return blockedPhrases.some((item) => lowered === item || lowered.includes(item))
}

function hasPageLikeContainerText(value: string | null | undefined) {
  const lowered = normalizeText(value).toLowerCase()
  if (!lowered) return false

  const pageIndicators = [
    'halaman',
    'page',
    'public figure',
    'video creator',
    'content creator',
    'digital creator',
    'shopping & retail',
    'shopping and retail',
    'musician/band',
    'musician',
    'artist',
    'news & media website',
    'news and media website',
    'local business',
    'product/service',
    'product or service',
    'just for fun',
    'government organization',
    'community',
    'community organization',
    'medical & health',
    'restaurant',
    'company',
    'brand',
    'advertising agency',
    'real estate',
    'website',
    'gamer',
    'gaming video creator',
  ]

  return pageIndicators.some((item) => lowered.includes(item))
}

function looksLikePageSlug(profileId: string, profileName?: string | null) {
  const normalizedId = normalizeText(profileId).toLowerCase()
  if (!normalizedId) return false

  if (/(?:[a-z0-9]+-){3,}[a-z0-9]+-\d{8,}$/i.test(normalizedId)) return true

  const normalizedName = cleanProfileNameCandidate(profileName).toLowerCase()
  if (!normalizedName) return false

  if (normalizedId.includes('-') && !normalizedName.includes(' ') && /\d{8,}$/.test(normalizedId)) {
    return true
  }

  return false
}

function isLikelyEngagementProfileCandidate(row: {
  profileId: string
  profileName: string | null
  containerText: string | null | undefined
}) {
  if (isBlockedProfileId(row.profileId)) return false
  if (isBlockedProfileName(row.profileName)) return false
  if (hasPageLikeContainerText(row.containerText)) return false
  if (looksLikePageSlug(row.profileId, row.profileName)) return false
  return true
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
    'chat',
    'chats',
    'obrolan',
    'messenger',
    'kotak masuk',
    'inbox',
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
  profile: Pick<ScrapedProfile, 'profileId' | 'profileUrl' | 'profileName'>
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
      pickProfileName(
        snapshot.ogTitle,
        cleanDocumentTitle(snapshot.title),
        ...snapshot.headings,
        profile.profileName
      ) ??
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
  const sourceOwnerId = config.scrapeProfileType === 'engagement_post' ? profileUrlToId(targetUrl) : null

  for (const row of rows) {
    const resolvedUrl = normalizeFacebookUrl(row.href)
    const profileId = profileUrlToId(resolvedUrl)
    if (!resolvedUrl || !profileId || seen.has(profileId)) continue

    const resolvedProfileName = pickProfileName(row.headingText, row.linkText, row.ariaLabel)
    if (isBlockedProfileId(profileId)) continue
    if (sourceOwnerId && profileId === sourceOwnerId) continue
    if (config.scrapeProfileType === 'engagement_post' && !resolvedProfileName) continue
    if (
      config.scrapeProfileType === 'engagement_post' &&
      !isLikelyEngagementProfileCandidate({
        profileId,
        profileName: resolvedProfileName ?? fallbackProfileName(profileId),
        containerText: row.containerText,
      })
    ) {
      continue
    }

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

export async function runAutoUnfriend(page: Page, profile: ProfileTarget): Promise<ActionResult> {
  await page.goto(profileUrl(profile), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const bodyText = normalizeText(await page.locator('body').innerText().catch(() => ''))
  if (!bodyText) {
    return { status: 'failed', message: 'Halaman profile gagal dimuat.' }
  }

  if (/add friend|tambahkan teman/i.test(bodyText)) {
    return {
      status: 'skipped',
      message: 'Target belum berteman atau tombol friendship tidak tersedia.',
    }
  }

  const friendshipButton = await firstVisibleLocator(page, [
    '[aria-label="Friends"]',
    '[aria-label="Teman"]',
    '[aria-label*="Friends"]',
    '[aria-label*="Teman"]',
    'div[role="button"]:has-text("Friends")',
    'div[role="button"]:has-text("Teman")',
    'button:has-text("Friends")',
    'button:has-text("Teman")',
  ])

  if (!friendshipButton) {
    return {
      status: 'skipped',
      message: 'Tombol friendship tidak ditemukan pada profile target.',
    }
  }

  await clickBestEffort(friendshipButton)
  await humanDelay(1500)

  const unfriendButton = await firstVisibleLocator(page, [
    '[aria-label="Unfriend"]',
    '[aria-label="Hapus pertemanan"]',
    '[aria-label="Batalkan pertemanan"]',
    '[role="menuitem"]:has-text("Unfriend")',
    '[role="menuitem"]:has-text("Hapus pertemanan")',
    '[role="menuitem"]:has-text("Batalkan pertemanan")',
    'div[role="button"]:has-text("Unfriend")',
    'div[role="button"]:has-text("Hapus pertemanan")',
    'div[role="button"]:has-text("Batalkan pertemanan")',
    'button:has-text("Unfriend")',
    'button:has-text("Hapus pertemanan")',
    'button:has-text("Batalkan pertemanan")',
  ])

  if (!unfriendButton) {
    await closeTopDialog(page)
    return {
      status: 'skipped',
      message: 'Menu unfriend tidak ditemukan pada profile target.',
    }
  }

  await clickBestEffort(unfriendButton)
  await humanDelay(1800)

  const confirmUnfriendButton = await firstVisibleLocator(page, [
    '[aria-label="Confirm"]',
    '[aria-label="Konfirmasi"]',
    '[aria-label="Unfriend"]',
    '[aria-label="Hapus pertemanan"]',
    '[aria-label="Batalkan pertemanan"]',
    'div[role="button"]:has-text("Confirm")',
    'div[role="button"]:has-text("Konfirmasi")',
    'div[role="button"]:has-text("Unfriend")',
    'div[role="button"]:has-text("Hapus pertemanan")',
    'div[role="button"]:has-text("Batalkan pertemanan")',
    'button:has-text("Confirm")',
    'button:has-text("Konfirmasi")',
    'button:has-text("Unfriend")',
    'button:has-text("Hapus pertemanan")',
    'button:has-text("Batalkan pertemanan")',
  ])

  if (confirmUnfriendButton) {
    await clickBestEffort(confirmUnfriendButton)
    await humanDelay(1800)
  }

  return { status: 'done', message: 'Pertemanan berhasil diputus dari profile target.' }
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
  const inviteType = config.inviteType ?? 'group'
  const inviteTargetUrl = normalizeFacebookUrl(config.url)
  if (!inviteTargetUrl) {
    return { status: 'failed', message: 'URL target invite belum diisi.' }
  }

  await page.goto(inviteTargetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  let pageBodyText = normalizeText(await page.locator('body').innerText().catch(() => ''))
  let pageIdentitySwitched = false
  const mainContent = page.locator('[role="main"]').first()

  if (
    /continue as /i.test(pageBodyText) ||
    /lanjutkan sebagai /i.test(pageBodyText) ||
    /use another profile/i.test(pageBodyText) ||
    /gunakan profil lain/i.test(pageBodyText)
  ) {
    const continueAsButton = await firstVisibleCandidate([
      page.getByText(/continue as /i),
      page.getByText(/lanjutkan sebagai /i),
      mainContent.getByText(/continue as /i),
      mainContent.getByText(/lanjutkan sebagai /i),
      page.locator('div[role="button"]:has-text("Continue as")'),
      page.locator('div[role="button"]:has-text("Lanjutkan sebagai")'),
      page.locator('button:has-text("Continue as")'),
      page.locator('button:has-text("Lanjutkan sebagai")'),
    ])

    if (continueAsButton) {
      await clickBestEffort(continueAsButton)
      await humanDelay(4000)
      pageBodyText = normalizeText(await page.locator('body').innerText().catch(() => ''))
    }
  }

  const openInviteSelectors = [
    '[aria-label="Undang teman"]',
    '[aria-label="Invite friends"]',
    '[aria-label="Undang orang"]',
    '[aria-label="Invite people"]',
    '[aria-label*="Undang"]',
    '[aria-label*="Invite"]',
    'button:has-text("Undang teman")',
    'button:has-text("Invite friends")',
    'button:has-text("Undang orang")',
    'button:has-text("Invite people")',
    'button:has-text("Undang")',
    'button:has-text("Invite")',
    'a:has-text("Undang teman")',
    'a:has-text("Invite friends")',
    'a:has-text("Undang")',
    'a:has-text("Invite")',
    'div[role="button"]:has-text("Undang teman")',
    'div[role="button"]:has-text("Invite friends")',
    'div[role="button"]:has-text("Undang orang")',
    'div[role="button"]:has-text("Invite people")',
    'div[role="button"]:has-text("Undang")',
    'div[role="button"]:has-text("Invite")',
  ]

  const groupAddMemberSelectors = [
    '[aria-label="Add members"]',
    '[aria-label="Tambahkan anggota"]',
    'button:has-text("Add members")',
    'button:has-text("Tambah anggota")',
    'div[role="button"]:has-text("Add members")',
    'div[role="button"]:has-text("Tambah anggota")',
  ]

  const pageInviteCandidates = [
    mainContent.getByText('Invite friends to like your Page', { exact: true }),
    mainContent.getByText('Undang teman untuk menyukai Halaman Anda', { exact: true }),
    mainContent.getByText('Invite friends to like Page', { exact: true }),
  ]

  const pageMoreOptionsCandidates = [
    page.locator('[aria-label="Profile settings see more options"]'),
    mainContent.locator('[aria-label="Profile settings see more options"]'),
    page.locator('[aria-label*="see more options"]'),
    page.locator('[aria-haspopup="menu"][aria-label*="Profile settings"]'),
  ]

  if (inviteType === 'page_follower') {
    if (/switch into .* page/i.test(pageBodyText) || /switch now/i.test(pageBodyText)) {
      const switchPageButton = await firstVisibleCandidate([
        mainContent.getByText('Switch Now', { exact: true }),
        mainContent.getByText('Beralih sekarang', { exact: true }),
        mainContent.getByText("Switch into Nadiva Beauty Shop's Page", { exact: false }),
        page.locator('[role="main"] [aria-label="Switch Now"]'),
        page.locator('[role="main"] [aria-label*="Switch"]'),
      ])

      if (switchPageButton) {
        await clickBestEffort(switchPageButton)
        await humanDelay(5000)
        pageBodyText = normalizeText(await page.locator('body').innerText().catch(() => ''))
        pageIdentitySwitched = true
      }

      if (/switch into .* page/i.test(pageBodyText) || /switch now/i.test(pageBodyText)) {
        return {
          status: 'skipped',
          message: 'Perlu switch ke identitas Page dulu sebelum invite follower bisa dijalankan.',
        }
      }
    }
  }

  let inviteOpenButton: Locator | null = null
  let invalidInviteReason: string | null = null
  let dialog: Locator | null = null
  const pageShowsLoginWall = isLoginWallText(pageBodyText)

  if (inviteType === 'group') {
    const membersUrl = /\/members$/i.test(inviteTargetUrl) ? inviteTargetUrl : `${inviteTargetUrl}/members`
    if (normalizeFacebookUrl(page.url()) !== membersUrl) {
      await page.goto(membersUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await humanDelay(2500)
    }

    const addMembersButton = await firstVisibleLocator(mainContent, groupAddMemberSelectors)
    if (addMembersButton) {
      await addMembersButton.click()
      await humanDelay(2000)
      dialog = await lastVisibleDialog(page)

      if (dialog) {
        const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
        if (isGroupExpertDialog(dialogText)) {
          invalidInviteReason = 'CTA Add members yang tersedia membuka dialog group experts, bukan invite member.'
          dialog = null
          await closeTopDialog(page)
        } else if (isChatLikeInviteDialog(dialogText)) {
          invalidInviteReason = 'CTA Add members yang tersedia membuka panel chat/share, bukan invite member.'
          dialog = null
          await closeTopDialog(page)
        }
      }
    }

    if (!dialog) {
      inviteOpenButton = await firstVisibleLocator(mainContent, openInviteSelectors)
      if (inviteOpenButton) {
        await inviteOpenButton.click()
        await humanDelay(2000)
        dialog = await lastVisibleDialog(page)

        if (dialog) {
          const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
          if (isChatLikeInviteDialog(dialogText)) {
            invalidInviteReason = 'Tombol Invite yang tersedia membuka panel chat/share, bukan invite member.'
            dialog = null
            await closeTopDialog(page)
          } else if (isGroupExpertDialog(dialogText)) {
            invalidInviteReason = 'Tombol Invite yang tersedia membuka dialog group experts, bukan invite member.'
            dialog = null
            await closeTopDialog(page)
          }
        }
      }
    }

  } else {
    inviteOpenButton =
      (await waitForVisibleCandidate(pageInviteCandidates, [0, 1500, 2500])) ||
      (await firstVisibleLocator(mainContent, openInviteSelectors))

    if (inviteOpenButton) {
      await clickBestEffort(inviteOpenButton)
      await humanDelay(2000)
      dialog = await lastVisibleDialog(page)
    } else if (inviteType === 'page_follower') {
      const pageMoreOptionsButton = await waitForVisibleCandidate(pageMoreOptionsCandidates, [
        0, 1500, 3000, 5000,
      ])
      if (pageMoreOptionsButton) {
        await clickBestEffort(pageMoreOptionsButton)
        await humanDelay(1500)

        const inviteMenuItem = await firstVisibleCandidate([
          page.locator('[role="menuitem"]').filter({ hasText: 'Invite friends' }),
          page.locator('[role="menuitem"]').filter({ hasText: 'Undang teman' }),
          page.locator('[role="menu"]').locator('[role="menuitem"]').filter({ hasText: 'Invite friends' }),
          page.locator('[role="menu"]').locator('[role="menuitem"]').filter({ hasText: 'Undang teman' }),
        ])

        if (inviteMenuItem) {
          await clickBestEffort(inviteMenuItem)
          await humanDelay(2000)
          dialog = await lastVisibleDialog(page)
        } else {
          const loginWallDialog = await lastVisibleDialog(page)
          const loginWallText = normalizeText(await loginWallDialog?.innerText().catch(() => ''))
          if (isLoginWallText(loginWallText || pageBodyText)) {
            invalidInviteReason =
              'Facebook menampilkan login wall saat membuka menu Page, jadi dialog invite follower belum bisa diakses.'
          }
        }
      }
    }
  }

  if (!dialog) {
    if (invalidInviteReason) {
      return {
        status: 'skipped',
        message: invalidInviteReason,
      }
    }

    if (!inviteOpenButton) {
      if (inviteType === 'page_follower' && pageShowsLoginWall) {
        return {
          status: 'skipped',
          message:
            'Fanspage menampilkan login wall/public-page gate, jadi menu Invite friends belum bisa diakses dari session ini.',
        }
      }

      const joinButton = await firstVisibleLocator(page, [
        '[aria-label="Gabung ke grup"]',
        '[aria-label="Join group"]',
        'button:has-text("Gabung")',
        'button:has-text("Join")',
        'div[role="button"]:has-text("Gabung")',
        'div[role="button"]:has-text("Join")',
      ])

      if (joinButton) {
        return {
          status: 'skipped',
          message: 'Akun belum join atau belum punya akses invite ke group target.',
        }
      }

      return {
        status: 'skipped',
        message: `Tombol invite ${inviteType} tidak ditemukan.`,
      }
    }

    if (inviteType === 'page_follower' && pageIdentitySwitched) {
      return {
        status: 'skipped',
        message: 'Identitas Page sudah aktif, tetapi CTA invite follower belum muncul di halaman.',
      }
    }

    return { status: 'failed', message: 'Dialog invite tidak muncul.' }
  }

  const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
  if (isChatLikeInviteDialog(dialogText)) {
    return {
      status: 'skipped',
      message: 'Dialog yang muncul adalah panel chat/share, bukan invite member.',
    }
  }

  if (isLoginWallText(dialogText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login wall, jadi dialog invite follower belum bisa diakses.',
    }
  }

  const searchTerms = inviteSearchTerms(profile)
  const targetName = searchTerms[0]
  if (!targetName) {
    return {
      status: 'skipped',
      message: 'Nama profile target tidak cukup jelas untuk pencarian invite.',
    }
  }

  const searchInput = await firstVisibleLocator(dialog, [
    'input[type="search"]',
    'input[placeholder*="Cari"]',
    'input[placeholder*="Search"]',
    'input[aria-label*="Cari"]',
    'input[aria-label*="Search"]',
    '[role="searchbox"]',
    '[role="textbox"][contenteditable="true"]',
  ])

  let candidateRow: Locator | null = null
  for (const term of searchTerms) {
    if (searchInput) {
      await replaceInputValue(searchInput, term)
      await humanDelay(1800)
    }

    const nextCandidateRow =
      inviteType === 'page_follower'
        ? dialog.locator('[role="checkbox"]').filter({ hasText: term }).first()
        : dialog
            .locator('[role="row"], [role="listitem"], [role="option"], li, div[data-visualcompletion]')
            .filter({ hasText: term })
            .first()

    if ((await nextCandidateRow.count()) > 0) {
      candidateRow = nextCandidateRow
      break
    }
  }

  if (!candidateRow || (await candidateRow.count()) === 0) {
    return {
      status: 'skipped',
      message: `Target "${targetName}" tidak muncul di dialog invite.`,
    }
  }

  const chooseTarget = await firstVisibleLocator(candidateRow, [
    '[role="checkbox"]',
    'input[type="checkbox"]',
    '[aria-label="Pilih"]',
    '[aria-label="Select"]',
    '[aria-label="Undang"]',
    '[aria-label="Invite"]',
    'button:has-text("Pilih")',
    'button:has-text("Select")',
    'button:has-text("Undang")',
    'button:has-text("Invite")',
    'div[role="button"]:has-text("Pilih")',
    'div[role="button"]:has-text("Select")',
    'div[role="button"]:has-text("Undang")',
    'div[role="button"]:has-text("Invite")',
  ])

  if (!chooseTarget) {
    await candidateRow.click()
  } else {
    await chooseTarget.click()
  }
  await humanDelay(1500)

  const sendButton = await firstVisibleLocator(dialog, [
    '[aria-label="Kirim undangan"]',
    '[aria-label="Send Invites"]',
    '[aria-label="Send invites"]',
    '[aria-label="Kirim undangan ke teman"]',
    '[aria-label="Send invite to friends"]',
    '[aria-label*="Send Invite"]',
    '[aria-label*="Kirim undangan"]',
    '[aria-label="Kirim"]',
    '[aria-label="Send"]',
    'button:has-text("Kirim undangan")',
    'button:has-text("Send Invites")',
    'button:has-text("Send invites")',
    'button:has-text("Kirim")',
    'button:has-text("Send")',
    'div[role="button"]:has-text("Kirim undangan")',
    'div[role="button"]:has-text("Send Invites")',
    'div[role="button"]:has-text("Send invites")',
    'div[role="button"]:has-text("Kirim")',
    'div[role="button"]:has-text("Send")',
  ])

  if (!sendButton) {
    return {
      status: 'skipped',
      message: `Target "${targetName}" belum bisa dipilih untuk invite atau tombol kirim tidak muncul.`,
    }
  }

  const sendDisabled =
    (await sendButton.getAttribute('disabled')) !== null ||
    (await sendButton.getAttribute('aria-disabled')) === 'true'
  if (sendDisabled) {
    return {
      status: 'skipped',
      message: `Target "${targetName}" belum aktif untuk dikirim invite.`,
    }
  }

  await sendButton.click()
  await humanDelay(2000)

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
