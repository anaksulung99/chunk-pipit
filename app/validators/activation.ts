import vine from '@vinejs/vine'

const licenseKey = () => vine.string().trim().minLength(8).maxLength(64)
const deviceId = () => vine.string().trim().minLength(16).maxLength(128)

/**
 * First activation: email + license key are validated against the DB and the
 * license is bound to this physical device (device_id + machine metadata).
 */
export const activateValidator = vine.create({
  email: vine.string().trim().email().maxLength(254),
  licenseKey: licenseKey(),
  deviceId: deviceId(),
  deviceName: vine.string().trim().maxLength(150).optional(),
  os: vine.string().trim().maxLength(50),
  osVersion: vine.string().trim().maxLength(50).optional(),
  appVersion: vine.string().trim().maxLength(30).optional(),
})

/**
 * Per-launch verification: confirm the license is still usable and this device
 * is still the bound, active device for it.
 */
export const verifyValidator = vine.create({
  licenseKey: licenseKey(),
  deviceId: deviceId(),
})
