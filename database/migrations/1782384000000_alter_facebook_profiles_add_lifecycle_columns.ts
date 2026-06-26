import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'facebook_profiles'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table
        .enum('lifecycle_status', [
          'fresh',
          'friend_requested',
          'friend_connected',
          'invited',
          'failed',
        ])
        .notNullable()
        .defaultTo('fresh')
      table
        .enum('relationship_status', ['unknown', 'outgoing_request', 'incoming_request', 'friend'])
        .notNullable()
        .defaultTo('unknown')
      table.string('last_action', 120).nullable()
      table
        .enum('last_action_status', ['success', 'failed', 'skipped', 'checkpoint'])
        .nullable()
      table.text('last_action_message').nullable()
      table.timestamp('last_action_at').nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('last_action_at')
      table.dropColumn('last_action_message')
      table.dropColumn('last_action_status')
      table.dropColumn('last_action')
      table.dropColumn('relationship_status')
      table.dropColumn('lifecycle_status')
    })
  }
}
