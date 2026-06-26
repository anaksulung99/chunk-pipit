/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import { activationThrottle } from '#start/limiter'
import router from '@adonisjs/core/services/router'
import User from '#models/user'

// Public activation gate (device not yet activated lands here).
router.on('/activation').renderInertia('activation/index', {}).as('activation.show')

// Public health probe (used by the production sidecar supervisor).
const HealthController = () => import('#controllers/health_controller')
router.get('/health', [HealthController, 'index']).as('health')

const ActivationController = () => import('#controllers/activation_controller')
router
  .group(() => {
    router.post('activation/activate', [ActivationController, 'activate']).as('activation.activate')
    router.post('activation/verify', [ActivationController, 'verify']).as('activation.verify')
  })
  .prefix('api')
  .use(activationThrottle)

// Public account creation & login.
router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])
  })
  .use(middleware.guest())

const DashboardController = () => import('#controllers/dashboard_controller')
const ProxiesController = () => import('#controllers/proxies_controller')
const FingerprintsController = () => import('#controllers/fingerprints_controller')
const FacebookAccountsController = () => import('#controllers/facebook_accounts_controller')
const GroupsController = () => import('#controllers/groups_controller')
const CampaignsController = () => import('#controllers/campaigns_controller')
const SessionLogsController = () => import('#controllers/session_logs_controller')
const UserProfileController = () => import('#controllers/user_profiles_controller')
const PersonalSettingsController = () => import('#controllers/personal_settings_controller')
const ProfilesController = () => import('#controllers/profiles_controller')
const ApiFacebookAccountController = () => import('#controllers/api/facebook_account_controller')

router
  .group(() => {
    router.get('/', [DashboardController, 'index']).as('home')
    router.get('dashboard/export', [DashboardController, 'export']).as('dashboard.export')

    // Proxy routes
    router.get('proxies', [ProxiesController, 'index']).as('proxies.index')
    router.post('proxies', [ProxiesController, 'store']).as('proxies.store')
    router.post('proxies/import', [ProxiesController, 'import']).as('proxies.import')
    router.post('proxies/bulk', [ProxiesController, 'bulk']).as('proxies.bulk')
    router.post('proxies/:id/health-check', [ProxiesController, 'healthCheck']).as('proxies.health')
    router.delete('proxies/:id', [ProxiesController, 'destroy']).as('proxies.destroy')

    // Fingerprint routes
    router.get('fingerprints', [FingerprintsController, 'index']).as('fingerprints.index')
    router.post('fingerprints', [FingerprintsController, 'store']).as('fingerprints.store')
    router.get('fingerprints/:id', [FingerprintsController, 'show']).as('fingerprints.show')
    router.post('fingerprints/bulk', [FingerprintsController, 'bulk']).as('fingerprints.bulk')
    router
      .post('fingerprints/:id/clone', [FingerprintsController, 'clone'])
      .as('fingerprints.clone')
    router
      .delete('fingerprints/:id', [FingerprintsController, 'destroy'])
      .as('fingerprints.destroy')
    router
      .put('fingerprints/:id/update', [FingerprintsController, 'update'])
      .as('fingerprints.update')

    // Facebook account (cookies) management (owner-scoped, all activated users).
    router.get('accounts', [FacebookAccountsController, 'index']).as('accounts.index')
    router.get('accounts/:id', [FacebookAccountsController, 'show']).as('accounts.show')
    router.post('accounts', [FacebookAccountsController, 'store']).as('accounts.store')
    router.post('accounts/bulk', [FacebookAccountsController, 'bulk']).as('accounts.bulk')
    router
      .post('accounts/:id/status', [FacebookAccountsController, 'updateStatus'])
      .as('accounts.status')
    router.put('accounts/:id/update', [FacebookAccountsController, 'update']).as('accounts.update')
    router.delete('accounts/:id', [FacebookAccountsController, 'destroy']).as('accounts.destroy')
    router
      .post('accounts/:id/health-check', [FacebookAccountsController, 'healthCheck'])
      .as('accounts.health')

    // Facebook group list management (owner-scoped, all activated users).
    router.get('groups', [GroupsController, 'index']).as('groups.index')
    router.get('groups/export', [GroupsController, 'export']).as('groups.export')
    router.get('groups/:id', [GroupsController, 'show']).as('groups.show')
    router.post('groups/import', [GroupsController, 'import']).as('groups.import')
    router.post('groups/bulk', [GroupsController, 'bulk']).as('groups.bulk')
    router.post('groups/:id/type', [GroupsController, 'updateType']).as('groups.type')
    router.delete('groups/:id', [GroupsController, 'destroy']).as('groups.destroy')

    // Campaign management (owner-scoped, all activated users).
    router.get('campaigns', [CampaignsController, 'index']).as('campaigns.index')
    router.get('campaigns/create', [CampaignsController, 'create']).as('campaigns.create')

    router.post('campaigns', [CampaignsController, 'store']).as('campaigns.store')
    router.post('campaigns/bulk', [CampaignsController, 'bulk']).as('campaigns.bulk')
    router.get('campaigns/:id', [CampaignsController, 'show']).as('campaigns.show')
    router.get('campaigns/:id/edit', [CampaignsController, 'edit']).as('campaigns.edit')
    router.patch('campaigns/:id', [CampaignsController, 'update']).as('campaigns.update')
    router.get('campaigns/:id/stream', [CampaignsController, 'stream']).as('campaigns.stream')
    router
      .post('campaigns/:id/status', [CampaignsController, 'updateStatus'])
      .as('campaigns.status')
    router.delete('campaigns/:id', [CampaignsController, 'destroy']).as('campaigns.destroy')

    // Session logs viewer (owner-scoped, all activated users).
    router.get('logs', [SessionLogsController, 'index']).as('logs.index')
    router.post('logs/bulk', [SessionLogsController, 'bulk']).as('logs.bulk')

    // User profile management (owner-scoped, all activated users).
    router.get('settings/profile', [UserProfileController, 'profile']).as('settings.profile')
    router.put('settings/profile', [UserProfileController, 'update']).as('settings.update')
    router.put('settings/security', [UserProfileController, 'password']).as('settings.password')

    // Personal settings management (owner-scoped, all activated users).
    router
      .get('settings/personal-setting', [PersonalSettingsController, 'index'])
      .as('settings.personal-setting')
    router
      .put('settings/personal-setting', [PersonalSettingsController, 'update'])
      .as('settings.personal-setting.update')
    router
      .post('settings/personal-setting/test', [PersonalSettingsController, 'test'])
      .as('settings.personal-setting.test')

    // Profiles management (owner-scoped, all activated users).
    router.get('profiles', [ProfilesController, 'index']).as('profiles.index')
    router.post('profiles/bulk', [ProfilesController, 'bulk']).as('profiles.bulk')

    // Page-scoped JSON API routes. These are consumed from authenticated Inertia pages
    // and therefore use the web session guard from this route group.
    router
      .post('api/facebook-accounts/health-check', [ApiFacebookAccountController, 'healthCheck'])
      .as('api.facebook-accounts.health')
  })
  .use([middleware.auth(), middleware.activation()])

// Superadmin: license & device administration.
const TeamsController = () => import('#controllers/teams_controller')
const LicensesController = () => import('#controllers/licenses_controller')
router
  .group(() => {
    router.get('licenses', [LicensesController, 'index']).as('licenses.index')
    router.post('licenses/bulk', [LicensesController, 'bulk']).as('licenses.bulk')
    router.post('licenses/:id/status', [LicensesController, 'updateStatus']).as('licenses.status')
    router
      .post('licenses/:id/reset-devices', [LicensesController, 'resetDevices'])
      .as('licenses.reset')

    // Team management (owner-scoped, all activated users).
    router.get('teams', [TeamsController, 'index']).as('teams.index')
    router.get('teams/:id', [TeamsController, 'show']).as('teams.show')
    router.post('teams', [TeamsController, 'store']).as('teams.store')
    router.put('teams/:id/status', [TeamsController, 'setStatus']).as('teams.status')
    router.put('teams/:id/update', [TeamsController, 'update']).as('teams.update')
    router.delete('teams/:id', [TeamsController, 'destroy']).as('teams.destroy')
    router.post('teams/bulk', [TeamsController, 'bulk']).as('teams.bulk')
  })
  .use([middleware.auth(), middleware.activation(), middleware.role({ roles: ['superadmin'] })])

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())

router
  .group(() => {
    router.post('/users/:id/tokens', async ({ params }) => {
      const user = await User.findOrFail(params.id)
      const token = await User.accessTokens.create(user)

      return token
    })
  })
  .prefix('/api/v1')
  .use(middleware.auth({ guards: ['api'] }))
