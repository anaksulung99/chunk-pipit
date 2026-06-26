import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'campaign_groups'

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
        .uuid('group_id')
        .notNullable()
        .references('id')
        .inTable('facebook_groups')
        .onDelete('CASCADE')
      table
        .enum('status', ['pending', 'done', 'skipped', 'failed'])
        .notNullable()
        .defaultTo('pending')
      table.timestamp('processed_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.unique(['campaign_id', 'group_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
