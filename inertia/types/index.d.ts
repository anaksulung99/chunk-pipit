declare global {
  interface DeviceInfo {
    id: string
    name: string
    os: string
    osVersion?: string
    appVersion?: string
  }

  interface Window {
    electronAPI?: ElectronAPI
    /** Stable hardware identity injected by the Electron preload. */
    __APP_DEVICE__?: DeviceInfo | null
  }

  interface ElectronAPI {
    isElectron: boolean
    checkConnection: () => boolean
    getNetworkInfo: () => Promise<{
      online: boolean
      interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>
    }>
    getDeviceInfo: () => Promise<{ deviceId: string; deviceName: string }>
    getAppInfo: () => Promise<{ version: string; platform: string; isDev: boolean }>
    checkRuntimeRequirements: () => Promise<{
      node: { installed: boolean; version?: string; message?: string }
      playwright: {
        installed: boolean
        browsers: { chromium: boolean; firefox: boolean; webkit: boolean }
        allBrowsersInstalled: boolean
        message?: string
      }
    }>
    copyToClipboard: (text: string) => void
    activation: {
      getStored: () => Promise<{ licenseKey?: string }>
      setStored: (data: { licenseKey?: string }) => Promise<{ licenseKey?: string }>
      clearStored: () => Promise<unknown>
    }
  }

  interface RetryOptions {
    maxRetries?: number
    delayMs?: number
    backoffMultiplier?: number
  }
  interface NetworkInfo {
    online: boolean
    type: 'connected' | 'disconnected' | 'unknown'
    timestamp: string
    networkInterfaces?: Array<{
      name: string
      address: string
      mac: string
    }>
  }

  export interface AdminNavItem {
    label: string
    href: string
    icon: string
  }
  type ColorVariant = 'indigo' | 'emerald' | 'amber' | 'red' | 'blue' | 'purple' | 'slate'

  interface StatsCard {
    label: string
    value?: number | string
    unit?: string
    icon: string
    color?: ColorVariant
    change?: number
    description?: string

    format?: 'number' | 'compact' | 'percent' | 'none'
  }

  type CampaignType =
    | 'scrape_group'
    | 'auto_share'
    | 'auto_join'
    | 'scrape_profile'
    | 'auto_add_friend'
    | 'auto_like'
    | 'auto_comment'
    | 'auto_invite'
    | 'auto_post'
    | 'auto_unfriend'
    | 'auto_inbox'
    | 'auto_delete'
    | 'auto_confirm'
    | 'auto_create'
  type CampaignGroupType = 'public' | 'private' | 'both'
  type CampaignProfileType = 'group_member' | 'page_profile_follower' | 'friend' | 'engagement_post'
  type CampaignInviteType = 'group' | 'page_follower' | 'event'
  type CampaignPostType = 'group' | 'fanspage' | 'event' | 'friend'
  type CampaignInboxType = 'friend' | 'fanspage'
  type CampaignDeleteType = 'post' | 'comment'
  type CampaignCommentType = 'post' | 'comment'
  type CampaignConfirmType = 'friend' | 'group'
  type CampaignCreateType = 'group' | 'fanspage' | 'event'
  type CampaignAddFriendType = 'group' | 'profile' | 'any_facebook_url'
}
export {}
