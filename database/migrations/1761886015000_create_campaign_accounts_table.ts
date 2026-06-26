import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'campaign_accounts'

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
        .notNullable()
        .references('id')
        .inTable('facebook_accounts')
        .onDelete('CASCADE')
      table.enum('status', ['idle', 'running', 'done', 'error']).notNullable().defaultTo('idle')
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.unique(['campaign_id', 'account_id'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
