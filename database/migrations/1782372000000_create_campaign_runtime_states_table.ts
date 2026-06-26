import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'campaign_runtime_states'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table
        .uuid('campaign_id')
        .notNullable()
        .references('id')
        .inTable('campaigns')
        .onDelete('CASCADE')
      table.string('run_id', 120).nullable()
      table.string('status', 40).notNullable().defaultTo('idle')
      table.string('stage', 80).nullable()
      table.string('target_type', 40).nullable()
      table.integer('total_targets').nullable()
      table.integer('processed_targets').notNullable().defaultTo(0)
      table.integer('success_count').notNullable().defaultTo(0)
      table.integer('failed_count').notNullable().defaultTo(0)
      table.integer('skipped_count').notNullable().defaultTo(0)
      table.integer('pending_count').notNullable().defaultTo(0)
      table.integer('running_count').notNullable().defaultTo(0)
      table.integer('discovered_count').notNullable().defaultTo(0)
      table.integer('persisted_count').notNullable().defaultTo(0)
      table.integer('current_batch').nullable()
      table.integer('total_batches').nullable()
      table
        .uuid('current_account_id')
        .nullable()
        .references('id')
        .inTable('facebook_accounts')
        .onDelete('SET NULL')
      table
        .uuid('current_group_id')
        .nullable()
        .references('id')
        .inTable('facebook_groups')
        .onDelete('SET NULL')
      table
        .uuid('current_profile_id')
        .nullable()
        .references('id')
        .inTable('facebook_profiles')
        .onDelete('SET NULL')
      table.string('current_action', 100).nullable()
      table.text('current_label').nullable()
      table.integer('eta_seconds').nullable()
      table.jsonb('meta').nullable()
      table.timestamp('started_at').nullable()
      table.timestamp('last_tick_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))

      table.unique(['campaign_id'])
      table.index(['status'])
      table.index(['stage'])
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
