export const GROUP_DETAIL_FIXTURE = {
  key: 'groups-detail-fixture-v1',
  detailGroupId: 'fixture-group-detail-001',
  detailGroupName: '[Fixture] Group Detail Analytics',
  smallGroupId: 'fixture-group-filter-010',
  smallGroupName: '[Fixture] Tiny Group 10 Members',
  accountSeeds: [
    { label: '[Fixture] Account Alpha', fbUserId: 'fixture-alpha', sessionStatus: 'active' },
    { label: '[Fixture] Account Beta', fbUserId: 'fixture-beta', sessionStatus: 'active' },
  ],
  campaignSeeds: [
    { name: '[Fixture] Group Detail Primary', type: 'auto_share' as const, status: 'completed' },
    { name: '[Fixture] Group Detail Secondary', type: 'auto_join' as const, status: 'running' },
  ],
} as const

export const CAMPAIGN_VISUAL_FIXTURE = {
  key: 'campaign-visual-fixture-v1',
  groupId: 'fixture-campaign-visual-001',
  groupName: '[Fixture] Campaign Visual Group',
  accountSeeds: [
    {
      label: '[Fixture] Visual Account Primary',
      fbUserId: 'fixture-visual-primary',
      sessionStatus: 'logged_out',
    },
    {
      label: '[Fixture] Visual Account Fallback',
      fbUserId: 'fixture-visual-fallback',
      sessionStatus: 'active',
    },
  ],
  campaignSeed: {
    name: '[Fixture] Campaign Visual Fallback',
    type: 'scrape_group' as const,
    status: 'completed',
  },
  groupTags: ['fixture-visual', 'fallback-demo', 'smoke-test'],
} as const

export const FIXTURE_CAMPAIGN_NAMES = [
  ...GROUP_DETAIL_FIXTURE.campaignSeeds.map((campaign) => campaign.name),
  CAMPAIGN_VISUAL_FIXTURE.campaignSeed.name,
  'Fixture Sanitized Campaign',
]

export const FIXTURE_ACCOUNT_LABELS = [
  ...GROUP_DETAIL_FIXTURE.accountSeeds.map((account) => account.label),
  ...CAMPAIGN_VISUAL_FIXTURE.accountSeeds.map((account) => account.label),
]

export const FIXTURE_GROUP_IDS = [
  GROUP_DETAIL_FIXTURE.detailGroupId,
  GROUP_DETAIL_FIXTURE.smallGroupId,
  CAMPAIGN_VISUAL_FIXTURE.groupId,
]
