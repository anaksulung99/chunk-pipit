import { BaseTransformer } from '@adonisjs/core/transformers'
import type DeviceActivation from '#models/device_activation'

export default class DeviceActivationTransformer extends BaseTransformer<DeviceActivation> {
  toObject() {
    return this.pick(this.resource, [
      'id',
      'licenseId',
      'userId',
      'deviceId',
      'deviceName',
      'os',
      'osVersion',
      'appVersion',
      'lastIp',
      'firstActivatedAt',
      'lastVerifiedAt',
      'revokedAt',
      'status',
      'createdAt',
      'updatedAt',
    ])
  }
}
