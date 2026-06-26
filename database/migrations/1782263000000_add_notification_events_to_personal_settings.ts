import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'personal_settings'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD COLUMN IF NOT EXISTS notification_events jsonb NULL;
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      DROP COLUMN IF EXISTS notification_events;
    `)
  }
}
