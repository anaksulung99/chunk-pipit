<script setup lang="ts">
import { computed } from 'vue'
import { Head } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { cn } from '~/lib/utils'
import { Search, RefreshCcw } from '@lucide/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { Icon } from '@iconify/vue'

type LogRow = {
  id: string
  action: string
  status: string
  message: string | null
  workerId: string | null
  durationMs: number | null
  campaignId: string
  campaignName: string
  createdAt: string | null
}

const props = defineProps<{
  logs: {
    data: LogRow[]
    stats: {
      total: number
      success: number
      failed: number
      skipped: number
      checkpoint: number
    }
    meta: TableMeta
  }
  campaigns: { id: string; name: string }[]
  filters: {
    search: string
    status: string
    campaignId: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
}>()

const rows = computed(() => props.logs.data)
const meta = computed(() => props.logs.meta)
const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const table = useDataTable({
  only: ['logs'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      status: props.filters.status,
      campaignId: props.filters.campaignId,
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
  { key: 'createdAt', label: 'Waktu', sortable: true },
  { key: 'campaign', label: 'Campaign' },
  { key: 'action', label: 'Aksi', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'message', label: 'Pesan' },
]

const STATUS = ['all', 'success', 'failed', 'skipped', 'checkpoint']

const statusBadge = (s: string) =>
  ({
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
    skipped: 'bg-muted text-muted-foreground',
    checkpoint: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  })[s] ?? 'bg-muted text-muted-foreground'

function fmt(value: string | null) {
  return value ? new Date(value).toLocaleString('id-ID') : '—'
}

function buildQuery() {
  return {
    page: meta.value.currentPage,
    per_page: table.perPage.value,
    search: table.search.value,
    status: table.filters.status,
    campaignId: table.filters.campaignId,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
    order: table.order.value,
    sort: table.sort.value,
  }
}
function refresh() {
  router.get('/logs', buildQuery(), { preserveScroll: true, preserveState: false })
}
function bulkDelete() {
  if (!confirm('Hapus fingerprint terpilih?')) return
  router.post(
    '/logs/bulk',
    {
      action: 'delete',
      ...selection.payload(),
      filters: {
        search: table.search.value,
        status: table.filters.status,
        campaignId: table.filters.campaignId,
        startDate: table.filters.startDate,
        endDate: table.filters.endDate,
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
    label: 'Total Log',
    value: props.logs.stats.total,
    icon: 'material-symbols:groups',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Success',
    value: props.logs.stats.success,
    icon: 'material-symbols:check-circle-outline',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Failed',
    value: props.logs.stats.failed,
    icon: 'lucide:circle-x',
    color: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Skipped',
    value: props.logs.stats.skipped,
    icon: 'lucide:circle-minus',
    color: 'text-muted text-muted-foreground',
  },
  {
    label: 'Checkpoint',
    value: props.logs.stats.checkpoint,
    icon: 'lucide:circle-alert',
    color: 'text-amber-600 dark:text-amber-400',
  },
]
</script>

<template>
  <Head title="Session Logs" />
  <App
    title="Session Logs"
    description="Riwayat aksi worker per campaign (scrape / share / join)."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-3 shadow-md">
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
      <div class="relative max-w-xs flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          v-model="table.search.value"
          type="text"
          placeholder="Cari aksi / pesan…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker v-model="rangeDate" />
        <select
          class="max-w-48 rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.campaignId"
          @change="table.setFilter('campaignId', ($event.target as HTMLSelectElement).value)"
        >
          <option value="all">Semua campaign</option>
          <option v-for="c in campaigns" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
        <div class="flex items-center gap-1">
          <button
            v-for="s in STATUS"
            :key="s"
            type="button"
            :class="
              cn(
                'rounded-md border px-2 py-1.5 text-xs font-medium capitalize',
                table.filters.status === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )
            "
            @click="table.setFilter('status', s)"
          >
            {{ s === "all" ? "Semua" : s }}
          </button>
        </div>
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
      empty-text="Belum ada log."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-createdAt="{ row }">
        <span class="text-xs whitespace-nowrap text-muted-foreground">{{
          fmt(row.createdAt)
        }}</span>
      </template>
      <template #cell-campaign="{ row }">
        <Link :href="`/campaigns/${row.campaignId}`" class="text-xs hover:underline">
          {{ row.campaignName }}
        </Link>
      </template>
      <template #cell-action="{ row }">
        <span class="font-mono text-xs">{{ row.action }}</span>
      </template>
      <template #cell-status="{ row }">
        <span
          :class="
            cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              statusBadge(row.status)
            )
          "
        >
          {{ row.status }}
        </span>
      </template>
      <template #cell-message="{ row }">
        <span class="text-xs text-muted-foreground">{{ row.message || "—" }}</span>
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
