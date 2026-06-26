import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'account_cookies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table
        .uuid('account_id')
        .notNullable()
        .references('id')
        .inTable('facebook_accounts')
        .onDelete('CASCADE')
      table.string('key', 100).notNullable()
      table.text('value').notNullable() // encrypted at rest (AES via AdonisJS encryption)
      table.string('domain', 255).nullable()
      table.string('path', 255).nullable()
      table.bigint('expires').nullable()
      table.boolean('http_only').nullable()
      table.boolean('secure').nullable()
      table.string('same_site', 20).nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
