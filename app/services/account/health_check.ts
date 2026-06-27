import type FacebookAccount from '#models/facebook_account'
import FingerprintProfile from '#models/fingerprint_profile'
import {
  launchSession,
  verifySession,
  closeSession,
  type Session,
} from '#services/automation/browser_session'
import { loadPlaywrightCookies } from '#services/automation/cookie_loader'

export type CheckHealthState = 'active' | 'checkpoint' | 'logged_out' | 'server_error'

export async function checkAccountHealth(
  account: FacebookAccount,
  headless?: boolean
): Promise<CheckHealthState> {
  const fingerprint = await FingerprintProfile.query().where('user_id', account.userId).first()
  if (!fingerprint) return 'server_error'

  const cookies = await loadPlaywrightCookies(account.id)
  if (cookies.length <= 0) return 'server_error'

  let session: Session

  try {
    session = await launchSession({
      cookies,
      rawFingerprint: fingerprint.rawFingerprint,
      proxy: null,
      headless: headless ?? true,
      osType: 'windows',
      browserType: 'chrome',
      advanceMode: false,
      locale: fingerprint.locale ?? 'en-US',
      timezone: fingerprint.timezone ?? 'Asia/Jakarta',
    })
  } catch (error) {
    return 'server_error'
  }

  try {
    return await verifySession(session.page)
  } catch (error) {
    return 'server_error'
  } finally {
    await closeSession(session)
  }
}
