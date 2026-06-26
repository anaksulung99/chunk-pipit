import type User from '#models/user'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<User> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'fullName',
        'email',
        'role',
        'isActive',
        'lastLoginAt',
        'createdAt',
        'updatedAt',
        'initials',
      ]),
      license: this.resource.license
        ? {
            ...this.resource.license.toObject(),
          }
        : null,
      deviceActivations: (this.resource.deviceActivations ?? []).map((item) => ({
        ...item.toObject(),
      })),
      personalSettings: this.resource.personalSetting
        ? {
            enableNotification: this.resource.personalSetting.enableNotification,
            typeNotification: this.resource.personalSetting.typeNotification,
            telegramConfig: this.resource.personalSetting.telegramConfig,
            emailConfig: this.resource.personalSetting.emailConfig,
            slackConfig: this.resource.personalSetting.slackConfig,
            notificationEvents: this.resource.personalSetting.notificationEvents,
            webhookUrl: this.resource.personalSetting.webhookUrl,
          }
        : null,
      isAdmin: this.resource.role === 'superadmin',
    }
  }
}
