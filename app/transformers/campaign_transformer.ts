import { BaseTransformer } from '@adonisjs/core/transformers'
import type Campaign from '#models/campaign'

export default class CampaignTransformer extends BaseTransformer<Campaign> {
  toObject() {
    return {
      ...this.pick(this.resource, [
        'id',
        'userId',
        'name',
        'type',
        'status',
        'headless',
        'advanceMode',
        'fingerprintId',
        'useProxy',
        'maxConcurrency',
        'maxAccounts',
        'maxDelayMs',
        'maxTargets',
        'minGroupMember',
        'targetGroupType',
        'startedAt',
        'endedAt',
        'createdAt',
        'updatedAt',
      ]),
      fingerprint: this.resource.fingerprint ? this.resource.fingerprint.toObject() : null,
      accounts: this.resource.accounts
        ? this.resource.accounts.map((account) => account.toObject())
        : [],
      groups: this.resource.groups ? this.resource.groups.map((group) => group.toObject()) : [],
      profiles: this.resource.profiles
        ? this.resource.profiles.map((profile) => profile.toObject())
        : [],
      logs: this.resource.logs ? this.resource.logs.map((log) => log.toObject()) : [],
    }
  }
}
