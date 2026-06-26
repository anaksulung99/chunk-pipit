import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'facebook_accounts'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('label', 100).notNullable()
      table.string('fb_user_id', 50).nullable()
      table.string('profile_url', 500).nullable()
      table
        .enum('session_status', ['active', 'checkpoint', 'logged_out', 'banned'])
        .notNullable()
        .defaultTo('active')
      table.timestamp('last_used_at').nullable()
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
