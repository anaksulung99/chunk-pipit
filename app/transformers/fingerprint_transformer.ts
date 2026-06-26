import { BaseTransformer } from '@adonisjs/core/transformers'
import type Fingerprint from '#models/fingerprint_profile'

export default class FingerprintTransformer extends BaseTransformer<Fingerprint> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'userId',
        'name',
        'deviceType',
        'osType',
        'osVersion',
        'browserType',
        'browserVersion',
        'userAgent',
        'screenWidth',
        'screenHeight',
        'locale',
        'timezone',
        'webglVendor',
        'webglRenderer',
        'canvasNoise',
        'clientHints',
        'rawFingerprint',
        'createdAt',
        'updatedAt',
      ]),
      campaigns: this.resource.campaigns
        ? this.resource.campaigns?.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status,
            type: c.type,
            createdAt: c.createdAt ? c.createdAt.toISO() : null,
            updatedAt: c.updatedAt ? c.updatedAt.toISO() : null,
          }))
        : [],
    }
  }
}
