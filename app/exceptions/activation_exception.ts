import { Exception } from '@adonisjs/core/exceptions'

/**
 * Raised by the ActivationService when an activate/verify request cannot be
 * honoured (license missing/inactive, email mismatch, device already bound,
 * device revoked, ...). Carries a machine-readable `code` so the Electron
 * client can branch on the failure reason, plus an HTTP `status`.
 */
export default class ActivationException extends Exception {
  constructor(message: string, code: string, status: number) {
    super(message, { code, status })
  }
}
