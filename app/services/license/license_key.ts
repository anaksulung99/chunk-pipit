import { randomInt } from 'node:crypto'

// Crockford-ish alphabet: no 0/O/1/I to avoid copy/paste ambiguity.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function segment(length = 4) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)]
  return out
}

/**
 * Generate a license key like `FBA-7K2M-9QHX-4RTP` (4 grouped segments).
 * Result fits the `licenses.key` VARCHAR(64) and the activation validator
 * (min 8 / max 64 chars).
 */
export function generateLicenseKey(prefix = 'FBA') {
  return `${prefix}-${segment()}-${segment()}-${segment()}-${segment()}`
}
