import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'facebook_groups'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('group_id', 80).notNullable()
      table.string('group_name', 500).nullable()
      table.string('group_url', 500).nullable()
      table.enum('group_type', ['public', 'private']).notNullable().defaultTo('public')
      table.integer('member_count').nullable()
      table
        .enum('source_type', ['keyword', 'friend_list', 'manual'])
        .notNullable()
        .defaultTo('manual')
      table.string('source_keyword', 255).nullable()
      table.string('source_friend_url', 500).nullable()
      table.jsonb('tags').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))

      // One row per group within a user's pool.
      table.unique(['user_id', 'group_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
