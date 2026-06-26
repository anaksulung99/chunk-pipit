import { BaseSchema } from '@adonisjs/lucid/schema'

/**
 * Re-points the `users.role` check constraint from the scaffold's
 * ('user','admin') to the roadmap's ('superadmin','team'), remapping any
 * existing rows. Done as a separate migration because the create-users
 * migration was already applied.
 */
export default class extends BaseSchema {
  protected tableName = 'users'

  async up() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS users_role_check`)
      await db.rawQuery(`UPDATE ${this.tableName} SET role = 'superadmin' WHERE role = 'admin'`)
      await db.rawQuery(
        `UPDATE ${this.tableName} SET role = 'team' WHERE role = 'user' OR role IS NULL`
      )
      await db.rawQuery(`ALTER TABLE ${this.tableName} ALTER COLUMN role SET DEFAULT 'team'`)
      await db.rawQuery(
        `ALTER TABLE ${this.tableName} ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin','team'))`
      )
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery(`ALTER TABLE ${this.tableName} DROP CONSTRAINT IF EXISTS users_role_check`)
      await db.rawQuery(`UPDATE ${this.tableName} SET role = 'admin' WHERE role = 'superadmin'`)
      await db.rawQuery(`UPDATE ${this.tableName} SET role = 'user' WHERE role = 'team'`)
      await db.rawQuery(`ALTER TABLE ${this.tableName} ALTER COLUMN role SET DEFAULT 'user'`)
      await db.rawQuery(
        `ALTER TABLE ${this.tableName} ADD CONSTRAINT users_role_check CHECK (role IN ('user','admin'))`
      )
    })
  }
}
