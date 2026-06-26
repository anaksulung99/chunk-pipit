import { BaseTransformer } from '@adonisjs/core/transformers'
import type License from '#models/license'

export default class LicenseTransformer extends BaseTransformer<License> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'userId',
        'key',
        'status',
        'maxDevices',
        'plan',
        'issuedAt',
        'expiresAt',
        'notes',
        'createdAt',
        'updatedAt',
      ]),
      devices: this.resource.devices
        ? this.resource.devices.map((device) => device.serialize())
        : [],
    }
  }
}
