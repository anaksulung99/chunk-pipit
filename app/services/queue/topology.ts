/**
 * RabbitMQ topology for campaign jobs.
 *
 *   exchange fbauto.jobs (direct) ── routingKey ──▶ per-type durable queue
 *   failed messages ─ x-dead-letter-exchange ─▶ fbauto.dlx (fanout) ─▶ q.dead-letter
 */
export const JOBS_EXCHANGE = 'fbauto.jobs'
export const DLX_EXCHANGE = 'fbauto.dlx'
export const DEAD_LETTER_QUEUE = 'q.dead-letter'

export type CampaignType =
  | 'scrape_group'
  | 'auto_share'
  | 'auto_like'
  | 'auto_comment'
  | 'auto_post'
  | 'auto_join'
  | 'scrape_profile'
  | 'auto_add_friend'
  | 'auto_invite'
  | 'auto_unfriend'
  | 'auto_inbox'
  | 'auto_delete'
  | 'auto_confirm'

export const QUEUES: Record<CampaignType, { queue: string; routingKey: string }> = {
  scrape_group: { queue: 'q.scrape-group', routingKey: 'scrape.group' },
  auto_share: { queue: 'q.auto-share', routingKey: 'share.post' },
  auto_like: { queue: 'q.auto-like', routingKey: 'post.like' },
  auto_comment: { queue: 'q.auto-comment', routingKey: 'post.comment' },
  auto_post: { queue: 'q.auto-post', routingKey: 'post.publish' },
  auto_join: { queue: 'q.auto-join', routingKey: 'join.group' },
  scrape_profile: { queue: 'q.scrape-profile', routingKey: 'scrape.profile' },
  auto_add_friend: { queue: 'q.auto-add-friend', routingKey: 'friend.add' },
  auto_invite: { queue: 'q.auto-invite', routingKey: 'friend.invite' },
  auto_unfriend: { queue: 'q.auto-unfriend', routingKey: 'friend.unfriend' },
  auto_inbox: { queue: 'q.auto-inbox', routingKey: 'friend.inbox' },
  auto_delete: { queue: 'q.auto-delete', routingKey: 'content.delete' },
  auto_confirm: { queue: 'q.auto-confirm', routingKey: 'friend.confirm' },
}
