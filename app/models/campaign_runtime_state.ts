import Campaign from '#models/campaign'
import { BaseModel, belongsTo, column } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'

export default class CampaignRuntimeState extends BaseModel {
  public static table = 'campaign_runtime_states'

  @column({ isPrimary: true })
  declare id: string

  @column()
  declare campaignId: string

  @column()
  declare runId: string | null

  @column()
  declare status: string

  @column()
  declare stage: string | null

  @column()
  declare targetType: string | null

  @column()
  declare totalTargets: number | null

  @column()
  declare processedTargets: number

  @column()
  declare successCount: number

  @column()
  declare failedCount: number

  @column()
  declare skippedCount: number

  @column()
  declare pendingCount: number

  @column()
  declare runningCount: number

  @column()
  declare discoveredCount: number

  @column()
  declare persistedCount: number

  @column()
  declare currentBatch: number | null

  @column()
  declare totalBatches: number | null

  @column()
  declare currentAccountId: string | null

  @column()
  declare currentGroupId: string | null

  @column()
  declare currentProfileId: string | null

  @column()
  declare currentAction: string | null

  @column()
  declare currentLabel: string | null

  @column()
  declare etaSeconds: number | null

  @column({
    prepare: (value: Record<string, unknown> | null) => (value === null ? null : JSON.stringify(value)),
    consume: (value: unknown) => (typeof value === 'string' ? JSON.parse(value) : (value ?? null)),
  })
  declare meta: Record<string, unknown> | null

  @column.dateTime()
  declare startedAt: DateTime | null

  @column.dateTime()
  declare lastTickAt: DateTime | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @belongsTo(() => Campaign, { foreignKey: 'campaignId' })
  declare campaign: BelongsTo<typeof Campaign>
}
