import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'proxies'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.enum('protocol', ['http', 'https', 'socks4', 'socks5']).notNullable().defaultTo('http')
      table.string('host', 255).notNullable()
      table.integer('port').notNullable()
      table.string('username', 100).nullable()
      table.string('password', 255).nullable()
      table
        .enum('status', ['unchecked', 'healthy', 'slow', 'dead'])
        .notNullable()
        .defaultTo('unchecked')
      table.string('country').after('status').nullable()
      table.string('asn').after('country').nullable()
      table.timestamp('last_checked_at').nullable()
      table.integer('response_ms').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))

      // Avoid duplicate proxies within one user's pool.
      table.unique(['user_id', 'protocol', 'host', 'port'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
