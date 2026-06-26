import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'licenses'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table
        .uuid('user_id')
        .notNullable()
        .unique()
        .references('id')
        .inTable('users')
        .onDelete('CASCADE')
      table.string('key', 64).notNullable().unique()
      table
        .enum('status', ['active', 'suspended', 'revoked', 'expired'])
        .notNullable()
        .defaultTo('active')
      table.integer('max_devices').notNullable().defaultTo(1)
      table.string('plan', 50).nullable()
      table.timestamp('issued_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('expires_at').nullable()
      table.text('notes').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
