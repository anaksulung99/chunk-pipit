/** Sleep for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Human-like delay around a base duration (±20% jitter), to avoid the
 * too-regular timing that bot detection flags.
 */
export function humanDelay(baseMs: number): Promise<void> {
  const jitter = baseMs * 0.2
  const ms = Math.max(0, baseMs - jitter + Math.random() * jitter * 2)
  return sleep(Math.round(ms))
}
