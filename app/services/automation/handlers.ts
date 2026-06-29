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
  manualGroupUrl?: string
  sourceType?: string
  pageUrl?: string
  scrapeProfileType?: string
  inviteType?: string
  postType?: string
  commentType?: string
  inboxType?: string
  deleteType?: string
  confirmType?: string
  createType?: string
  groupPrivacy?: string
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

function facebookPostIdFromUrl(value: string | null | undefined) {
  const normalized = normalizeFacebookUrl(value)
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    const byPath = parsed.pathname.match(/\/posts\/(\d+)/i)?.[1]
    if (byPath) return byPath

    const storyFbid = parsed.searchParams.get('story_fbid')
    if (storyFbid) return normalizeText(storyFbid) || null

    const byInsights = parsed.pathname.match(/\/post_insights\/(\d+)/i)?.[1]
    if (byInsights) return byInsights
  } catch {
    return null
  }

  return null
}

function facebookCommentIdFromUrl(value: string | null | undefined) {
  const normalized = normalizeFacebookUrl(value)
  if (!normalized) return null

  try {
    const parsed = new URL(normalized)
    const commentId =
      parsed.searchParams.get('comment_id') || parsed.searchParams.get('reply_comment_id')
    if (commentId) return normalizeText(commentId) || null
  } catch {
    return null
  }

  return null
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

function randomBetween(min: number, max: number) {
  const floor = Math.min(min, max)
  const ceil = Math.max(min, max)
  return Math.round(floor + Math.random() * (ceil - floor))
}

function inboxMessageTemplates(value: string | null | undefined) {
  const normalized = value?.replace(/\r\n/g, '\n').trim() || ''
  if (!normalized) return []

  return normalized
    .split(/\n\s*(?:---+|\*{3,}|={3,})\s*\n/g)
    .map((item) => item.trim())
    .filter(Boolean)
}

function pickRandomItem<T>(items: T[]) {
  if (!items.length) return null
  return items[Math.floor(Math.random() * items.length)] ?? null
}

function profileFirstName(
  profileName: string | null | undefined,
  profileId: string | null | undefined
) {
  const resolved = normalizeText(profileName) || fallbackProfileName(profileId)
  if (!resolved) return ''
  return normalizeText(resolved.split(' ')[0])
}

function renderInboxTemplate(
  template: string,
  profile: ProfileTarget & { profileName?: string | null }
) {
  const fullName =
    normalizeText(profile.profileName) || fallbackProfileName(profile.profileId) || 'sob'
  const firstName = profileFirstName(profile.profileName, profile.profileId) || fullName
  const profileId = normalizeText(profile.profileId)

  return template
    .replace(/\{name\}|\{\{\s*name\s*\}\}/gi, fullName)
    .replace(/\{firstName\}|\{\{\s*firstName\s*\}\}/gi, firstName)
    .replace(/\{profileId\}|\{\{\s*profileId\s*\}\}/gi, profileId)
}

function resolveInboxMessage(
  profile: ProfileTarget & { profileName?: string | null },
  caption: string | null | undefined
) {
  const templates = inboxMessageTemplates(caption)
  const selected = pickRandomItem(templates)
  if (!selected) return null
  return normalizeText(renderInboxTemplate(selected, profile))
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

async function waitForSettledDialog(
  page: Page,
  dialog: Locator | null,
  waitsMs: number[] = [0, 1200, 2500, 4000]
) {
  let latestDialog = dialog

  for (const waitMs of waitsMs) {
    if (waitMs > 0) await humanDelay(waitMs)
    latestDialog = (await lastVisibleDialog(page)) ?? latestDialog
    if (!latestDialog) continue

    const label = normalizeText(await latestDialog.getAttribute('aria-label').catch(() => ''))
    const text = normalizeText(await latestDialog.innerText().catch(() => ''))
    const looksLoading = /^loading/i.test(label) || (!text && /loading/i.test(label))

    if (!looksLoading && (text || label)) return latestDialog
  }

  return latestDialog
}

async function resolveTargetPostRoot(page: Page, targetUrl: string) {
  const postId = facebookPostIdFromUrl(targetUrl)
  if (!postId) return null

  const marked = await page.evaluate((resolvedPostId) => {
    document
      .querySelectorAll('[data-trae-target-post="1"]')
      .forEach((node) => node.removeAttribute('data-trae-target-post'))

    const candidates = Array.from(document.querySelectorAll('a[href]')).filter((anchor) => {
      const href = anchor.getAttribute('href') || ''
      return (
        href.includes(`/posts/${resolvedPostId}`) ||
        href.includes(`story_fbid=${resolvedPostId}`) ||
        href.includes(`/post_insights/${resolvedPostId}`)
      )
    })

    const textMarkers = [
      'comment as',
      'komentar sebagai',
      'no comments yet',
      'belum ada komentar',
      'view insights',
      'post reach',
      'like',
      'suka',
    ]

    for (const anchor of candidates) {
      let current: HTMLElement | null = anchor.parentElement
      for (let depth = 0; depth < 12 && current; depth++) {
        const text = (current.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
        const buttonCount = current.querySelectorAll('[role="button"], button').length
        if (textMarkers.some((item) => text.includes(item)) && buttonCount >= 2) {
          current.setAttribute('data-trae-target-post', '1')
          return true
        }
        current = current.parentElement
      }
    }

    return false
  }, postId)

  if (!marked) return null

  const root = page.locator('[data-trae-target-post="1"]').first()
  if ((await root.count()) === 0) return null
  return root
}

async function resolveFacebookContinueAs(page: Page) {
  const continueButton = await firstVisibleLocator(page, [
    '[aria-label^="Continue as "]',
    '[aria-label^="Lanjutkan sebagai "]',
    'div[role="button"]:has-text("Continue as")',
    'div[role="button"]:has-text("Lanjutkan sebagai")',
    'button:has-text("Continue as")',
    'button:has-text("Lanjutkan sebagai")',
  ])

  if (!continueButton) return false

  await clickBestEffort(continueButton)
  await humanDelay(2200)
  return true
}

async function hasVisibleReactionState(root: Page | Locator) {
  const reactionSummary = await firstVisibleLocator(root, [
    '[aria-label^="Like:"]',
    '[aria-label^="Suka:"]',
    '[aria-label*="people"]',
    '[aria-label*="orang"]',
    '[aria-label="See who reacted to this"]',
    '[aria-label="Lihat siapa yang bereaksi"]',
  ])

  return Boolean(reactionSummary)
}

async function findCommentEditor(root: Page | Locator) {
  return firstVisibleLocator(root, [
    '[role="textbox"][contenteditable="true"][aria-label*="Comment"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Komentar"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Comment as"]',
    '[role="textbox"][contenteditable="true"][aria-label*="Komentari sebagai"]',
    '[contenteditable="true"][aria-label*="Write a comment"]',
    '[contenteditable="true"][aria-label*="Tulis komentar"]',
    '[contenteditable="true"][aria-label*="Comment as"]',
    '[contenteditable="true"][aria-label*="Komentari sebagai"]',
    '[contenteditable="true"][aria-placeholder*="Write a comment"]',
    '[contenteditable="true"][aria-placeholder*="Tulis komentar"]',
    '[contenteditable="true"][aria-placeholder*="Comment as"]',
    '[contenteditable="true"][aria-placeholder*="Komentari sebagai"]',
  ])
}

async function resolveCommentComposerRoot(page: Page, editor: Locator) {
  const marked = await editor
    .evaluate((node) => {
      document
        .querySelectorAll('[data-trae-comment-composer="1"]')
        .forEach((item) => item.removeAttribute('data-trae-comment-composer'))

      let current: HTMLElement | null = node as HTMLElement
      for (let depth = 0; depth < 8 && current; depth++) {
        if (
          current.tagName === 'FORM' ||
          current.querySelector('[aria-label="Post comment"], [aria-label="Kirim komentar"]')
        ) {
          current.setAttribute('data-trae-comment-composer', '1')
          return true
        }
        current = current.parentElement
      }

      return false
    })
    .catch(() => false)

  if (!marked) return null

  const root = page.locator('[data-trae-comment-composer="1"]').first()
  if ((await root.count()) === 0) return null
  return root
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

function isSwitchProfilesDialogText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'switch profiles',
    'see all profiles',
    'switch to ',
    'switch now',
    'beralih profil',
    'lihat semua profil',
    'beralih ke ',
  ]

  return markers.some((item) => normalized.includes(item))
}

function isMemberInviteDialogText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const titleMarkers = [
    'invite friends',
    'undang teman',
    'invite people',
    'undang orang',
    'invite members',
    'undang anggota',
  ]
  const bodyMarkers = [
    'all friends',
    'semua teman',
    'select all',
    'pilih semua',
    'not invited',
    'belum diundang',
    'send invites',
    'send invite',
    'kirim undangan',
    'search in all friends',
    'cari di semua teman',
  ]

  const hasTitleMarker = titleMarkers.some((item) => normalized.includes(item))
  const bodyMarkerCount = bodyMarkers.filter((item) => normalized.includes(item)).length

  return (hasTitleMarker && bodyMarkerCount >= 1) || bodyMarkerCount >= 2
}

async function isLikelyMemberInviteDialog(dialog: Locator) {
  const dialogLabel = normalizeText(await dialog.getAttribute('aria-label').catch(() => ''))
  if (/(invite friends|undang teman)/i.test(dialogLabel)) return true

  const visibleMarker = await firstVisibleLocator(dialog, [
    '[aria-label="Invite friends"]',
    '[aria-label="Undang teman"]',
    '[aria-label="All friends"]',
    '[aria-label="Semua teman"]',
    '[aria-label^="Select All"]',
    '[aria-label^="Pilih Semua"]',
    '[aria-label="Send Invites"]',
    '[aria-label="Send invites"]',
    '[aria-label="Kirim undangan"]',
    'button:has-text("Send Invites")',
    'button:has-text("Kirim undangan")',
  ])
  if (visibleMarker) return true

  const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
  return isMemberInviteDialogText(dialogText)
}

async function tryOpenGroupInviteDialogFromMenu(
  page: Page,
  moreOptionsCandidates: Locator[],
  inviteMenuItemCandidates: Locator[],
  locationLabel: string
): Promise<{
  inviteTrigger: Locator | null
  dialog: Locator | null
  invalidReason: string | null
  observation: string | null
}> {
  const moreOptionsButton = await waitForVisibleCandidate(
    moreOptionsCandidates,
    [0, 1200, 2500, 4000]
  )
  if (!moreOptionsButton) {
    return {
      inviteTrigger: null,
      dialog: null,
      invalidReason: null,
      observation: `CTA see more options tidak terlihat pada ${locationLabel}.`,
    }
  }

  await moreOptionsButton.scrollIntoViewIfNeeded().catch(() => {})
  await clickBestEffort(moreOptionsButton)
  await humanDelay(1500)

  const inviteMenuItem = await waitForVisibleCandidate(
    inviteMenuItemCandidates,
    [0, 800, 1800, 3000]
  )
  if (!inviteMenuItem) {
    await closeTopDialog(page)
    return {
      inviteTrigger: moreOptionsButton,
      dialog: null,
      invalidReason: null,
      observation: `Menu see more options terbuka pada ${locationLabel}, tetapi item Invite friends/people/members tidak terlihat.`,
    }
  }

  await inviteMenuItem.scrollIntoViewIfNeeded().catch(() => {})
  await clickBestEffort(inviteMenuItem)
  await humanDelay(2000)

  const dialog = await lastVisibleDialog(page)
  if (!dialog) {
    return {
      inviteTrigger: inviteMenuItem,
      dialog: null,
      invalidReason: `Menu Invite friends pada ${locationLabel} dipilih, tetapi dialog invite tidak muncul.`,
      observation: null,
    }
  }

  const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
  if (isGroupExpertDialog(dialogText)) {
    await closeTopDialog(page)
    return {
      inviteTrigger: inviteMenuItem,
      dialog: null,
      invalidReason: `Menu Invite friends pada ${locationLabel} membuka dialog group experts, bukan invite member.`,
      observation: null,
    }
  }

  if (isChatLikeInviteDialog(dialogText)) {
    await closeTopDialog(page)
    return {
      inviteTrigger: inviteMenuItem,
      dialog: null,
      invalidReason: `Menu Invite friends pada ${locationLabel} membuka panel chat/share, bukan invite member.`,
      observation: null,
    }
  }

  if (!(await isLikelyMemberInviteDialog(dialog))) {
    await closeTopDialog(page)
    return {
      inviteTrigger: inviteMenuItem,
      dialog: null,
      invalidReason: `Menu Invite friends pada ${locationLabel} membuka surface lain yang belum cocok dengan dialog invite member.`,
      observation: null,
    }
  }

  return {
    inviteTrigger: inviteMenuItem,
    dialog,
    invalidReason: null,
    observation: null,
  }
}

async function resolveSwitchProfilesDialog(
  page: Page,
  dialog: Locator
): Promise<{
  switched: boolean
  observation: string | null
}> {
  const switchButtonCandidates = [
    dialog.locator('[role="button"][aria-label="Switch"]'),
    dialog.locator('[role="button"][aria-label="Beralih"]'),
    dialog.locator('[role="button"][aria-label^="Switch to "]'),
    dialog.locator('[role="button"][aria-label^="Beralih ke "]'),
    dialog.locator('button').filter({ hasText: 'Switch' }),
    dialog.locator('button').filter({ hasText: 'Beralih' }),
    dialog.locator('[role="button"]').filter({ hasText: 'Switch' }),
    dialog.locator('[role="button"]').filter({ hasText: 'Beralih' }),
  ]

  let switchButton = await firstVisibleCandidate(switchButtonCandidates)
  if (!switchButton) {
    const seeAllProfilesButton = await firstVisibleCandidate([
      dialog.getByText('See all profiles', { exact: true }),
      dialog.getByText('Lihat semua profil', { exact: true }),
      dialog.locator('[role="button"]').filter({ hasText: 'See all profiles' }),
      dialog.locator('[role="button"]').filter({ hasText: 'Lihat semua profil' }),
    ])

    if (seeAllProfilesButton) {
      await clickBestEffort(seeAllProfilesButton)
      await humanDelay(1800)
      switchButton = await firstVisibleCandidate(switchButtonCandidates)
    }
  }

  if (!switchButton) {
    return {
      switched: false,
      observation: 'Dialog Switch profiles muncul, tetapi tombol Switch tidak terlihat.',
    }
  }

  const switchLabel =
    normalizeText(await switchButton.getAttribute('aria-label').catch(() => '')) ||
    normalizeText(await switchButton.innerText().catch(() => ''))

  await clickBestEffort(switchButton)
  await page.waitForLoadState('domcontentloaded').catch(() => {})
  await humanDelay(4500)

  return {
    switched: true,
    observation: `Dialog Switch profiles berhasil dipakai dengan aksi "${switchLabel || 'Switch'}".`,
  }
}

function isInviteAlreadyStateText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'invited',
    'invite sent',
    'already invited',
    'already a member',
    'already likes this page',
    'already following',
    'sudah diundang',
    'undangan terkirim',
    'sudah menjadi anggota',
    'sudah menyukai halaman ini',
    'sudah mengikuti',
  ]

  return markers.some((item) => normalized.includes(item))
}

function isInviteSuccessText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'invite sent',
    'invites sent',
    'invitation sent',
    'sent',
    'successfully invited',
    'undangan terkirim',
    'berhasil diundang',
    'berhasil mengundang',
  ]

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

function isNoFriendRequestText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'no new friend requests',
    'you have no new friend requests',
    'no friend requests available',
    'tidak ada permintaan pertemanan baru',
    'belum ada permintaan pertemanan',
    'tidak ada permintaan baru',
  ]

  return markers.some((item) => normalized.includes(item))
}

function isNoGroupRequestText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    'no pending member requests',
    'no pending members',
    'no pending requests',
    'no new member requests',
    'there are no pending members',
    'you have no pending requests',
    'tidak ada permintaan anggota',
    'tidak ada permintaan bergabung',
    'belum ada permintaan anggota',
    'semua permintaan anggota sudah diproses',
  ]

  return markers.some((item) => normalized.includes(item))
}

function resolveGroupBaseUrl(value: string | null | undefined) {
  const normalized = normalizeFacebookUrl(value)
  if (!normalized) return ''

  try {
    const parsed = new URL(normalized)
    const match = parsed.pathname.match(/^\/groups\/([^/?#]+)/i)
    if (!match?.[1]) return normalized
    return `https://www.facebook.com/groups/${match[1]}`
  } catch {
    return normalized
  }
}

function groupMemberRequestUrls(value: string | null | undefined) {
  const normalized = normalizeFacebookUrl(value)
  const baseUrl = resolveGroupBaseUrl(value)
  const candidates = [
    normalized,
    baseUrl,
    baseUrl ? `${baseUrl}/member_requests` : '',
    baseUrl ? `${baseUrl}/pending_members` : '',
    baseUrl ? `${baseUrl}/admin_assist?tab=member_requests` : '',
    baseUrl ? `${baseUrl}/member-requests` : '',
  ]

  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = normalizeText(candidate)
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function resolveCreatedGroupUrl(value: string | null | undefined) {
  const baseUrl = resolveGroupBaseUrl(value)
  if (!baseUrl) return ''
  if (/\/groups\/create\b/i.test(baseUrl)) return ''
  return baseUrl
}

async function fillFirstVisibleInput(root: Page | Locator, selectors: string[], value: string) {
  const input = await firstVisibleLocator(root, selectors)
  if (!input) return false
  await input.scrollIntoViewIfNeeded().catch(() => {})
  await replaceInputValue(input, value)
  return true
}

async function snapshotGroupRequestSurface(page: Page) {
  const snapshot = await page
    .evaluate(() => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim()

      const isVisible = (element: Element) => {
        const node = element as HTMLElement
        const style = window.getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        return (
          style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0
        )
      }

      const keywords = [
        'member',
        'request',
        'approve',
        'setujui',
        'manage',
        'admin',
        'pending',
        'join',
        'anggota',
        'permintaan',
        'gabung',
        'moderation',
      ]
      const selectors = [
        'button',
        '[role="button"]',
        'a[href]',
        '[role="link"]',
        '[role="tab"]',
        '[aria-label]',
        'h1',
        'h2',
        'h3',
      ]

      const controls: string[] = []
      const seen = new Set<string>()
      for (const node of Array.from(document.querySelectorAll(selectors.join(',')))) {
        if (!(node instanceof HTMLElement)) continue
        if (!isVisible(node)) continue

        const label = normalize(node.getAttribute('aria-label'))
        const text = normalize(node.innerText || node.textContent)
        const value = label || text
        if (!value) continue

        const lowered = value.toLowerCase()
        if (!keywords.some((keyword) => lowered.includes(keyword))) continue
        if (seen.has(lowered)) continue
        seen.add(lowered)
        controls.push(value)
        if (controls.length >= 10) break
      }

      const bodyLines = normalize(document.body?.innerText)
        .split(/(?<=[.!?])\s+|\n+/)
        .map((item) => normalize(item))
        .filter(Boolean)
        .filter((line) => keywords.some((keyword) => line.toLowerCase().includes(keyword)))
        .slice(0, 6)

      return {
        title: normalize(document.title) || null,
        url: window.location.href,
        controls,
        bodyLines,
      }
    })
    .catch(() => null)

  if (!snapshot) return 'surface=tidak terbaca'

  const parts = [
    snapshot.title ? `title=${snapshot.title}` : null,
    snapshot.url ? `url=${snapshot.url}` : null,
    snapshot.controls.length ? `controls=${snapshot.controls.join(' | ')}` : 'controls=tidak ada',
    snapshot.bodyLines.length ? `body=${snapshot.bodyLines.join(' | ')}` : 'body=tidak ada',
  ].filter(Boolean)

  return parts.join('; ')
}

type ConfirmedRequestProfile = {
  profileId: string | null
  profileUrl: string | null
  profileName: string | null
}

async function snapshotConfirmedRequestProfile(
  button: Locator
): Promise<ConfirmedRequestProfile | null> {
  const snapshot = await button
    .evaluate((node) => {
      const normalize = (value: string | null | undefined) =>
        String(value ?? '')
          .replace(/\s+/g, ' ')
          .trim()

      const blocked = new Set([
        'friends',
        'friend',
        'teman',
        'confirm',
        'konfirmasi',
        'delete',
        'hapus',
        'see all',
        'lihat semua',
        'marketplace',
        'watch',
        'gaming',
        'messages',
        'friends/requests',
        'friends/center',
      ])

      const getCandidateLink = (root: Element) => {
        const anchors = Array.from(root.querySelectorAll('a[href]'))
        for (const anchor of anchors) {
          const rawHref = anchor.getAttribute('href')
          if (!rawHref) continue

          try {
            const url = new URL(rawHref, window.location.origin)
            if (!/(^|\.)facebook\.com$/i.test(url.hostname)) continue

            if (/^\/profile\.php$/i.test(url.pathname) && url.searchParams.get('id')) {
              return { href: url.toString(), text: normalize(anchor.textContent) }
            }

            const segment = url.pathname.split('/').filter(Boolean)[0]?.toLowerCase() ?? ''
            if (!segment || blocked.has(segment)) continue

            return { href: url.toString(), text: normalize(anchor.textContent) }
          } catch {
            continue
          }
        }

        return null
      }

      let current = node instanceof Element ? node : null
      for (let depth = 0; current && depth < 7; depth++, current = current.parentElement) {
        const link = getCandidateLink(current)
        const texts = [
          link?.text,
          current.querySelector('strong')?.textContent,
          current.querySelector('h2, h3, h4')?.textContent,
          current.getAttribute('aria-label'),
        ]
          .map((item) => normalize(item))
          .filter(Boolean)

        if (link?.href || texts.length) {
          return {
            href: link?.href ?? null,
            name: texts[0] ?? null,
          }
        }
      }

      return null
    })
    .catch(() => null)

  if (!snapshot) return null

  const pUrl = normalizeFacebookUrl(snapshot.href)
  const profileId = pUrl ? profileUrlToId(pUrl) : null
  const profileName = pickProfileName(snapshot.name, fallbackProfileName(profileId))

  if (!profileId && !profileName) return null

  return {
    profileId,
    profileUrl: pUrl ? (profileId ? canonicalProfileUrl(profileId) : pUrl) : null,
    profileName: profileName || fallbackProfileName(profileId),
  }
}

function isDeletedContentText(text: string) {
  const normalized = normalizeText(text).toLowerCase()
  if (!normalized) return false

  const markers = [
    "this content isn't available right now",
    'content not available',
    "this page isn't available",
    'this page is not available',
    'konten ini tidak tersedia saat ini',
    'halaman ini tidak tersedia',
    'no comments yet',
    'belum ada komentar',
    'comment was deleted',
    'komentar telah dihapus',
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
      ) ?? fallbackProfileName(resolvedProfileId),
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
  const sourceOwnerId =
    config.scrapeProfileType === 'engagement_post' ? profileUrlToId(targetUrl) : null

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

  let pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(pageBodyText)) {
    const topDialog = await lastVisibleDialog(page)
    const dialogText = normalizeText(await topDialog?.innerText().catch(() => ''))
    if (isLoginWallText(dialogText || pageBodyText)) {
      return {
        status: 'skipped',
        message:
          'Facebook menampilkan login/public wall pada group target, jadi composer posting belum bisa diakses dari session ini.',
      }
    }
  }

  const composer = page
    .locator(
      '[role="button"]:has-text("Tulis sesuatu"), [role="button"]:has-text("Write something"), [role="button"]:has-text("Buat postingan")'
    )
    .first()
  if ((await composer.count()) === 0) {
    pageBodyText = normalizeText(
      await page
        .locator('body')
        .innerText()
        .catch(() => '')
    )
    if (isLoginWallText(pageBodyText)) {
      return {
        status: 'skipped',
        message:
          'Facebook menampilkan login/public wall pada group target, jadi composer posting belum bisa diakses dari session ini.',
      }
    }
    return { status: 'skipped', message: 'Composer tidak ditemukan (bukan member / DOM berubah).' }
  }

  await clickBestEffort(composer)
  await humanDelay(1500)

  const dialog = await lastVisibleDialog(page)
  const dialogText = normalizeText(await dialog?.innerText().catch(() => ''))
  if (isLoginWallText(dialogText)) {
    return {
      status: 'skipped',
      message:
        'Facebook menampilkan login/public wall saat membuka composer posting, jadi post belum bisa dikirim dari session ini.',
    }
  }
  let editor = dialog
    ? await firstVisibleLocator(dialog, [
        '[role="textbox"][contenteditable="true"]:not([aria-label*="Comment"])',
        '[role="textbox"][contenteditable="true"]:not([aria-label*="Komentar"])',
        '[role="textbox"][contenteditable="true"]',
      ])
    : null

  if (!editor) {
    editor = await firstVisibleLocator(page, [
      '[role="dialog"] [role="textbox"][contenteditable="true"]:not([aria-label*="Comment"])',
      '[role="dialog"] [role="textbox"][contenteditable="true"]:not([aria-label*="Komentar"])',
      '[role="dialog"] [role="textbox"][contenteditable="true"]',
    ])
  }

  if (!editor) {
    return { status: 'failed', message: 'Editor post tidak ditemukan.' }
  }

  await clickBestEffort(editor)
  const text = [config.caption, config.url].filter(Boolean).join('\n\n')
  await editor.type(text, { delay: 30 })
  await humanDelay(2000)

  const postBtn = dialog
    ? await firstVisibleLocator(dialog, [
        '[aria-label="Posting"]',
        '[aria-label="Post"]',
        'div[role="button"]:has-text("Posting")',
        'div[role="button"]:has-text("Post")',
        'button:has-text("Posting")',
        'button:has-text("Post")',
      ])
    : await firstVisibleLocator(page, [
        '[role="dialog"] [aria-label="Posting"]',
        '[role="dialog"] [aria-label="Post"]',
        '[role="dialog"] div[role="button"]:has-text("Posting")',
        '[role="dialog"] div[role="button"]:has-text("Post")',
        '[role="dialog"] button:has-text("Posting")',
        '[role="dialog"] button:has-text("Post")',
      ])
  const resolvedPostBtn =
    postBtn ||
    (await firstVisibleLocator(page, [
      '[aria-label="Posting"]',
      '[aria-label="Post"]',
      'div[role="button"]:has-text("Posting")',
      'div[role="button"]:has-text("Post")',
      'button:has-text("Posting")',
      'button:has-text("Post")',
    ]))
  if (!resolvedPostBtn)
    return {
      status: isLoginWallText(dialogText) ? 'skipped' : 'failed',
      message: isLoginWallText(dialogText)
        ? 'Facebook menampilkan login/public wall di modal posting, jadi tombol kirim belum bisa diakses.'
        : 'Tombol Post tidak ditemukan.',
    }

  await clickBestEffort(resolvedPostBtn)
  await humanDelay(3500)
  return { status: 'done', message: 'Post terkirim (disarankan verifikasi manual).' }
}

export async function runAutoPost(
  page: Page,
  group: GroupTarget,
  config: Pick<CampaignConfig, 'caption' | 'url'> & { postType?: string }
): Promise<ActionResult> {
  if ((config.postType ?? 'group') !== 'group') {
    return {
      status: 'skipped',
      message: 'Auto Post saat ini baru mendukung target group.',
    }
  }

  return runAutoShare(page, group, config)
}

export async function runAutoLike(
  page: Page,
  config: Pick<CampaignConfig, 'url'>
): Promise<ActionResult> {
  const targetUrl = normalizeFacebookUrl(config.url)
  if (!targetUrl) {
    return {
      status: 'failed',
      message: 'URL target Auto Like kosong.',
    }
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(pageBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada URL target like.',
    }
  }

  const targetRoot = await resolveTargetPostRoot(page, targetUrl)
  const searchRoot = targetRoot ?? page

  const unlikeButton = await firstVisibleLocator(searchRoot, [
    '[aria-label="Unlike"]',
    '[aria-label="Batal suka"]',
    '[aria-label*="Unlike"]',
    '[aria-label*="Batal suka"]',
    'div[role="button"]:has-text("Unlike")',
    'div[role="button"]:has-text("Batal suka")',
    'button:has-text("Unlike")',
    'button:has-text("Batal suka")',
  ])
  if (unlikeButton) {
    return {
      status: 'skipped',
      message: 'Konten tampak sudah di-like oleh akun ini.',
    }
  }

  const likeButton = await firstVisibleLocator(searchRoot, [
    '[aria-label="React"]',
    '[aria-label="Tanggapi"]',
    '[aria-label="Like"]',
    '[aria-label="Suka"]',
    'div[role="button"]:has-text("Like")',
    'div[role="button"]:has-text("Suka")',
    'button:has-text("Like")',
    'button:has-text("Suka")',
  ])

  if (!likeButton) {
    return {
      status: 'skipped',
      message: targetRoot
        ? 'Tombol Like tidak ditemukan pada post target.'
        : 'Tombol Like tidak ditemukan pada URL target.',
    }
  }

  await clickBestEffort(likeButton)
  await humanDelay(1800)

  const unlikeAfterClick = await firstVisibleLocator(searchRoot, [
    '[aria-label="Unlike"]',
    '[aria-label="Batal suka"]',
    '[aria-label*="Unlike"]',
    '[aria-label*="Batal suka"]',
    'div[role="button"]:has-text("Unlike")',
    'div[role="button"]:has-text("Batal suka")',
    'button:has-text("Unlike")',
    'button:has-text("Batal suka")',
  ])
  const reactionStateVisible = await hasVisibleReactionState(searchRoot)
  if (!unlikeAfterClick && !reactionStateVisible) {
    return {
      status: 'failed',
      message: 'Klik Like tidak mengubah state post target.',
    }
  }

  return {
    status: 'done',
    message: 'Like berhasil dikirim.',
  }
}

export async function runAutoComment(
  page: Page,
  config: Pick<CampaignConfig, 'url' | 'caption'> & { commentType?: string }
): Promise<ActionResult> {
  if ((config.commentType ?? 'post') !== 'post') {
    return {
      status: 'skipped',
      message: 'Auto Comment saat ini baru mendukung target post.',
    }
  }

  const targetUrl = normalizeFacebookUrl(config.url)
  if (!targetUrl) {
    return {
      status: 'failed',
      message: 'URL target Auto Comment kosong.',
    }
  }

  const commentText = normalizeText(config.caption)
  if (!commentText) {
    return {
      status: 'failed',
      message: 'Caption comment kosong.',
    }
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(pageBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada URL target comment.',
    }
  }

  const targetRoot = await resolveTargetPostRoot(page, targetUrl)
  const searchRoot = targetRoot ?? page

  let editor = (await findCommentEditor(searchRoot)) || (await findCommentEditor(page))

  if (!editor) {
    const commentButton = await firstVisibleLocator(searchRoot, [
      '[aria-label="Comment"]',
      '[aria-label="Komentar"]',
      '[aria-label="Leave a comment"]',
      '[aria-label="Tinggalkan komentar"]',
      'div[role="button"]:has-text("Comment")',
      'div[role="button"]:has-text("Komentar")',
      'button:has-text("Comment")',
      'button:has-text("Komentar")',
    ])

    if (commentButton) {
      await clickBestEffort(commentButton)
      await humanDelay(1500)
      editor = (await findCommentEditor(searchRoot)) || (await findCommentEditor(page))
    }
  }

  if (!editor) {
    return {
      status: 'skipped',
      message: targetRoot
        ? 'Editor comment tidak ditemukan pada post target.'
        : 'Editor comment tidak ditemukan pada URL target.',
    }
  }

  await clickBestEffort(editor)
  await editor.type(commentText, { delay: randomBetween(18, 42) })
  await humanDelay(900)

  const composerRoot = await resolveCommentComposerRoot(page, editor)
  const submitButton =
    (composerRoot
      ? await firstVisibleLocator(composerRoot, [
          '[aria-label="Post comment"]',
          '[aria-label="Kirim komentar"]',
          '[aria-label="Send"]',
          '[aria-label="Kirim"]',
          '[aria-label="Comment"]',
          '[aria-label="Komentar"]',
          'div[role="button"]:has-text("Post comment")',
          'div[role="button"]:has-text("Kirim komentar")',
          'button:has-text("Post comment")',
          'button:has-text("Kirim komentar")',
          'div[role="button"]:has-text("Send")',
          'div[role="button"]:has-text("Kirim")',
          'button:has-text("Send")',
          'button:has-text("Kirim")',
        ])
      : null) ||
    (await firstVisibleLocator(searchRoot, [
      '[aria-label="Post comment"]',
      '[aria-label="Kirim komentar"]',
      '[aria-label="Send"]',
      '[aria-label="Kirim"]',
      '[aria-label="Comment"]',
      '[aria-label="Komentar"]',
      'div[role="button"]:has-text("Post comment")',
      'div[role="button"]:has-text("Kirim komentar")',
      'button:has-text("Post comment")',
      'button:has-text("Kirim komentar")',
      'div[role="button"]:has-text("Send")',
      'div[role="button"]:has-text("Kirim")',
      'button:has-text("Send")',
      'button:has-text("Kirim")',
    ])) ||
    (await firstVisibleLocator(page, [
      '[aria-label="Post comment"]',
      '[aria-label="Kirim komentar"]',
      '[aria-label="Send"]',
      '[aria-label="Kirim"]',
      '[aria-label="Comment"]',
      '[aria-label="Komentar"]',
      'div[role="button"]:has-text("Post comment")',
      'div[role="button"]:has-text("Kirim komentar")',
      'button:has-text("Post comment")',
      'button:has-text("Kirim komentar")',
      'div[role="button"]:has-text("Send")',
      'div[role="button"]:has-text("Kirim")',
      'button:has-text("Send")',
      'button:has-text("Kirim")',
    ]))

  if (submitButton) {
    await clickBestEffort(submitButton)
  } else {
    await editor.press('Enter')
  }

  await humanDelay(1800)
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const refreshedBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  const commentAppeared = refreshedBodyText.includes(commentText)
  if (!commentAppeared) {
    return {
      status: 'failed',
      message: 'Comment belum terverifikasi muncul pada post target.',
    }
  }

  return {
    status: 'done',
    message: 'Comment berhasil dikirim.',
  }
}

async function resolveDeleteMenuButton(
  page: Page,
  targetUrl: string,
  deleteType: 'post' | 'comment'
) {
  const targetRoot = deleteType === 'post' ? await resolveTargetPostRoot(page, targetUrl) : null

  const exactSelectors =
    deleteType === 'comment'
      ? [
          '[aria-label="Edit or delete this"]',
          '[aria-label="Edit or delete this comment"]',
          '[aria-label="Edit atau hapus komentar ini"]',
          'div[role="button"]:has-text("Edit or delete this")',
          'button:has-text("Edit or delete this")',
        ]
      : [
          '[aria-label="Edit or delete this"]',
          '[aria-label="Edit or delete this post"]',
          '[aria-label="Actions for this post"]',
          '[aria-label="Tindakan untuk postingan ini"]',
          'div[role="button"]:has-text("Edit or delete this")',
          'button:has-text("Edit or delete this")',
          'div[role="button"]:has-text("Actions for this post")',
          'button:has-text("Actions for this post")',
        ]

  const overflowSelectors =
    deleteType === 'post'
      ? [
          '[aria-label="More"]',
          '[aria-label="Lainnya"]',
          'div[role="button"][aria-haspopup="menu"]',
          'button[aria-haspopup="menu"]',
        ]
      : []

  return (
    (targetRoot ? await firstVisibleLocator(targetRoot, exactSelectors) : null) ||
    (await firstVisibleLocator(page, exactSelectors)) ||
    (targetRoot && overflowSelectors.length
      ? await firstVisibleLocator(targetRoot, overflowSelectors)
      : null)
  )
}

async function resolveDeleteAction(page: Page) {
  return firstVisibleLocator(page, [
    '[role="menuitem"]:has-text("Delete")',
    '[role="menuitem"]:has-text("Hapus")',
    'div[role="button"]:has-text("Delete")',
    'div[role="button"]:has-text("Hapus")',
    'button:has-text("Delete")',
    'button:has-text("Hapus")',
  ])
}

async function resolveDeleteConfirm(page: Page) {
  return firstVisibleLocator(page, [
    '[aria-label="Delete"]',
    '[aria-label="Hapus"]',
    '[aria-label="Delete post"]',
    '[aria-label="Delete comment"]',
    '[aria-label="Hapus postingan"]',
    '[aria-label="Hapus komentar"]',
    'button:has-text("Delete")',
    'button:has-text("Hapus")',
    'div[role="button"]:has-text("Delete")',
    'div[role="button"]:has-text("Hapus")',
  ])
}

async function verifyDeleteResult(page: Page, targetUrl: string, deleteType: 'post' | 'comment') {
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const bodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isDeletedContentText(bodyText)) return true

  if (deleteType === 'comment') {
    const commentId = facebookCommentIdFromUrl(targetUrl)
    if (!commentId) return false

    const commentLinkCount = await page
      .locator(`a[href*="comment_id=${commentId}"]`)
      .count()
      .catch(() => 0)
    const commentArticleCount = await page
      .locator(`article:has(a[href*="comment_id=${commentId}"])`)
      .count()
      .catch(() => 0)

    return commentLinkCount === 0 && commentArticleCount === 0
  }

  const postId = facebookPostIdFromUrl(targetUrl)
  if (!postId) return false

  const targetRoot = await resolveTargetPostRoot(page, targetUrl)
  const postLinkCount = await page
    .locator(
      `a[href*="/posts/${postId}"], a[href*="story_fbid=${postId}"], a[href*="/post_insights/${postId}"]`
    )
    .count()
    .catch(() => 0)

  return postLinkCount === 0 && !targetRoot
}

export async function runAutoDelete(
  page: Page,
  config: Pick<CampaignConfig, 'url'> & { deleteType?: string }
): Promise<ActionResult> {
  const deleteType = (config.deleteType ?? 'post') as 'post' | 'comment'
  if (!['post', 'comment'].includes(deleteType)) {
    return {
      status: 'skipped',
      message: `Tipe delete "${config.deleteType}" belum didukung.`,
    }
  }

  const targetUrl = normalizeFacebookUrl(config.url)
  if (!targetUrl) {
    return {
      status: 'failed',
      message: 'URL target Auto Delete kosong.',
    }
  }

  if (deleteType === 'comment' && !facebookCommentIdFromUrl(targetUrl)) {
    return {
      status: 'failed',
      message: 'URL target comment belum dikenali sebagai permalink comment.',
    }
  }

  if (deleteType === 'post' && !facebookPostIdFromUrl(targetUrl)) {
    return {
      status: 'failed',
      message: 'URL target post belum dikenali sebagai permalink post.',
    }
  }

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(pageBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada URL target delete.',
    }
  }

  const menuButton = await resolveDeleteMenuButton(page, targetUrl, deleteType)
  if (!menuButton) {
    return {
      status: 'skipped',
      message:
        deleteType === 'comment'
          ? 'Menu edit/delete comment tidak ditemukan pada target.'
          : 'Menu edit/delete post tidak ditemukan pada target.',
    }
  }

  await clickBestEffort(menuButton)
  await humanDelay(1500)

  const deleteAction = await resolveDeleteAction(page)
  if (!deleteAction) {
    return {
      status: 'skipped',
      message: `Aksi Delete untuk ${deleteType} tidak muncul pada menu target.`,
    }
  }

  await clickBestEffort(deleteAction)
  await humanDelay(1800)

  const deleteConfirm = await resolveDeleteConfirm(page)
  if (deleteConfirm) {
    await clickBestEffort(deleteConfirm)
    await humanDelay(2200)
  }

  const deleted = await verifyDeleteResult(page, targetUrl, deleteType)
  if (!deleted) {
    return {
      status: 'failed',
      message: `${deleteType === 'comment' ? 'Comment' : 'Post'} belum terverifikasi terhapus.`,
    }
  }

  return {
    status: 'done',
    message: `${deleteType === 'comment' ? 'Comment' : 'Post'} berhasil dihapus.`,
  }
}

export async function runAutoInbox(
  page: Page,
  profile: ProfileTarget & { profileName?: string | null },
  config: Pick<CampaignConfig, 'caption'> & { inboxType?: string }
): Promise<ActionResult> {
  if ((config.inboxType ?? 'friend') !== 'friend') {
    return {
      status: 'skipped',
      message: 'Auto Inbox saat ini baru mendukung target friend.',
    }
  }

  const messageText = resolveInboxMessage(profile, config.caption)
  if (!messageText) {
    return {
      status: 'failed',
      message: 'Template inbox kosong atau tidak valid.',
    }
  }

  await page.goto(profileUrl(profile), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)

  const pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(pageBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada profile target.',
    }
  }

  const messageButton = await firstVisibleLocator(page, [
    '[aria-label="Message"]',
    '[aria-label="Pesan"]',
    '[aria-label*="Message"]',
    '[aria-label*="Pesan"]',
    'div[role="button"]:has-text("Message")',
    'div[role="button"]:has-text("Pesan")',
    'a:has-text("Message")',
    'a:has-text("Pesan")',
    'button:has-text("Message")',
    'button:has-text("Pesan")',
  ])

  if (!messageButton) {
    return {
      status: 'skipped',
      message: 'Tombol Message tidak ditemukan pada profile target.',
    }
  }

  await clickBestEffort(messageButton)
  await humanDelay(2000)

  let dialog = await lastVisibleDialog(page)
  let dialogText = normalizeText(await dialog?.innerText().catch(() => ''))

  let editor = dialog
    ? await firstVisibleLocator(dialog, [
        '[role="textbox"][contenteditable="true"]:not([aria-label*="Search"]):not([aria-label*="Cari"])',
        '[contenteditable="true"][aria-label*="Message"]',
        '[contenteditable="true"][aria-label*="Pesan"]',
        '[contenteditable="true"][aria-label*="Write to"]',
        '[role="textbox"][contenteditable="true"]',
        '[contenteditable="true"]',
      ])
    : null

  if (!editor) {
    const newMessageButton = await firstVisibleLocator(page, [
      '[aria-label="New message"]',
      '[aria-label="Pesan baru"]',
      'div[role="button"]:has-text("New message")',
      'div[role="button"]:has-text("Pesan baru")',
      'button:has-text("New message")',
      'button:has-text("Pesan baru")',
    ])
    if (newMessageButton) {
      await clickBestEffort(newMessageButton)
      await humanDelay(1600)
      dialog = await lastVisibleDialog(page)
      dialogText = normalizeText(await dialog?.innerText().catch(() => ''))
      editor = dialog
        ? await firstVisibleLocator(dialog, [
            '[role="textbox"][contenteditable="true"]:not([aria-label*="Search"]):not([aria-label*="Cari"])',
            '[contenteditable="true"][aria-label*="Message"]',
            '[contenteditable="true"][aria-label*="Pesan"]',
            '[contenteditable="true"][aria-label*="Write to"]',
            '[role="textbox"][contenteditable="true"]',
            '[contenteditable="true"]',
          ])
        : null
    }
  }

  if (isLoginWallText(dialogText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall saat membuka inbox target.',
    }
  }

  if (!editor) {
    editor = await firstVisibleLocator(page, [
      '[role="dialog"] [role="textbox"][contenteditable="true"]:not([aria-label*="Search"]):not([aria-label*="Cari"])',
      '[role="dialog"] [contenteditable="true"][aria-label*="Message"]',
      '[role="dialog"] [contenteditable="true"][aria-label*="Pesan"]',
      '[role="dialog"] [contenteditable="true"][aria-label*="Write to"]',
      '[role="dialog"] [role="textbox"][contenteditable="true"]',
      '[role="dialog"] [contenteditable="true"]',
      '[contenteditable="true"][aria-label*="Write to"]',
      '[contenteditable="true"][aria-label^="Write to"]',
      '[contenteditable="true"][aria-placeholder="Aa"]',
    ])
  }

  if (!editor) {
    return {
      status: 'failed',
      message: 'Editor inbox tidak ditemukan.',
    }
  }

  await clickBestEffort(editor)
  await editor.type(messageText, { delay: randomBetween(18, 42) })
  await humanDelay(900)

  const sendButton = await firstVisibleLocator(page, [
    '[aria-label="Send"]',
    '[aria-label="Kirim"]',
    '[aria-label*="send"]',
    '[aria-label*="kirim"]',
    'div[role="button"]:has-text("Send")',
    'div[role="button"]:has-text("Kirim")',
    'button:has-text("Send")',
    'button:has-text("Kirim")',
  ])

  if (sendButton) {
    await clickBestEffort(sendButton)
  } else {
    await editor.press('Enter')
  }

  await humanDelay(1800)
  return {
    status: 'done',
    message: 'Inbox terkirim (disarankan verifikasi manual).',
  }
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
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const bodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (!bodyText) {
    return { status: 'failed', message: 'Halaman profile gagal dimuat.' }
  }

  if (isLoginWallText(bodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada profile target.',
    }
  }

  const addFriendBtn = page
    .locator(
      '[aria-label="Tambahkan teman"], [aria-label="Add friend"], div[role="button"]:has-text("Tambahkan teman"), div[role="button"]:has-text("Add friend")'
    )
    .first()

  if ((await addFriendBtn.count()) === 0) {
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

    if (friendshipButton) {
      return { status: 'skipped', message: 'Target sudah berteman.' }
    }

    return { status: 'skipped', message: 'Tombol Add Friend tidak ditemukan pada profile target.' }
  }

  await addFriendBtn.click()
  await humanDelay(2500)
  return { status: 'done', message: 'Permintaan pertemanan dikirim.' }
}

export async function runAutoUnfriend(page: Page, profile: ProfileTarget): Promise<ActionResult> {
  await page.goto(profileUrl(profile), { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const bodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (!bodyText) {
    return { status: 'failed', message: 'Halaman profile gagal dimuat.' }
  }

  if (isLoginWallText(bodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada profile target.',
    }
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

  const activeDialog = await lastVisibleDialog(page)
  const unfriendButton =
    (activeDialog
      ? await firstVisibleLocator(activeDialog, [
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
      : null) ||
    (await firstVisibleLocator(page, [
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
    ]))

  if (!unfriendButton) {
    await closeTopDialog(page)
    return {
      status: 'skipped',
      message: 'Menu unfriend tidak ditemukan pada profile target.',
    }
  }

  await clickBestEffort(unfriendButton)
  await humanDelay(1800)

  const confirmDialog = await lastVisibleDialog(page)
  const confirmUnfriendButton =
    (confirmDialog
      ? await firstVisibleLocator(confirmDialog, [
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
      : null) ||
    (await firstVisibleLocator(page, [
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
    ]))

  if (confirmUnfriendButton) {
    await clickBestEffort(confirmUnfriendButton)
    await humanDelay(1800)
  }

  await page
    .goto(profileUrl(profile), { waitUntil: 'domcontentloaded', timeout: 60000 })
    .catch(() => null)
  await humanDelay(2200)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const refreshedBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(refreshedBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall saat verifikasi hasil unfriend.',
    }
  }

  if (/add friend|tambahkan teman/i.test(refreshedBodyText)) {
    return { status: 'done', message: 'Pertemanan berhasil diputus dari profile target.' }
  }

  const friendshipButtonAfter = await firstVisibleLocator(page, [
    '[aria-label="Friends"]',
    '[aria-label="Teman"]',
    '[aria-label*="Friends"]',
    '[aria-label*="Teman"]',
    'div[role="button"]:has-text("Friends")',
    'div[role="button"]:has-text("Teman")',
    'button:has-text("Friends")',
    'button:has-text("Teman")',
  ])
  if (friendshipButtonAfter) {
    return {
      status: 'failed',
      message: 'Status pertemanan belum terverifikasi berubah setelah unfriend.',
    }
  }

  return {
    status: 'done',
    message: 'Aksi unfriend dijalankan dan tombol friendship sudah tidak terlihat lagi.',
  }
}

export async function runAutoCreate(
  page: Page,
  config: Pick<CampaignConfig, 'createType' | 'caption' | 'groupPrivacy'> & { name: string }
): Promise<ActionResult> {
  if ((config.createType ?? 'group') !== 'group') {
    return {
      status: 'skipped',
      message: 'Auto create saat ini baru mendukung mode group.',
    }
  }

  const groupName = normalizeText(config.name)
  if (!groupName) {
    return {
      status: 'failed',
      message:
        'Auto create group membutuhkan nama campaign yang valid untuk dipakai sebagai nama group.',
    }
  }

  const description = normalizeText(config.caption)
  const privacy =
    normalizeText(config.groupPrivacy).toLowerCase() === 'public' ? 'public' : 'private'
  const candidateUrls = [
    'https://www.facebook.com/groups/create/',
    'https://www.facebook.com/groups/create',
  ]
  const nameInputSelectors = [
    'input[aria-label="Group name"]',
    'input[aria-label="Nama grup"]',
    'input[placeholder="Group name"]',
    'input[placeholder="Nama grup"]',
    'input[name="group_name"]',
    'input[type="text"]',
  ]
  const descriptionSelectors = [
    'textarea[aria-label="Description"]',
    'textarea[aria-label="Deskripsi"]',
    '[role="textbox"][aria-label="Description"]',
    '[role="textbox"][aria-label="Deskripsi"]',
    'textarea[name="description"]',
  ]
  const createButtonCandidates = [
    page.locator('button').filter({ hasText: /^Create$/ }),
    page.locator('button').filter({ hasText: /^Buat$/ }),
    page.locator('div[role="button"]').filter({ hasText: /^Create$/ }),
    page.locator('div[role="button"]').filter({ hasText: /^Buat$/ }),
    page.locator('[aria-label="Create"]'),
    page.locator('[aria-label="Buat"]'),
  ]
  const privacyChooserCandidates = [
    page.locator('[role="button"]').filter({ hasText: /Privacy|Privasi/i }),
    page.locator('button').filter({ hasText: /Privacy|Privasi/i }),
    page.locator('[aria-label*="Privacy"]'),
    page.locator('[aria-label*="Privasi"]'),
  ]
  const privateOptionCandidates = [
    page.locator('[role="radio"]').filter({ hasText: /^Private$/ }),
    page.locator('[role="radio"]').filter({ hasText: /^Privat$/ }),
    page.locator('[role="option"]').filter({ hasText: /^Private$/ }),
    page.locator('[role="option"]').filter({ hasText: /^Privat$/ }),
    page.locator('[role="button"]').filter({ hasText: /^Private$/ }),
    page.locator('[role="button"]').filter({ hasText: /^Privat$/ }),
    page.locator('label').filter({ hasText: /^Private$/ }),
    page.locator('label').filter({ hasText: /^Privat$/ }),
  ]
  const publicOptionCandidates = [
    page.locator('[role="radio"]').filter({ hasText: /^Public$/ }),
    page.locator('[role="radio"]').filter({ hasText: /^Publik$/ }),
    page.locator('[role="option"]').filter({ hasText: /^Public$/ }),
    page.locator('[role="option"]').filter({ hasText: /^Publik$/ }),
    page.locator('[role="button"]').filter({ hasText: /^Public$/ }),
    page.locator('[role="button"]').filter({ hasText: /^Publik$/ }),
    page.locator('label').filter({ hasText: /^Public$/ }),
    page.locator('label').filter({ hasText: /^Publik$/ }),
  ]

  let nameInputReady = false
  let lastBodyText = ''
  let lastObservation = ''

  for (const candidateUrl of candidateUrls) {
    await page
      .goto(candidateUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      .catch(() => null)
    await humanDelay(2500)
    await resolveFacebookContinueAs(page)
    await humanDelay(1500)

    lastBodyText = normalizeText(
      await page
        .locator('body')
        .innerText()
        .catch(() => '')
    )
    if (isLoginWallText(lastBodyText)) {
      return {
        status: 'skipped',
        message: 'Facebook menampilkan login/public wall pada flow create group.',
      }
    }

    nameInputReady = await fillFirstVisibleInput(page, nameInputSelectors, groupName)
    if (nameInputReady) {
      lastObservation = candidateUrl
      break
    }
  }

  if (!nameInputReady) {
    return {
      status: 'failed',
      message: `Field nama group tidak ditemukan pada flow create group.${lastObservation ? ` Route terakhir: ${lastObservation}.` : ''}`,
    }
  }

  if (description) {
    await fillFirstVisibleInput(page, descriptionSelectors, description).catch(() => false)
  }

  const selectedPrivacyCandidates =
    privacy === 'public' ? publicOptionCandidates : privateOptionCandidates
  let privacySet = await firstVisibleCandidate(selectedPrivacyCandidates)
  if (!privacySet) {
    const chooser = await firstVisibleCandidate(privacyChooserCandidates)
    if (chooser) {
      await chooser.scrollIntoViewIfNeeded().catch(() => {})
      await clickBestEffort(chooser)
      await humanDelay(1200)
      privacySet = await waitForVisibleCandidate(selectedPrivacyCandidates, [0, 600, 1500])
    }
  }

  if (privacySet) {
    await privacySet.scrollIntoViewIfNeeded().catch(() => {})
    await clickBestEffort(privacySet)
    await humanDelay(1000)
  }

  const createButton = await waitForVisibleCandidate(createButtonCandidates, [0, 800, 1600, 2600])
  if (!createButton) {
    return {
      status: 'failed',
      message: 'Tombol Create tidak ditemukan pada flow create group.',
    }
  }

  await createButton.scrollIntoViewIfNeeded().catch(() => {})
  await clickBestEffort(createButton)
  await humanDelay(5000)
  await resolveFacebookContinueAs(page)
  await humanDelay(2000)

  const bodyAfterSubmit = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(bodyAfterSubmit)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall setelah submit create group.',
    }
  }

  const createdUrl = resolveCreatedGroupUrl(page.url())
  if (createdUrl) {
    return {
      status: 'done',
      message: `Group "${groupName}" berhasil dibuat (${privacy}) di ${createdUrl}.`,
    }
  }

  const postCreateMarkers = [
    'invite',
    'undang',
    'manage group',
    'kelola grup',
    'admin assist',
    'about this group',
    'tentang grup ini',
    groupName.toLowerCase(),
  ]
  if (postCreateMarkers.some((marker) => bodyAfterSubmit.toLowerCase().includes(marker))) {
    return {
      status: 'done',
      message: `Flow create group "${groupName}" selesai. Verifikasi URL final belum stabil, tetapi surface group baru sudah terbuka.`,
    }
  }

  return {
    status: 'failed',
    message: 'Submit create group sudah dijalankan, tetapi surface group baru belum terverifikasi.',
  }
}

export async function runAutoConfirm(
  page: Page,
  config: Pick<CampaignConfig, 'confirmType' | 'url'>
): Promise<
  ActionResult & { processedCount: number; confirmedProfiles: ConfirmedRequestProfile[] }
> {
  if ((config.confirmType ?? 'friend') === 'group') {
    const targetUrl = normalizeFacebookUrl(config.url)
    if (!targetUrl) {
      return {
        status: 'failed',
        message: 'Auto confirm group membutuhkan URL target group atau halaman member requests.',
        processedCount: 0,
        confirmedProfiles: [],
      }
    }

    const approveSelectors = [
      '[aria-label="Approve"]',
      '[aria-label="Setujui"]',
      'button:text-is("Approve")',
      'button:text-is("Setujui")',
      'div[role="button"]:text-is("Approve")',
      'div[role="button"]:text-is("Setujui")',
    ]
    const mainContent = page.locator('[role="main"]').first()
    const requestNavigationCandidates = [
      mainContent.locator('[role="link"]').filter({ hasText: 'Member requests' }),
      page.locator('[role="link"]').filter({ hasText: 'Member requests' }),
      mainContent.locator('[role="link"]').filter({ hasText: 'Pending members' }),
      page.locator('[role="link"]').filter({ hasText: 'Pending members' }),
      mainContent.locator('[role="link"]').filter({ hasText: 'Manage requests' }),
      page.locator('[role="link"]').filter({ hasText: 'Manage requests' }),
      mainContent.locator('[role="link"]').filter({ hasText: 'Join requests' }),
      page.locator('[role="link"]').filter({ hasText: 'Join requests' }),
      mainContent.locator('[role="link"]').filter({ hasText: 'Permintaan anggota' }),
      page.locator('[role="link"]').filter({ hasText: 'Permintaan anggota' }),
      mainContent.locator('[role="link"]').filter({ hasText: 'Permintaan gabung' }),
      page.locator('[role="link"]').filter({ hasText: 'Permintaan gabung' }),
      mainContent.locator('[role="button"]').filter({ hasText: 'Member requests' }),
      page.locator('[role="button"]').filter({ hasText: 'Member requests' }),
      mainContent.locator('[role="button"]').filter({ hasText: 'Manage requests' }),
      page.locator('[role="button"]').filter({ hasText: 'Manage requests' }),
      mainContent.locator('[role="tab"]').filter({ hasText: 'Member requests' }),
      page.locator('[role="tab"]').filter({ hasText: 'Member requests' }),
      mainContent.locator('[role="tab"]').filter({ hasText: 'Pending members' }),
      page.locator('[role="tab"]').filter({ hasText: 'Pending members' }),
    ]
    const candidateUrls = groupMemberRequestUrls(targetUrl)
    const routeObservations: string[] = []
    let lastBodyText = ''
    let initialButton: Locator | null = null

    for (const candidateUrl of candidateUrls) {
      await page.goto(candidateUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      })
      await humanDelay(2500)
      await resolveFacebookContinueAs(page)
      await humanDelay(1200)

      const bodyText = normalizeText(
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      )
      lastBodyText = bodyText

      if (isLoginWallText(bodyText)) {
        return {
          status: 'skipped',
          message: 'Facebook menampilkan login/public wall pada halaman member requests group.',
          processedCount: 0,
          confirmedProfiles: [],
        }
      }

      initialButton =
        (await firstVisibleLocator(mainContent, approveSelectors)) ||
        (await firstVisibleLocator(page, approveSelectors))

      let navigationSummary: string | null = null
      if (!initialButton) {
        const requestNavigation = await firstVisibleCandidate(requestNavigationCandidates)
        if (requestNavigation) {
          const navigationLabel = normalizeText(
            (await requestNavigation.getAttribute('aria-label').catch(() => '')) ||
              (await requestNavigation.innerText().catch(() => ''))
          )
          await clickBestEffort(requestNavigation)
          await humanDelay(2200)

          const navigatedBodyText = normalizeText(
            await page
              .locator('body')
              .innerText()
              .catch(() => '')
          )
          lastBodyText = navigatedBodyText
          initialButton =
            (await firstVisibleLocator(mainContent, approveSelectors)) ||
            (await firstVisibleLocator(page, approveSelectors))
          navigationSummary = `nav=${navigationLabel || 'member requests'}`
        }
      }

      const surfaceSummary = await snapshotGroupRequestSurface(page)

      routeObservations.push(
        `${candidateUrl} => ${
          initialButton
            ? 'approve terlihat'
            : isNoGroupRequestText(lastBodyText)
              ? 'tidak ada request'
              : 'approve tidak terlihat'
        }${navigationSummary ? `; ${navigationSummary}` : ''}; ${surfaceSummary}`
      )

      if (initialButton) break
    }

    if (!initialButton) {
      const observationSummary = routeObservations.length
        ? ` Jalur cek: ${routeObservations.join(' | ')}`
        : ''
      return {
        status: isNoGroupRequestText(lastBodyText) ? 'skipped' : 'failed',
        message: isNoGroupRequestText(lastBodyText)
          ? `Tidak ada permintaan member group yang siap dikonfirmasi.${observationSummary}`
          : `Tombol Approve tidak ditemukan pada halaman member requests group.${observationSummary}`,
        processedCount: 0,
        confirmedProfiles: [],
      }
    }

    const resolveApproveButton = async () =>
      (await firstVisibleLocator(mainContent, approveSelectors)) ||
      (await firstVisibleLocator(page, approveSelectors))

    let processedCount = 0
    const maxProcessed = 10
    for (let index = 0; index < maxProcessed; index++) {
      const button = await resolveApproveButton()
      if (!button) break

      await clickBestEffort(button)
      processedCount++
      await humanDelay(2000)

      const refreshedBodyText = normalizeText(
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      )
      if (isLoginWallText(refreshedBodyText)) {
        return {
          status: processedCount > 0 ? 'done' : 'skipped',
          message:
            processedCount > 0
              ? `${processedCount} permintaan member group dikonfirmasi sebelum Facebook menampilkan login/public wall.`
              : 'Facebook menampilkan login/public wall saat memproses member requests group.',
          processedCount,
          confirmedProfiles: [],
        }
      }
    }

    if (processedCount === 0) {
      return {
        status: 'skipped',
        message: 'Tidak ada permintaan member group yang berhasil dikonfirmasi.',
        processedCount: 0,
        confirmedProfiles: [],
      }
    }

    return {
      status: 'done',
      message: `${processedCount} permintaan member group dikonfirmasi.`,
      processedCount,
      confirmedProfiles: [],
    }
  }

  await page.goto('https://www.facebook.com/friends/requests', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  const pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  if (isLoginWallText(pageBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada halaman friend requests.',
      processedCount: 0,
      confirmedProfiles: [],
    }
  }

  const confirmSelectors = [
    '[aria-label="Konfirmasi"]',
    '[aria-label="Confirm"]',
    'button:text-is("Konfirmasi")',
    'button:text-is("Confirm")',
    'div[role="button"]:text-is("Konfirmasi")',
    'div[role="button"]:text-is("Confirm")',
  ]
  const mainContent = page.locator('[role="main"]').first()
  const resolveConfirmButton = async () =>
    (await firstVisibleLocator(mainContent, confirmSelectors)) ||
    (await firstVisibleLocator(page, confirmSelectors))

  const initialButton = await resolveConfirmButton()
  if (!initialButton) {
    return {
      status: isNoFriendRequestText(pageBodyText) ? 'skipped' : 'failed',
      message: isNoFriendRequestText(pageBodyText)
        ? 'Tidak ada permintaan pertemanan yang siap dikonfirmasi.'
        : 'Tombol Confirm tidak ditemukan pada halaman friend requests.',
      processedCount: 0,
      confirmedProfiles: [],
    }
  }

  let processedCount = 0
  const confirmedProfiles: ConfirmedRequestProfile[] = []
  const seenConfirmedProfileIds = new Set<string>()
  const maxProcessed = 10
  for (let index = 0; index < maxProcessed; index++) {
    const button = await resolveConfirmButton()
    if (!button) break

    const requestProfile = await snapshotConfirmedRequestProfile(button)
    await clickBestEffort(button)
    processedCount++
    if (requestProfile?.profileId && !seenConfirmedProfileIds.has(requestProfile.profileId)) {
      seenConfirmedProfileIds.add(requestProfile.profileId)
      confirmedProfiles.push(requestProfile)
    } else if (requestProfile?.profileName && !requestProfile.profileId) {
      confirmedProfiles.push(requestProfile)
    }
    await humanDelay(2000)

    const refreshedBodyText = normalizeText(
      await page
        .locator('body')
        .innerText()
        .catch(() => '')
    )
    if (isLoginWallText(refreshedBodyText)) {
      return {
        status: processedCount > 0 ? 'done' : 'skipped',
        message:
          processedCount > 0
            ? `${processedCount} permintaan pertemanan dikonfirmasi sebelum Facebook menampilkan login/public wall.`
            : 'Facebook menampilkan login/public wall saat memproses friend requests.',
        processedCount,
        confirmedProfiles,
      }
    }
  }

  if (processedCount === 0) {
    return {
      status: 'skipped',
      message: 'Tidak ada permintaan pertemanan yang berhasil dikonfirmasi.',
      processedCount: 0,
      confirmedProfiles: [],
    }
  }

  return {
    status: 'done',
    message: `${processedCount} permintaan pertemanan dikonfirmasi.`,
    processedCount,
    confirmedProfiles,
  }
}

export async function runAutoInvite(
  page: Page,
  profile: ProfileTarget & { profileName?: string | null },
  config: Pick<CampaignConfig, 'inviteType' | 'url'>
): Promise<ActionResult> {
  const inviteType = config.inviteType ?? 'group'
  if (!['group', 'page_follower'].includes(inviteType)) {
    return {
      status: 'skipped',
      message: `Mode auto invite "${inviteType}" belum aktif di foundation saat ini.`,
    }
  }

  const inviteTargetUrl = normalizeFacebookUrl(config.url)
  if (!inviteTargetUrl) {
    return { status: 'failed', message: 'URL target invite belum diisi.' }
  }

  await page.goto(inviteTargetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await humanDelay(2500)
  await resolveFacebookContinueAs(page)
  await humanDelay(1200)

  let pageBodyText = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )
  let pageIdentitySwitched = false
  const mainContent = page.locator('[role="main"]').first()
  if (isLoginWallText(pageBodyText)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall pada URL target invite.',
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

  const groupMoreOptionsCandidates = [
    mainContent.locator(
      '[role="button"][aria-haspopup="menu"][aria-label="Profile settings see more options"]'
    ),
    page.locator(
      '[role="button"][aria-haspopup="menu"][aria-label="Profile settings see more options"]'
    ),
    mainContent.locator('[aria-label="Profile settings see more options"]'),
    page.locator('[aria-label="Profile settings see more options"]'),
    mainContent.locator('[role="button"][aria-haspopup="menu"][aria-label*="see more options"]'),
    page.locator('[role="button"][aria-haspopup="menu"][aria-label*="see more options"]'),
    mainContent.locator('[aria-label*="see more options"]'),
    page.locator('[aria-label*="see more options"]'),
    mainContent.locator('[aria-haspopup="menu"][aria-label*="Profile settings"]'),
    page.locator('[aria-haspopup="menu"][aria-label*="Profile settings"]'),
  ]

  const inviteMenuItemCandidates = [
    page
      .locator('[role="menu"][aria-label="Additional profile actions menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Invite friends' }),
    page
      .locator('[role="menu"][aria-label="Additional profile actions menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Undang teman' }),
    page
      .locator('[role="menu"][aria-label="Additional profile actions menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Invite people' }),
    page
      .locator('[role="menu"][aria-label="Additional profile actions menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Undang orang' }),
    page
      .locator('[role="menu"][aria-label="Additional profile actions menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Invite members' }),
    page
      .locator('[role="menu"][aria-label="Additional profile actions menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Undang anggota' }),
    page.locator('[role="menuitem"]').filter({ hasText: 'Invite friends' }),
    page.locator('[role="menuitem"]').filter({ hasText: 'Undang teman' }),
    page.locator('[role="menuitem"]').filter({ hasText: 'Invite people' }),
    page.locator('[role="menuitem"]').filter({ hasText: 'Undang orang' }),
    page.locator('[role="menuitem"]').filter({ hasText: 'Invite members' }),
    page.locator('[role="menuitem"]').filter({ hasText: 'Undang anggota' }),
    page
      .locator('[role="menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Invite friends' }),
    page.locator('[role="menu"]').locator('[role="menuitem"]').filter({ hasText: 'Undang teman' }),
    page.locator('[role="menu"]').locator('[role="menuitem"]').filter({ hasText: 'Invite people' }),
    page.locator('[role="menu"]').locator('[role="menuitem"]').filter({ hasText: 'Undang orang' }),
    page
      .locator('[role="menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Invite members' }),
    page
      .locator('[role="menu"]')
      .locator('[role="menuitem"]')
      .filter({ hasText: 'Undang anggota' }),
    page.locator('[role="menu"]').getByText('Invite friends', { exact: true }),
    page.locator('[role="menu"]').getByText('Undang teman', { exact: true }),
    page.locator('[role="menu"]').getByText('Invite people', { exact: true }),
    page.locator('[role="menu"]').getByText('Undang orang', { exact: true }),
    page.locator('[role="menu"]').getByText('Invite members', { exact: true }),
    page.locator('[role="menu"]').getByText('Undang anggota', { exact: true }),
  ]

  const pageInviteCandidates = [
    mainContent.getByText('Invite friends to like your Page', { exact: true }),
    mainContent.getByText('Undang teman untuk menyukai Halaman Anda', { exact: true }),
    mainContent.getByText('Invite friends to like Page', { exact: true }),
  ]

  const pageMoreOptionsCandidates = [
    page.locator(
      '[role="button"][aria-haspopup="menu"][aria-label="Profile settings see more options"]'
    ),
    mainContent.locator(
      '[role="button"][aria-haspopup="menu"][aria-label="Profile settings see more options"]'
    ),
    page.locator('[aria-label="Profile settings see more options"]'),
    mainContent.locator('[aria-label="Profile settings see more options"]'),
    page.locator('[role="button"][aria-haspopup="menu"][aria-label*="see more options"]'),
    mainContent.locator('[role="button"][aria-haspopup="menu"][aria-label*="see more options"]'),
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
        pageBodyText = normalizeText(
          await page
            .locator('body')
            .innerText()
            .catch(() => '')
        )
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
  const groupInviteObservations: string[] = []
  const pageInviteObservations: string[] = []
  const summarizeObservedText = (value: string | null | undefined, maxLength = 180) => {
    const normalized = normalizeText(value)
    if (!normalized) return 'tidak ada'
    return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 3)}...` : normalized
  }
  const describeLocatorSurface = async (locator: Locator | null) => {
    if (!locator) return 'tidak ada'

    const ariaLabel = normalizeText(await locator.getAttribute('aria-label').catch(() => ''))
    if (ariaLabel) return ariaLabel

    const text = normalizeText(await locator.innerText().catch(() => ''))
    return summarizeObservedText(text)
  }
  const describeGroupSurface = async () => {
    const visibleMoreOptions = await firstVisibleCandidate(groupMoreOptionsCandidates)
    const visibleAddMembers = await firstVisibleLocator(mainContent, groupAddMemberSelectors)
    const visibleInvite = await firstVisibleLocator(mainContent, openInviteSelectors)

    return [
      `see_more=${await describeLocatorSurface(visibleMoreOptions)}`,
      `add_members=${await describeLocatorSurface(visibleAddMembers)}`,
      `invite=${await describeLocatorSurface(visibleInvite)}`,
    ].join('; ')
  }
  const describePageSurface = async () => {
    const visiblePageInvite = await waitForVisibleCandidate(pageInviteCandidates, [0])
    const visibleOpenInvite = await firstVisibleLocator(mainContent, openInviteSelectors)
    const visibleMoreOptions = await waitForVisibleCandidate(pageMoreOptionsCandidates, [0])
    const visibleSwitchButton = await firstVisibleCandidate([
      mainContent.getByText('Switch Now', { exact: true }),
      mainContent.getByText('Beralih sekarang', { exact: true }),
      mainContent.getByText("Switch into Nadiva Beauty Shop's Page", { exact: false }),
      page.locator('[role="main"] [aria-label="Switch Now"]'),
      page.locator('[role="main"] [aria-label*="Switch"]'),
    ])

    return [
      `page_invite=${await describeLocatorSurface(visiblePageInvite)}`,
      `invite=${await describeLocatorSurface(visibleOpenInvite)}`,
      `see_more=${await describeLocatorSurface(visibleMoreOptions)}`,
      `switch=${await describeLocatorSurface(visibleSwitchButton)}`,
    ].join('; ')
  }
  const describeDialogSurface = async (activeDialog: Locator | null) => {
    if (!activeDialog) return 'dialog tidak ada'

    const dialogLabel = normalizeText(await activeDialog.getAttribute('aria-label').catch(() => ''))
    const dialogText = summarizeObservedText(await activeDialog.innerText().catch(() => ''))
    return `label=${dialogLabel || 'tidak ada'}; text=${dialogText}`
  }

  if (inviteType === 'group') {
    const basePageMenuAttempt = await tryOpenGroupInviteDialogFromMenu(
      page,
      groupMoreOptionsCandidates,
      inviteMenuItemCandidates,
      'halaman group utama'
    )
    if (basePageMenuAttempt.inviteTrigger) {
      inviteOpenButton = basePageMenuAttempt.inviteTrigger
    }
    if (basePageMenuAttempt.observation) {
      groupInviteObservations.push(basePageMenuAttempt.observation)
    }
    if (basePageMenuAttempt.invalidReason) {
      groupInviteObservations.push(basePageMenuAttempt.invalidReason)
    }
    dialog = basePageMenuAttempt.dialog

    const membersUrl = /\/members$/i.test(inviteTargetUrl)
      ? inviteTargetUrl
      : `${inviteTargetUrl}/members`
    if (!dialog && normalizeFacebookUrl(page.url()) !== membersUrl) {
      await page.goto(membersUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await humanDelay(2500)
      await resolveFacebookContinueAs(page)
      await humanDelay(1200)
      pageBodyText = normalizeText(
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      )
    }

    if (isLoginWallText(pageBodyText)) {
      return {
        status: 'skipped',
        message: 'Facebook menampilkan login/public wall pada halaman members group target.',
      }
    }

    if (!dialog) {
      const membersPageMenuAttempt = await tryOpenGroupInviteDialogFromMenu(
        page,
        groupMoreOptionsCandidates,
        inviteMenuItemCandidates,
        'halaman members group'
      )
      if (membersPageMenuAttempt.inviteTrigger) {
        inviteOpenButton = membersPageMenuAttempt.inviteTrigger
      }
      if (membersPageMenuAttempt.observation) {
        groupInviteObservations.push(membersPageMenuAttempt.observation)
      }
      if (membersPageMenuAttempt.invalidReason) {
        groupInviteObservations.push(membersPageMenuAttempt.invalidReason)
      }
      dialog = membersPageMenuAttempt.dialog
    }

    if (!dialog) {
      const addMembersButton = await firstVisibleLocator(mainContent, groupAddMemberSelectors)
      if (addMembersButton) {
        inviteOpenButton = addMembersButton
        await addMembersButton.click()
        await humanDelay(2000)
        dialog = await lastVisibleDialog(page)

        if (dialog) {
          const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
          if (isGroupExpertDialog(dialogText)) {
            invalidInviteReason = `CTA Add members yang tersedia membuka dialog group experts, bukan invite member. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            dialog = null
            await closeTopDialog(page)
          } else if (isChatLikeInviteDialog(dialogText)) {
            invalidInviteReason = `CTA Add members yang tersedia membuka panel chat/share, bukan invite member. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            dialog = null
            await closeTopDialog(page)
          } else if (!(await isLikelyMemberInviteDialog(dialog))) {
            invalidInviteReason = `CTA Add members membuka surface lain yang belum cocok dengan dialog invite member. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            dialog = null
            await closeTopDialog(page)
          }
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
            invalidInviteReason = `Tombol Invite yang tersedia membuka panel chat/share, bukan invite member. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            dialog = null
            await closeTopDialog(page)
          } else if (isGroupExpertDialog(dialogText)) {
            invalidInviteReason = `Tombol Invite yang tersedia membuka dialog group experts, bukan invite member. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            dialog = null
            await closeTopDialog(page)
          } else if (!(await isLikelyMemberInviteDialog(dialog))) {
            invalidInviteReason = `Tombol Invite yang tersedia membuka surface lain yang belum cocok dengan dialog invite member. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            dialog = null
            await closeTopDialog(page)
          }
        }
      }
    }
  } else {
    for (let attempt = 0; attempt < 2 && !dialog; attempt++) {
      inviteOpenButton =
        (await waitForVisibleCandidate(pageInviteCandidates, [0, 1500, 2500])) ||
        (await firstVisibleLocator(mainContent, openInviteSelectors))

      let switchedViaDialog = false

      if (inviteOpenButton) {
        await clickBestEffort(inviteOpenButton)
        await humanDelay(2000)
        dialog = await lastVisibleDialog(page)
        dialog = await waitForSettledDialog(page, dialog)

        if (dialog) {
          const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
          if (isSwitchProfilesDialogText(dialogText)) {
            const switchResult = await resolveSwitchProfilesDialog(page, dialog)
            if (switchResult.observation) pageInviteObservations.push(switchResult.observation)
            dialog = null

            if (switchResult.switched) {
              pageIdentitySwitched = true
              switchedViaDialog = true
              pageBodyText = normalizeText(
                await page
                  .locator('body')
                  .innerText()
                  .catch(() => '')
              )
              await resolveFacebookContinueAs(page)
              await humanDelay(1200)
            } else {
              invalidInviteReason = `CTA invite follower membuka dialog Switch profiles, tetapi switch identitas belum berhasil. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            }
          } else if (isLoginWallText(dialogText)) {
            invalidInviteReason = `Facebook menampilkan login wall setelah CTA invite follower diklik. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            pageInviteObservations.push(invalidInviteReason)
            dialog = null
            await closeTopDialog(page)
          } else if (isChatLikeInviteDialog(dialogText)) {
            invalidInviteReason = `CTA invite follower membuka panel chat/share, bukan dialog invite follower. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            pageInviteObservations.push(invalidInviteReason)
            dialog = null
            await closeTopDialog(page)
          } else if (!(await isLikelyMemberInviteDialog(dialog))) {
            invalidInviteReason = `CTA invite follower membuka surface lain yang belum cocok dengan dialog invite follower. Observasi dialog: ${await describeDialogSurface(dialog)}.`
            pageInviteObservations.push(invalidInviteReason)
            dialog = null
            await closeTopDialog(page)
          }
        } else {
          pageInviteObservations.push(
            'CTA invite follower diklik, tetapi dialog invite tidak muncul.'
          )
        }
      } else if (inviteType === 'page_follower') {
        const pageMoreOptionsButton = await waitForVisibleCandidate(
          pageMoreOptionsCandidates,
          [0, 1500, 3000, 5000]
        )
        if (pageMoreOptionsButton) {
          await pageMoreOptionsButton.scrollIntoViewIfNeeded().catch(() => {})
          await clickBestEffort(pageMoreOptionsButton)
          await humanDelay(1500)

          const inviteMenuItem = await waitForVisibleCandidate(
            inviteMenuItemCandidates,
            [0, 800, 1800, 3000]
          )

          if (inviteMenuItem) {
            inviteOpenButton = inviteMenuItem
            await inviteMenuItem.scrollIntoViewIfNeeded().catch(() => {})
            await clickBestEffort(inviteMenuItem)
            await humanDelay(2000)
            dialog = await lastVisibleDialog(page)
            dialog = await waitForSettledDialog(page, dialog)

            if (dialog) {
              const dialogText = normalizeText(await dialog.innerText().catch(() => ''))
              if (isSwitchProfilesDialogText(dialogText)) {
                const switchResult = await resolveSwitchProfilesDialog(page, dialog)
                if (switchResult.observation) pageInviteObservations.push(switchResult.observation)
                dialog = null

                if (switchResult.switched) {
                  pageIdentitySwitched = true
                  switchedViaDialog = true
                  pageBodyText = normalizeText(
                    await page
                      .locator('body')
                      .innerText()
                      .catch(() => '')
                  )
                  await resolveFacebookContinueAs(page)
                  await humanDelay(1200)
                } else {
                  invalidInviteReason = `Menu Invite friends pada Page membuka dialog Switch profiles, tetapi switch identitas belum berhasil. Observasi dialog: ${await describeDialogSurface(dialog)}.`
                }
              } else if (isLoginWallText(dialogText)) {
                invalidInviteReason = `Facebook menampilkan login wall saat membuka dialog invite follower dari menu Page. Observasi dialog: ${await describeDialogSurface(dialog)}.`
                pageInviteObservations.push(invalidInviteReason)
                dialog = null
                await closeTopDialog(page)
              } else if (isChatLikeInviteDialog(dialogText)) {
                invalidInviteReason = `Menu Invite friends pada Page membuka panel chat/share, bukan dialog invite follower. Observasi dialog: ${await describeDialogSurface(dialog)}.`
                pageInviteObservations.push(invalidInviteReason)
                dialog = null
                await closeTopDialog(page)
              } else if (!(await isLikelyMemberInviteDialog(dialog))) {
                invalidInviteReason = `Menu Invite friends pada Page membuka surface lain yang belum cocok dengan dialog invite follower. Observasi dialog: ${await describeDialogSurface(dialog)}.`
                pageInviteObservations.push(invalidInviteReason)
                dialog = null
                await closeTopDialog(page)
              }
            } else {
              pageInviteObservations.push(
                'Menu Invite friends pada Page dipilih, tetapi dialog invite follower tidak muncul.'
              )
            }
          } else {
            const loginWallDialog = await lastVisibleDialog(page)
            const loginWallText = normalizeText(await loginWallDialog?.innerText().catch(() => ''))
            if (isLoginWallText(loginWallText || pageBodyText)) {
              invalidInviteReason =
                'Facebook menampilkan login wall saat membuka menu Page, jadi dialog invite follower belum bisa diakses.'
              pageInviteObservations.push(invalidInviteReason)
            } else {
              pageInviteObservations.push(
                'Menu see more options pada Page terbuka, tetapi item Invite friends/people/members tidak terlihat.'
              )
            }
          }
        } else {
          pageInviteObservations.push(
            'CTA see more options tidak terlihat pada halaman Page target.'
          )
        }
      }

      if (dialog || !switchedViaDialog) break

      inviteOpenButton = null
      invalidInviteReason = null
      await page
        .goto(inviteTargetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
        .catch(() => {})
      await humanDelay(2500)
      await resolveFacebookContinueAs(page)
      await humanDelay(1200)
      pageBodyText = normalizeText(
        await page
          .locator('body')
          .innerText()
          .catch(() => '')
      )
    }
  }

  if (!dialog) {
    if (invalidInviteReason) {
      if (inviteType === 'group' && groupInviteObservations.length > 0) {
        const details = groupInviteObservations
          .filter((item, index, items) => items.indexOf(item) === index)
          .join(' ')

        return {
          status: 'skipped',
          message: `${invalidInviteReason} Jalur menu alternatif: ${details} Surface saat ini: ${await describeGroupSurface()}`,
        }
      }

      if (inviteType === 'page_follower' && pageInviteObservations.length > 0) {
        const details = pageInviteObservations
          .filter((item, index, items) => items.indexOf(item) === index)
          .join(' ')

        return {
          status: 'skipped',
          message: `${invalidInviteReason} Jalur page invite: ${details} Surface saat ini: ${await describePageSurface()}`,
        }
      }

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
        message:
          inviteType === 'group'
            ? `Tombol invite ${inviteType} tidak ditemukan. Surface saat ini: ${await describeGroupSurface()}`
            : inviteType === 'page_follower'
              ? `Tombol invite ${inviteType} tidak ditemukan. Surface saat ini: ${await describePageSurface()}`
              : `Tombol invite ${inviteType} tidak ditemukan.`,
      }
    }

    if (inviteType === 'page_follower' && pageIdentitySwitched) {
      return {
        status: 'skipped',
        message:
          'Identitas aktif sudah berganti, tetapi CTA invite follower belum muncul di halaman.',
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

  if (isInviteAlreadyStateText(dialogText)) {
    return {
      status: 'skipped',
      message: `Dialog invite menunjukkan target "${profile.profileName ?? profile.profileId}" sudah pernah diundang atau sudah berada di tujuan.`,
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
            .locator(
              '[role="row"], [role="listitem"], [role="option"], li, div[data-visualcompletion]'
            )
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

  const candidateText = normalizeText(await candidateRow.innerText().catch(() => ''))
  if (isInviteAlreadyStateText(candidateText)) {
    return {
      status: 'skipped',
      message: `Target "${targetName}" sudah memiliki state invited/member/follower pada dialog invite.`,
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

  const dialogStillVisible = await dialog.isVisible().catch(() => false)
  const refreshedDialogText = normalizeText(await dialog.innerText().catch(() => ''))
  const bodyAfterSend = normalizeText(
    await page
      .locator('body')
      .innerText()
      .catch(() => '')
  )

  if (isLoginWallText(refreshedDialogText || bodyAfterSend)) {
    return {
      status: 'skipped',
      message: 'Facebook menampilkan login/public wall setelah klik kirim invite.',
    }
  }

  if (
    !dialogStillVisible ||
    isInviteSuccessText(refreshedDialogText) ||
    isInviteSuccessText(bodyAfterSend) ||
    (isInviteAlreadyStateText(refreshedDialogText) && refreshedDialogText !== candidateText)
  ) {
    return {
      status: 'done',
      message: `Invite untuk "${targetName}" dikirim.`,
    }
  }

  return {
    status: 'failed',
    message: `Invite untuk "${targetName}" belum terverifikasi terkirim.`,
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
