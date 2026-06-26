import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'facebook_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('profile_id', 80).notNullable()
      table.string('profile_name', 500).nullable()
      table.string('profile_url', 500).nullable()
      table.integer('friend_count').nullable()
      table.integer('mutual_friend_count').nullable()
      table.integer('follower_count').nullable()
      table.integer('following_count').nullable()
      table
        .enum('source_type', ['group_member', 'page_profile_follower', 'friend', 'engagement_post'])
        .notNullable()
        .defaultTo('friend')
      table.string('source_url', 500).nullable()
      table.jsonb('tags').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))

      table.unique(['user_id', 'profile_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
