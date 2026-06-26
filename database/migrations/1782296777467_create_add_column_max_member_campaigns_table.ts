import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'add_column_max_member_campaigns'

  async up() {
    this.schema.alterTable('campaigns', (table) => {
      table.integer('min_group_member').after('advance_mode').defaultTo(0)
    })
  }

  async down() {
    this.schema.alterTable('campaigns', (table) => {
      table.dropColumn('min_group_member')
    })
  }
}
