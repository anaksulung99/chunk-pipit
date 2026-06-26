import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'campaigns'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 200).notNullable()
      table
        .enum('type', [
          'scrape_group',
          'auto_share',
          'auto_join',
          'scrape_profile',
          'auto_add_friend',
          'auto_like',
          'auto_comment',
          'auto_invite',
          'auto_post',
          'auto_unfriend',
          'auto_inbox',
          'auto_delete',
          'auto_confirm',
          'auto_create',
        ])
        .notNullable()
      table
        .enum('status', ['draft', 'running', 'paused', 'completed', 'failed'])
        .notNullable()
        .defaultTo('draft')
      table.jsonb('config').nullable()
      table.enum('target_group_type', ['public', 'private', 'both']).nullable()
      table
        .uuid('fingerprint_id')
        .nullable()
        .references('id')
        .inTable('fingerprint_profiles')
        .onDelete('SET NULL')
      table.boolean('use_proxy').notNullable().defaultTo(false)
      table.integer('max_concurrency').notNullable().defaultTo(1)
      table.integer('max_accounts').notNullable().defaultTo(1)
      table.integer('max_delay_ms').notNullable().defaultTo(3000)
      table.integer('max_targets').nullable()
      table.boolean('headless').defaultTo(true)
      table.boolean('advance_mode').defaultTo(false)
      table.timestamp('started_at').nullable()
      table.timestamp('ended_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
