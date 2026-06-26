import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'session_logs'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table
        .uuid('campaign_id')
        .notNullable()
        .references('id')
        .inTable('campaigns')
        .onDelete('CASCADE')
      table
        .uuid('account_id')
        .nullable()
        .references('id')
        .inTable('facebook_accounts')
        .onDelete('SET NULL')
      table
        .uuid('group_id')
        .nullable()
        .references('id')
        .inTable('facebook_groups')
        .onDelete('SET NULL')
      table.string('action', 100).notNullable()
      table.enum('status', ['success', 'failed', 'skipped', 'checkpoint']).notNullable()
      table.text('message').nullable()
      table.string('screenshot_path', 500).nullable()
      table.string('worker_id', 100).nullable()
      table.integer('duration_ms').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
