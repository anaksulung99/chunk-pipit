import { BaseTransformer } from '@adonisjs/core/transformers'
import type Proxy from '#models/proxy'

export default class ProxyTransformer extends BaseTransformer<Proxy> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'userId',
        'protocol',
        'host',
        'port',
        'username',
        'password',
        'status',
        'country',
        'asn',
        'lastCheckedAt',
        'responseMs',
        'createdAt',
        'updatedAt',
      ]),
      user: this.resource.user ? this.resource.user.toObject() : null,
    }
  }
}
