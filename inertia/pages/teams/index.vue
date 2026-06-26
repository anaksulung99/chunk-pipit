<script setup lang="ts">
import { Head } from '@inertiajs/vue3'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import { Link } from '@adonisjs/inertia/vue'
import { router } from '@inertiajs/vue3'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { Search, Plus, Copy, CheckCircle, Trash2, RefreshCcw, EyeIcon } from '@lucide/vue'
import { toast } from 'vue3-toastify'
import { Icon } from '@iconify/vue'

type TeamRow = {
  id: string
  fullName: string | null
  email: string
  role: string | null
  isActive: boolean | null
  lastLoginAt?: string | null
  createdAt: string | null
  updatedAt?: string | null
  license?: LicenseRow
}

type LicenseRow = {
  id: string
  key: string
  status: string
  maxDevices: number
  plan: string | null
  issuedAt: string | null
  expiresAt?: string | null
  notes: string | null
  createdAt: string | null
  updatedAt?: string | null
}

const props = defineProps<{
  users: {
    data: TeamRow[]
    stats: {
      total: number
      admin: number
      team: number
      active: number
      inactive: number
    }
    meta: TableMeta
  }
  filters: {
    search: string
    role: string
    status: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
}>()

const isCopied = ref(false)
const showInviteTeam = ref(false)
const rows = computed(() => props.users.data)
const meta = computed(() => props.users.meta)
const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)
const table = useDataTable({
  only: ['users'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      role: props.filters.role,
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
  { key: 'full_name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'is_active', label: 'Status', sortable: true },
  { key: 'license_key', label: 'License Key', sortable: false },
  { key: 'license_status', label: 'License Status', sortable: false },
  { key: 'createdAt', label: 'Bergabung' },
  { key: 'actions', label: '', align: 'right' },
]

const ROLES = ['all', 'superadmin', 'team']
const STATUS = ['all', 'active', 'inactive']

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
    per_page: table.perPage.value,
    search: table.search.value,
    order: table.order.value,
    sort: table.sort.value,
    role: table.filters.role,
    status: table.filters.status,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
  }
}
function refresh() {
  router.get('/teams', buildQuery(), { preserveScroll: true, preserveState: false })
}
function destroy(id: string) {
  if (!confirm('Hapus team ini?')) return
  router.delete(`/teams/${id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => {
      refresh()
    },
  })
}
function bulk(action: 'delete' | 'set_status', extra: Record<string, string> = {}) {
  if (action === 'delete' && !confirm('Hapus team terpilih?')) return
  router.post(
    '/teams/bulk',
    {
      action,
      ...extra,
      ...selection.payload(),
      filters: {
        search: table.search.value,
        role: table.filters.role,
        status: table.filters.status,
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

function copyLicenseKey(value?: LicenseRow) {
  if (!value?.key) return
  window.electronAPI?.copyToClipboard(value.key)
  isCopied.value = true
  toast.success('License key copied to clipboard')
  setTimeout(() => {
    isCopied.value = false
  }, 2000)
}

const statsCard = [
  {
    label: 'Total Account',
    value: props.users.stats.total,
    icon: 'material-symbols:account-circle',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Super Admin',
    value: props.users.stats.admin,
    icon: 'material-symbols:account-circle',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Team',
    value: props.users.stats.team,
    icon: 'material-symbols:account-circle',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    label: 'Active',
    value: props.users.stats.active,
    icon: 'material-symbols:check-circle-outline',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Inactive',
    value: props.users.stats.inactive,
    icon: 'lucide:circle-minus',
    color: 'text-red-600 dark:text-red-400',
  },
]
</script>

<template>
  <Head title="Teams" />
  <App title="Teams" description="Manage your teams & projects">
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <Button
          size="sm"
          class="bg-emerald-600 hover:bg-emerald-700 text-white"
          @click="showInviteTeam = true"
        >
          <Plus />
          Invite
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
          placeholder="Cari ID / nama team…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker v-model="rangeDate" />
        <div class="flex items-center gap-1">
          <select
            class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            :value="table.filters.role"
            @change="table.setFilter('role', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="s in ROLES" :key="s" :value="s">
              {{ s === "all" ? "Semua role" : s }}
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
        class="rounded-md border border-emerald-500/40 px-2.5 py-1 text-sm text-emerald-500 hover:bg-emerald-500/10"
        @click="bulk('set_status', { status: 'active' })"
      >
        Aktifkan
      </button>
      <button
        type="button"
        class="rounded-md border border-amber-500/40 px-2.5 py-1 text-sm text-amber-500 hover:bg-amber-500/10"
        @click="bulk('set_status', { status: 'inactive' })"
      >
        Nonaktifkan
      </button>

      <button
        type="button"
        class="rounded-md border border-red-500/40 px-2.5 py-1 text-sm text-red-500 hover:bg-red-500/10"
        @click="bulk('delete')"
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
      empty-text="Belum ada team. Import untuk menambah."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-full_name="{ row }">
        <div class="font-medium">{{ row.fullName || row.id }}</div>
      </template>
      <template #cell-email="{ row }">
        <div class="font-medium">{{ row.email }}</div>
      </template>
      <template #cell-role="{ row }">
        <div class="font-medium">{{ row.role }}</div>
      </template>
      <template #cell-is_active="{ row }">
        <span
          :class="
            cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              row.isActive
                ? 'bg-amber-500/15 text-emerald-600 dark:text-emerald-400'
                : 'bg-emerald-500/15 text-red-600 dark:text-red-400'
            )
          "
        >
          {{ row.isActive ? "Active" : "Inactive" }}
        </span>
      </template>
      <template #cell-license_key="{ row }">
        <div class="inline-flex items-center gap-2 cursor-pointer">
          <div class="font-medium truncate">{{ row.license?.key || "—" }}</div>
          <Button size="icon" variant="ghost" @click="copyLicenseKey(row.license)">
            <Copy v-if="!isCopied" class="size-4" />
            <CheckCircle v-else class="size-4 text-emerald-600" />
          </Button>
        </div>
      </template>
      <template #cell-license_status="{ row }">
        <div class="font-medium">{{ row.license?.status || "—" }}</div>
      </template>
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-muted-foreground">{{ fmtDate(row.createdAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <Link :href="`/teams/${row.id}`">
            <Button type="button" variant="ghost" title="Hapus" size="icon-sm">
              <EyeIcon class="size-3.5" />
            </Button>
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

    <InviteTeam v-model:open="showInviteTeam" @close="showInviteTeam = false" />
  </App>
</template>
