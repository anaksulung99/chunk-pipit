import vine from '@vinejs/vine'

const campaignType = vine.enum([
  'scrape_group',
  'auto_share',
  'auto_join',
  'scrape_profile',
  'auto_add_friend',
  'auto_like',
  'auto_comment',
  'auto_invite',
  'auto_post',
  'auto_unfriend',
  'auto_inbox',
  'auto_delete',
  'auto_confirm',
  'auto_create',
] as const)
const groupType = vine.enum(['public', 'private', 'both'] as const)
const profileType = vine.enum([
  'group_member',
  'page_profile_follower',
  'friend',
  'engagement_post',
] as const)
const inviteType = vine.enum(['group', 'page_follower', 'event'] as const)
const postType = vine.enum(['group', 'fanspage', 'event', 'friend'] as const)
const inboxType = vine.enum(['friend', 'fanspage'] as const)
const commentType = vine.enum(['post', 'comment'] as const)
const deleteType = vine.enum(['post', 'comment'] as const)
const confirmType = vine.enum(['friend', 'group'] as const)
const createType = vine.enum(['group', 'fanspage', 'event'] as const)
const createGroupPrivacy = vine.enum(['public', 'private'] as const)
const addFriendType = vine.enum(['group', 'profile', 'any_facebook_url'] as const)

export const createCampaignValidator = vine.create({
  name: vine.string().trim().maxLength(200).optional(),
  type: campaignType,
  headless: vine
    .boolean()
    .optional()
    .transform((value) => value ?? true),
  advanceMode: vine
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  fingerprintId: vine.string().uuid().optional(),
  useProxy: vine.boolean().optional(),
  maxConcurrency: vine.number().min(1).max(5).optional(),
  maxAccounts: vine.number().min(1).max(50).optional(),
  maxDelayMs: vine.number().min(0).max(120000).optional(),
  maxTargets: vine.number().min(1).max(100000).optional(),
  minGroupMember: vine
    .number()
    .min(1)
    .max(10000000)
    .optional()
    .transform((value) => value ?? 10000),
  targetGroupType: groupType.optional(),
  accountIds: vine.array(vine.string().uuid()).optional(),
  groupIds: vine.array(vine.string().uuid()).optional(),
  profileIds: vine.array(vine.string().uuid()).optional(),
  config: vine
    .object({
      url: vine.string().trim().maxLength(1000).optional(),
      caption: vine.string().trim().maxLength(5000).optional(),
      groupTags: vine.array(vine.string().trim().maxLength(80)).optional(),
      profileTags: vine.array(vine.string().trim().maxLength(80)).optional(),
      sourceType: vine.enum(['keyword', 'friend_joined_group']).optional(),
      keyword: vine.string().trim().maxLength(255).optional(),
      friendProfileUrl: vine.string().trim().maxLength(500).optional(),
      pageUrl: vine.string().trim().maxLength(500).optional(),
      anyFacebookUrl: vine.string().trim().maxLength(500).optional(),
      manualGroupUrl: vine.string().trim().maxLength(1000).optional(),
      skipPrivateNotJoined: vine.boolean().optional(),
      retryFailed: vine.boolean().optional(),
      dailyJoinLimit: vine.number().min(1).max(200).optional(),
      minFriendCount: vine.number().min(0).max(10000000).optional(),
      scrapeProfileType: profileType.optional(),
      inviteType: inviteType.optional(),
      postType: postType.optional(),
      commentType: commentType.optional(),
      inboxType: inboxType.optional(),
      deleteType: deleteType.optional(),
      confirmType: confirmType.optional(),
      createType: createType.optional(),
      groupPrivacy: createGroupPrivacy.optional(),
      addFriendType: addFriendType.optional(),
    })
    .optional(),
})

export const updateCampaignStatusValidator = vine.create({
  status: vine.enum(['draft', 'running', 'paused', 'completed', 'failed'] as const),
})

export const bulkCampaignValidator = vine.create({
  action: vine.enum(['delete'] as const),
  mode: vine.enum(['ids', 'all_matching'] as const),
  ids: vine.array(vine.string().uuid()).optional(),
  excludedIds: vine.array(vine.string().uuid()).optional(),
  filters: vine
    .object({
      search: vine.string().trim().optional(),
      type: vine.string().trim().optional(),
      status: vine.string().trim().optional(),
    })
    .optional(),
})

export const updateCampaignValidator = vine.create({
  name: vine.string().trim().maxLength(200).optional(),
  type: campaignType,
  headless: vine
    .boolean()
    .optional()
    .transform((value) => value ?? true),
  advanceMode: vine
    .boolean()
    .optional()
    .transform((value) => value ?? false),
  fingerprintId: vine.string().uuid().optional(),
  useProxy: vine.boolean().optional(),
  maxConcurrency: vine.number().min(1).max(5).optional(),
  maxAccounts: vine.number().min(1).max(50).optional(),
  maxDelayMs: vine.number().min(0).max(120000).optional(),
  maxTargets: vine.number().min(1).max(100000).optional(),
  targetGroupType: groupType.optional(),
  accountIds: vine.array(vine.string().uuid()).optional(),
  groupIds: vine.array(vine.string().uuid()).optional(),
  profileIds: vine.array(vine.string().uuid()).optional(),
  minGroupMember: vine
    .number()
    .min(1)
    .max(10000000)
    .optional()
    .transform((value) => value ?? 10000),
  config: vine
    .object({
      url: vine.string().trim().maxLength(1000).optional(),
      caption: vine.string().trim().maxLength(5000).optional(),
      groupTags: vine.array(vine.string().trim().maxLength(80)).optional(),
      profileTags: vine.array(vine.string().trim().maxLength(80)).optional(),
      sourceType: vine.enum(['keyword', 'friend_joined_group']).optional(),
      keyword: vine.string().trim().maxLength(255).optional(),
      friendProfileUrl: vine.string().trim().maxLength(500).optional(),
      pageUrl: vine.string().trim().maxLength(500).optional(),
      anyFacebookUrl: vine.string().trim().maxLength(500).optional(),
      manualGroupUrl: vine.string().trim().maxLength(1000).optional(),
      skipPrivateNotJoined: vine.boolean().optional(),
      retryFailed: vine.boolean().optional(),
      dailyJoinLimit: vine.number().min(1).max(200).optional(),
      minFriendCount: vine.number().min(0).max(10000000).optional(),
      scrapeProfileType: profileType.optional(),
      inviteType: inviteType.optional(),
      postType: postType.optional(),
      commentType: commentType.optional(),
      inboxType: inboxType.optional(),
      deleteType: deleteType.optional(),
      confirmType: confirmType.optional(),
      createType: createType.optional(),
      groupPrivacy: createGroupPrivacy.optional(),
      addFriendType: addFriendType.optional(),
    })
    .optional(),
})
