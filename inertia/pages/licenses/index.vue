<script setup lang="ts">
import { computed } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { cn } from '~/lib/utils'
import { Search, MonitorSmartphone, RotateCcw, RefreshCcw } from '@lucide/vue'
import { Icon } from '@iconify/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'

type LicenseRow = {
  id: string
  key: string
  status: string
  maxDevices: number
  plan: string | null
  expiresAt: string | null
  createdAt: string | null
  user: { email: string; fullName: string | null; role: string | null } | null
  devicesTotal: number
  activeDevices: number
  activeDevice: {
    name: string | null
    os: string
    deviceId: string
    lastVerifiedAt: string | null
  } | null
}

type StatsCard = {
  total: number
  active: number
  suspended: number
  revoked: number
  expired: number
}

const props = defineProps<{
  licenses: { data: LicenseRow[]; stats: StatsCard; meta: TableMeta }
  filters: {
    search: string
    status: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
}>()

const rows = computed(() => props.licenses.data)
const meta = computed(() => props.licenses.meta)
const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const table = useDataTable({
  only: ['licenses'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
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
  { key: 'key', label: 'License Key', sortable: true },
  { key: 'user', label: 'Pengguna' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'devices', label: 'Perangkat' },
  { key: 'expiresAt', label: 'Kedaluwarsa', sortable: true },
  { key: 'actions', label: '', align: 'right' },
]

const STATUS_FILTERS = ['all', 'active', 'suspended', 'revoked', 'expired']

const statusBadge = (s: string) =>
  ({
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    suspended: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    revoked: 'bg-red-500/15 text-red-600 dark:text-red-400',
    expired: 'bg-muted text-muted-foreground',
  })[s] ?? 'bg-muted text-muted-foreground'

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function setStatus(id: string, status: string) {
  router.post(
    `/licenses/${id}/status`,
    { status },
    { preserveScroll: true, preserveState: false, onSuccess: () => refresh() }
  )
}

function resetDevices(id: string) {
  if (!confirm('Reset binding perangkat untuk lisensi ini? Pengguna harus aktivasi ulang.')) return
  router.post(
    `/licenses/${id}/reset-devices`,
    {},
    { preserveScroll: true, preserveState: false, onSuccess: () => refresh() }
  )
}

function bulk(action: 'suspend' | 'reactivate') {
  router.post(
    '/licenses/bulk',
    {
      action,
      ...selection.payload(),
      filters: { search: table.search.value, status: table.filters.status },
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

function buildQuery() {
  return {
    page: meta.value.currentPage,
    perPage: table.perPage.value,
    search: table.search.value,
    status: table.filters.status,
    order: table.filters.order,
    sort: table.filters.sort,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
  }
}
function refresh() {
  router.get('/licenses', buildQuery(), { preserveScroll: true, preserveState: false })
}

const statsCard = [
  {
    label: 'Total License',
    value: props.licenses.stats.total,
    icon: 'material-symbols:key-rounded',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Active',
    value: props.licenses.stats.active,
    icon: 'material-symbols:check-circle-outline',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Suspended',
    value: props.licenses.stats.suspended,
    icon: 'lucide:circle-minus',
    color: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Revoked',
    value: props.licenses.stats.revoked,
    icon: 'material-symbols:refresh',
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Expired',
    value: props.licenses.stats.expired,
    icon: 'lucide:circle-alert',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
]
</script>

<template>
  <Head title="Licenses & Devices" />
  <App
    title="Licenses & Devices"
    description="Kelola lisensi tim dan binding perangkat (1 lisensi · 1 perangkat)."
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
          placeholder="Cari key / email…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>

      <div class="flex items-center gap-1">
        <div class="flex items-center gap-2">
          <DateRangePicker v-model="rangeDate" />
        </div>
        <button
          v-for="s in STATUS_FILTERS"
          :key="s"
          type="button"
          :class="
            cn(
              'rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize',
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

    <!-- Bulk bar -->
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
        class="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
        @click="bulk('suspend')"
      >
        Suspend
      </button>
      <button
        type="button"
        class="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
        @click="bulk('reactivate')"
      >
        Aktifkan
      </button>
    </BulkActionBar>

    <!-- Table -->
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
      empty-text="Belum ada lisensi."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-key="{ row }">
        <span class="font-mono text-xs">{{ row.key }}</span>
      </template>

      <template #cell-user="{ row }">
        <div v-if="row.user">
          <div class="font-medium">{{ row.user.email }}</div>
          <div class="text-xs text-muted-foreground capitalize">
            {{ row.user.role }}
          </div>
        </div>
        <span v-else class="text-muted-foreground">—</span>
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

      <template #cell-devices="{ row }">
        <div class="flex items-center gap-1.5">
          <MonitorSmartphone class="size-4 text-muted-foreground" />
          <span>{{ row.activeDevices }}/{{ row.maxDevices }}</span>
          <span v-if="row.activeDevice" class="text-xs text-muted-foreground">
            · {{ row.activeDevice.name || row.activeDevice.os }}
          </span>
        </div>
      </template>

      <template #cell-expiresAt="{ row }">
        {{ row.expiresAt ? fmtDate(row.expiresAt) : "Selamanya" }}
      </template>

      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button
            v-if="row.status === 'active'"
            type="button"
            class="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted text-destructive"
            @click="setStatus(row.id, 'suspended')"
          >
            Suspend
          </button>
          <button
            v-else-if="row.status === 'suspended'"
            type="button"
            class="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            @click="setStatus(row.id, 'active')"
          >
            Aktifkan
          </button>
          <button
            type="button"
            :disabled="row.activeDevices === 0"
            class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40"
            title="Reset binding perangkat"
            @click="resetDevices(row.id)"
          >
            <RotateCcw class="size-3.5" /> Reset
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
