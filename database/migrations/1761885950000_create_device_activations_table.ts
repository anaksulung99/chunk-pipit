import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'device_activations'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table
        .uuid('license_id')
        .notNullable()
        .references('id')
        .inTable('licenses')
        .onDelete('CASCADE')
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('device_id', 128).notNullable()
      table.string('device_name', 150).nullable()
      table.string('os', 50).notNullable()
      table.string('os_version', 50).nullable()
      table.string('app_version', 30).nullable()
      table.enum('status', ['active', 'revoked']).notNullable().defaultTo('active')
      table.string('last_ip', 64).nullable()
      table.timestamp('first_activated_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('last_verified_at').nullable()
      table.timestamp('revoked_at').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })

    // Enforce "1 email · 1 license · 1 device": only one ACTIVE device per license.
    this.schema.raw(
      `CREATE UNIQUE INDEX uq_active_device_per_license ON ${this.tableName} (license_id) WHERE status = 'active'`
    )
    // A given physical device may only appear once per license (re-activation is idempotent).
    this.schema.raw(
      `CREATE UNIQUE INDEX uq_license_device ON ${this.tableName} (license_id, device_id)`
    )
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
