import { test } from '@japa/runner'
import FacebookGroup from '#models/facebook_group'
import CampaignsController from '#controllers/campaigns_controller'

test.group('Campaign minimumGroupMember helpers', () => {
  test('resolveEligibleGroupIds hanya mengembalikan group yang memenuhi minimum', async ({
    assert,
  }) => {
    const filters: Array<{ method: string; args: unknown[] }> = []
    const originalQuery = FacebookGroup.query

    const rows = [
      { id: 'eligible-group-row', memberCount: 25_000, tags: ['vip'] },
      { id: 'small-private-group-row', memberCount: 120, tags: ['vip'] },
    ]
    ;(FacebookGroup as any).query = () => {
      const fakeQuery = {
        where(...args: unknown[]) {
          filters.push({ method: 'where', args })
          return fakeQuery
        },
        whereIn(...args: unknown[]) {
          filters.push({ method: 'whereIn', args })
          return fakeQuery
        },
        select(...args: unknown[]) {
          filters.push({ method: 'select', args })
          return fakeQuery
        },
        whereNotNull(...args: unknown[]) {
          filters.push({ method: 'whereNotNull', args })
          return fakeQuery
        },
        then(resolve: (value: typeof rows) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject)
        },
      }

      return fakeQuery
    }

    try {
      const controller = new CampaignsController()
      const result = await (controller as any).resolveEligibleGroupIds({
        userId: 'user-1',
        groupIds: ['eligible-group-row', 'small-private-group-row'],
        minGroupMember: 10_000,
        enforceMinGroupMember: true,
      })

      assert.deepEqual(result.eligibleIds, ['eligible-group-row'])
      assert.equal(result.skippedCount, 1)
      assert.isTrue(
        filters.some(
          (entry) =>
            entry.method === 'whereIn' &&
            Array.isArray(entry.args[1]) &&
            entry.args[1].includes('eligible-group-row') &&
            entry.args[1].includes('small-private-group-row')
        )
      )
    } finally {
      ;(FacebookGroup as any).query = originalQuery
    }
  })

  test('resolveEligibleGroupIds tidak memfilter saat enforcement dimatikan', async ({ assert }) => {
    const filters: Array<{ method: string; args: unknown[] }> = []
    const originalQuery = FacebookGroup.query

    const rows = [
      { id: 'eligible-group-row', memberCount: 25_000, tags: ['vip'] },
      { id: 'small-private-group-row', memberCount: 120, tags: ['vip'] },
    ]
    ;(FacebookGroup as any).query = () => {
      const fakeQuery = {
        where(...args: unknown[]) {
          filters.push({ method: 'where', args })
          return fakeQuery
        },
        whereIn(...args: unknown[]) {
          filters.push({ method: 'whereIn', args })
          return fakeQuery
        },
        select(...args: unknown[]) {
          filters.push({ method: 'select', args })
          return fakeQuery
        },
        whereNotNull(...args: unknown[]) {
          filters.push({ method: 'whereNotNull', args })
          return fakeQuery
        },
        then(resolve: (value: typeof rows) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject)
        },
      }

      return fakeQuery
    }

    try {
      const controller = new CampaignsController()
      const result = await (controller as any).resolveEligibleGroupIds({
        userId: 'user-1',
        groupIds: ['eligible-group-row', 'small-private-group-row'],
        minGroupMember: 10_000,
        enforceMinGroupMember: false,
      })

      assert.sameMembers(result.eligibleIds, ['eligible-group-row', 'small-private-group-row'])
      assert.equal(result.skippedCount, 0)
      assert.isTrue(filters.some((entry) => entry.method === 'whereIn'))
    } finally {
      ;(FacebookGroup as any).query = originalQuery
    }
  })

  test('resolveEligibleGroupIds mendukung pemilihan group by label kelompok', async ({ assert }) => {
    const filters: Array<{ method: string; args: unknown[] }> = []
    const originalQuery = FacebookGroup.query
    const responses = [[
      { id: 'tagged-group-row', memberCount: 88_000, tags: ['grey-anatomy', 'buyer'] },
      { id: 'small-tagged-group-row', memberCount: 40, tags: ['grey-anatomy'] },
    ]]

    ;(FacebookGroup as any).query = () => {
      const rows = responses.shift() ?? []
      const fakeQuery = {
        where(...args: unknown[]) {
          filters.push({ method: 'where', args })
          return fakeQuery
        },
        whereIn(...args: unknown[]) {
          filters.push({ method: 'whereIn', args })
          return fakeQuery
        },
        select(...args: unknown[]) {
          filters.push({ method: 'select', args })
          return fakeQuery
        },
        whereNotNull(...args: unknown[]) {
          filters.push({ method: 'whereNotNull', args })
          return fakeQuery
        },
        then(resolve: (value: typeof rows) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(rows).then(resolve, reject)
        },
      }

      return fakeQuery
    }

    try {
      const controller = new CampaignsController()
      const result = await (controller as any).resolveEligibleGroupIds({
        userId: 'user-1',
        groupTags: ['grey-anatomy'],
        minGroupMember: 50_000,
        enforceMinGroupMember: true,
      })

      assert.deepEqual(result.eligibleIds, ['tagged-group-row'])
      assert.equal(result.skippedCount, 1)
      assert.isTrue(
        filters.some((entry) => entry.method === 'whereNotNull' && entry.args[0] === 'tags')
      )
    } finally {
      ;(FacebookGroup as any).query = originalQuery
    }
  })

  test('resolveCampaignName membersihkan prefix Foto profil dan memberi fallback bila kosong', ({
    assert,
  }) => {
    const controller = new CampaignsController()

    const sanitized = (controller as any).resolveCampaignName({
      name: 'Foto profil Fixture Sanitized Campaign',
      type: 'auto_share',
      config: { url: 'https://example.com/smoke-test' },
    })

    const fallback = (controller as any).resolveCampaignName({
      name: 'Foto profil',
      type: 'scrape_group',
      config: { keyword: 'jual motor' },
    })

    assert.equal(sanitized, 'Fixture Sanitized Campaign')
    assert.equal(fallback, 'Scrape Group · jual motor')
  })
})
