import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'fingerprint_profiles'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 100).notNullable()
      table.string('device_type', 20).notNullable().defaultTo('desktop')
      table.enum('os_type', ['windows', 'linux', 'macos']).notNullable()
      table.string('os_version', 50).nullable()
      table.enum('browser_type', ['chrome', 'firefox', 'safari', 'edge']).notNullable()
      table.string('browser_version', 50).nullable()
      table.string('locale').after('screen_height').defaultTo('id-ID')
      table.string('timezone').after('locale').defaultTo('Asia/Jakarta')
      table.text('user_agent').nullable()
      table.integer('screen_width').nullable()
      table.integer('screen_height').nullable()
      table.string('webgl_vendor', 100).nullable()
      table.string('webgl_renderer', 200).nullable()
      table.float('canvas_noise').nullable()
      table.jsonb('client_hints').nullable()
      table.jsonb('raw_fingerprint').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
