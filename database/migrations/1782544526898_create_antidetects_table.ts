import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'antidetects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.raw('gen_random_uuid()')).notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.enum('engine', ['chrome', 'firefox', 'webkit']).notNullable()
      table.enum('device_type', ['desktop', 'mobile']).notNullable()
      table.enum('os_name', ['windows', 'macos', 'linux', 'android', 'ios']).notNullable()
      table.string('os_version', 255).notNullable()
      table
        .enum('browser_name', [
          'chrome',
          'firefox',
          'safari',
          'edge',
          'chrome_mobile',
          'safari_mobile',
          'firefox_mobile',
        ])
        .notNullable()
      table.string('browser_version', 255).notNullable()
      table.text('user_agent').notNullable()
      table.string('language', 255).notNullable().defaultTo('id-ID')
      table.string('timezone', 255).notNullable().defaultTo('Asia/Jakarta')
      table.string('locale', 255).notNullable().defaultTo('id-ID')
      table.uuid('proxy_id').nullable().references('id').inTable('proxies').onDelete('SET NULL')
      table.integer('screen_width').nullable()
      table.integer('screen_height').nullable()
      table.float('device_scale_factor').notNullable().defaultTo(1.0)
      table.boolean('is_mobile').notNullable().defaultTo(false)
      table.boolean('has_touch').notNullable().defaultTo(false)
      table.string('canvas_mode', 255).notNullable().defaultTo('noise')
      table.integer('canvas_seed').nullable()
      table.string('webgl_vendor', 255).nullable()
      table.string('webgl_renderer', 255).nullable()
      table.integer('hardware_concurrency').notNullable().defaultTo(4)
      table.integer('device_memory').nullable()
      table.jsonb('raw_fingerprint').nullable()
      table.timestamp('created_at').notNullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
      table.timestamp('updated_at').nullable().defaultTo(this.raw('CURRENT_TIMESTAMP'))
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
