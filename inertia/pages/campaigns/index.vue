<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { cn } from '~/lib/utils'
import { Plus, Eye, Pencil, Trash2, RefreshCcw } from '@lucide/vue'
import { Icon } from '@iconify/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'

type CampaignRow = {
  id: string
  name: string
  type: string
  status: string
  useProxy: boolean
  maxConcurrency: number
  accountsCount: number
  groupsCount: number
  headless: boolean
  advanceMode: boolean
  createdAt: string | null
}

const props = defineProps<{
  campaigns: {
    data: CampaignRow[]
    stats: {
      total: number
      scrapeGroup: number
      autoShare: number
      autoJoin: number
      scrapeProfile: number
      autoAddFriend: number
      autoLike: number
      autoComment: number
      autoInvite: number
      autoPost: number
      autoUnfriend: number
      autoDelete: number
      autoConfirm: number
      autoCreate: number
      autoInbox: number
      draft: number
      running: number
      completed: number
      paused: number
      failed: number
    }
    meta: TableMeta
  }
  filters: {
    search: string
    type: string
    status: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
}>()

const rows = computed(() => props.campaigns.data)
const meta = computed(() => props.campaigns.meta)
const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const table = useDataTable({
  only: ['campaigns'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      type: props.filters.type,
      status: props.filters.status,
      startDate: props.filters.startDate,
      endDate: props.filters.endDate,
    },
  },
})
watch(
  rangeDate,
  (value) => {
    table.filters.startDate = value?.[0] ? formatDate(value[0]) : ''
    table.filters.endDate = value?.[1] ? formatDate(value[1]) : ''
    table.reload({ page: 1 })
  },
  { deep: true }
)

const selection = useTableSelection(rows)

const columns: DataTableColumn[] = [
  { key: 'name', label: 'Nama', sortable: true },
  { key: 'type', label: 'Tipe', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'targets', label: 'Akun / Group' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '', align: 'right' },
]

const TYPES = [
  'all',
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
]
const STATUS = ['all', 'draft', 'running', 'paused', 'completed', 'failed']

const typeLabel = (t: string) =>
  ({ scrape_group: 'Scrape Group', auto_share: 'Auto Share', auto_join: 'Auto Join' })[t] ?? t

const statusBadge = (s: string) =>
  ({
    draft: 'bg-muted text-muted-foreground',
    running: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
    paused: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    completed: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  })[s] ?? 'bg-muted text-muted-foreground'

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function buildQuery() {
  return {
    page: meta.value.currentPage,
    perPage: table.perPage.value,
    search: table.search.value,
    type: table.filters.type,
    order: table.filters.order,
    sort: table.filters.sort,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
    status: table.filters.status,
  }
}
function refresh() {
  router.get('/campaigns', buildQuery(), { preserveScroll: true, preserveState: false })
}
function destroy(id: string) {
  if (!confirm('Hapus campaign ini?')) return
  router.delete(`/campaigns/${id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => refresh(),
  })
}
function bulkDelete() {
  if (!confirm('Hapus campaign terpilih?')) return
  router.post(
    '/campaigns/bulk',
    {
      action: 'delete',
      ...selection.payload(),
      filters: {
        search: table.search.value,
        type: table.filters.type,
        status: table.filters.status,
      },
    },
    {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => {
        selection.clear()
        refresh()
      },
    }
  )
}

const statsCard = [
  {
    label: 'Total Campaign',
    value: props.campaigns.stats.total,
    icon: 'material-symbols:campaign',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Scrape Group',
    value: props.campaigns.stats.scrapeGroup,
    icon: 'material-symbols:campaign',
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: 'Auto Share',
    value: props.campaigns.stats.autoShare,
    icon: 'material-symbols:campaign',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    label: 'Auto Join',
    value: props.campaigns.stats.autoJoin,
    icon: 'material-symbols:campaign',
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
  },

  {
    label: 'Profile Scraper',
    value: props.campaigns.stats.scrapeProfile,
    icon: 'material-symbols:campaign',
    color: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Auto Add Friend',
    value: props.campaigns.stats.autoAddFriend,
    icon: 'material-symbols:campaign',
    color: 'text-purple-600 dark:text-purple-400',
  },
  {
    label: 'Auto Like',
    value: props.campaigns.stats.autoLike,
    icon: 'material-symbols:campaign',
    color: 'text-green-600 dark:text-green-400',
  },
  {
    label: 'Auto Comment',
    value: props.campaigns.stats.autoComment,
    icon: 'material-symbols:campaign',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    label: 'Auto Invite',
    value: props.campaigns.stats.autoInvite,
    icon: 'material-symbols:campaign',
    color: 'text-orange-600 dark:text-orange-400',
  },
  {
    label: 'Auto Post',
    value: props.campaigns.stats.autoPost,
    icon: 'material-symbols:campaign',
    color: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Auto Unfriend',
    value: props.campaigns.stats.autoUnfriend,
    icon: 'material-symbols:campaign',
    color: 'text-pink-600 dark:text-pink-400',
  },
  {
    label: 'Auto Inbox',
    value: props.campaigns.stats.autoInbox,
    icon: 'material-symbols:campaign',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Auto Delete',
    value: props.campaigns.stats.autoDelete,
    icon: 'material-symbols:campaign',
    color: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Auto Confirm',
    value: props.campaigns.stats.autoConfirm,
    icon: 'material-symbols:campaign',
    color: 'text-green-600 dark:text-green-400',
  },
  {
    label: 'Auto Create',
    value: props.campaigns.stats.autoCreate,
    icon: 'material-symbols:campaign',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Draft',
    value: props.campaigns.stats.draft,
    icon: 'hugeicons:license-draft',
    color: 'text-muted text-muted-foreground',
  },
  {
    label: 'Running',
    value: props.campaigns.stats.running,
    icon: 'material-symbols:play-circle-outline',
    color: 'text-teal-600 dark:text-teal-400',
  },
  {
    label: 'Completed',
    value: props.campaigns.stats.completed,
    icon: 'material-symbols:check-circle-outline',
    color: 'text-emerald-600 dark:text-emerald--400',
  },
  {
    label: 'Paused',
    value: props.campaigns.stats.paused,
    icon: 'lucide:circle-pause',
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Failed',
    value: props.campaigns.stats.failed,
    icon: 'lucide:circle-x',
    color: 'text-red-600 dark:text-red-400',
  },
]
</script>

<template>
  <Head title="Campaigns" />
  <App
    title="Campaign Management"
    description="Buat & kelola session campaign (scrape group, auto share, auto join)."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <Link
          href="/campaigns/create"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus class="size-4" /> Buat Campaign
        </Link>
      </div>
    </template>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-5 shadow-md">
      <div
        v-for="k in statsCard"
        :key="k.label"
        class="rounded-lg border border-border bg-background p-4"
      >
        <span class="text-xs text-muted-foreground">{{ k.label }}</span>
        <div class="flex items-center justify-between">
          <Icon :icon="k.icon" :class="cn('size-6', k.color)" />
          <div class="mt-1 text-2xl font-semibold">{{ k.value }}</div>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input
        v-model="table.search.value"
        type="text"
        placeholder="Cari nama campaign…"
        class="max-w-xs flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
      />
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker v-model="rangeDate" />
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.type"
          @change="table.setFilter('type', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="t in TYPES" :key="t" :value="t">
            {{ t === "all" ? "Semua tipe" : typeLabel(t) }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.status"
          @change="table.setFilter('status', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="s in STATUS" :key="s" :value="s">
            {{ s === "all" ? "Semua status" : s }}
          </option>
        </select>
      </div>
    </div>

    <BulkActionBar
      v-if="selection.hasSelection.value"
      :count="selection.count.value"
      :all-matching="selection.allMatching.value"
      :matching-total="meta.total"
      @select-all-matching="selection.selectAllMatching()"
      @clear="selection.clear()"
    >
      <button
        type="button"
        class="rounded-md border border-red-500/40 px-2.5 py-1 text-sm text-red-500 hover:bg-red-500/10"
        @click="bulkDelete"
      >
        Hapus
      </button>
    </BulkActionBar>

    <DataTable
      :columns="columns"
      :rows="rows"
      :loading="table.loading.value"
      :sort="table.sort.value"
      :order="table.order.value"
      selectable
      :is-selected="selection.isSelected"
      :all-page-selected="selection.allPageSelected.value"
      :some-page-selected="selection.somePageSelected.value"
      empty-text="Belum ada campaign. Klik Buat Campaign."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-name="{ row }">
        <Link :href="`/campaigns/${row.id}`" class="font-medium hover:underline">{{
          row.name
        }}</Link>
      </template>
      <template #cell-type="{ row }">
        <span class="text-xs">{{ typeLabel(row.type) }}</span>
      </template>
      <template #cell-status="{ row }">
        <span
          :class="
            cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              statusBadge(row.status)
            )
          "
          >{{ row.status }}</span
        >
      </template>
      <template #cell-targets="{ row }">
        <span class="text-xs text-muted-foreground"
          >{{ row.accountsCount }} akun · {{ row.groupsCount }} group</span
        >
      </template>
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-muted-foreground">{{ fmtDate(row.createdAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <Link
            :href="`/campaigns/${row.id}`"
            class="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Detail"
          >
            <Eye class="size-3.5" />
          </Link>
          <Link
            v-if="row.status !== 'running'"
            :href="`/campaigns/${row.id}/edit`"
            class="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Edit"
          >
            <Pencil class="size-3.5" />
          </Link>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
            title="Hapus"
            @click="destroy(row.id)"
          >
            <Trash2 class="size-3.5" />
          </button>
        </div>
      </template>
    </DataTable>

    <Pagination
      :meta="meta"
      :per-page="table.perPage.value"
      @go="table.goToPage"
      @per-page="table.setPerPage"
    />
  </App>
</template>
