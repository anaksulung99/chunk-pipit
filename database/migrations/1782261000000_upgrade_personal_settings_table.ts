import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'personal_settings'

  async up() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      ADD COLUMN IF NOT EXISTS enable_notification boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS type_notification varchar(50) NULL,
      ADD COLUMN IF NOT EXISTS telegram_config jsonb NULL,
      ADD COLUMN IF NOT EXISTS email_config jsonb NULL,
      ADD COLUMN IF NOT EXISTS slack_config jsonb NULL,
      ADD COLUMN IF NOT EXISTS webhook_url text NULL;
    `)

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      DROP COLUMN IF EXISTS key,
      DROP COLUMN IF EXISTS value;
    `)

    await this.schema.raw(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_name = '${this.tableName}'
            AND constraint_type = 'UNIQUE'
            AND constraint_name = '${this.tableName}_user_id_key_unique'
        ) THEN
          ALTER TABLE ${this.tableName} DROP CONSTRAINT ${this.tableName}_user_id_key_unique;
        END IF;
      END $$;
    `)

    await this.schema.raw(`
      CREATE UNIQUE INDEX IF NOT EXISTS personal_settings_user_id_unique
      ON ${this.tableName} (user_id);
    `)
  }

  async down() {
    const hasTable = await this.schema.hasTable(this.tableName)
    if (!hasTable) return

    await this.schema.raw(`
      ALTER TABLE ${this.tableName}
      DROP COLUMN IF EXISTS enable_notification,
      DROP COLUMN IF EXISTS type_notification,
      DROP COLUMN IF EXISTS telegram_config,
      DROP COLUMN IF EXISTS email_config,
      DROP COLUMN IF EXISTS slack_config,
      DROP COLUMN IF EXISTS webhook_url;
    `)

    await this.schema.raw(`
      DROP INDEX IF EXISTS personal_settings_user_id_unique;
    `)
  }
}
