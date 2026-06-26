<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Search, Plus, Copy, Trash2, X, RefreshCcw, Edit2 } from '@lucide/vue'
import { Icon } from '@iconify/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'
import UpdateFingerprint from '~/components/fingerprint/UpdateFingerprint.vue'

type FingerprintRow = {
  id: string
  name: string
  osType: string
  osVersion: string | null
  browserType: string
  browserVersion: string | null
  userAgent: string | null
  screenWidth: number | null
  screenHeight: number | null
  webglVendor: string | null
  createdAt: string | null
}

type StatsCard = {
  total: number
  windows: number
  linux: number
  macos: number
  chrome: number
  firefox: number
  safari: number
  edge: number
}

const props = defineProps<{
  fingerprints: { data: FingerprintRow[]; stats: StatsCard; meta: TableMeta }
  filters: {
    search: string
    osType: string
    browserType: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
}>()

const rows = computed(() => props.fingerprints.data)
const meta = computed(() => props.fingerprints.meta)
const dataToAction = ref({
  show: false,
  data: null as FingerprintRow | null,
})

const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const table = useDataTable({
  only: ['fingerprints'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      osType: props.filters.osType,
      browserType: props.filters.browserType,
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
  { key: 'os_type', label: 'OS', sortable: true },
  { key: 'browser_type', label: 'Browser', sortable: true },
  { key: 'userAgent', label: 'User Agent' },
  { key: 'screen', label: 'Layar' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '', align: 'right' },
]

const OS = ['all', 'windows', 'linux', 'macos']
const BROWSERS = ['all', 'chrome', 'firefox', 'safari', 'edge']

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const showCreate = ref(false)
const form = useForm({
  name: '',
  osType: 'windows',
  browserType: 'chrome',
  locale: 'id-ID',
  timezone: 'Asia/Jakarta',
})
function submitCreate() {
  form.post('/fingerprints', {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => {
      form.reset()
      showCreate.value = false
      refresh()
    },
  })
}

function clone(id: string) {
  router.post(`/fingerprints/${id}/clone`, {}, { preserveScroll: true, preserveState: false })
}

function openEdit(row: FingerprintRow) {
  dataToAction.value.show = true
  dataToAction.value.data = row
}

function closeEdit() {
  dataToAction.value.show = false
}

function destroy(id: string) {
  if (!confirm('Hapus fingerprint ini?')) return
  router.delete(`/fingerprints/${id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => refresh(),
  })
}
function bulkDelete() {
  if (!confirm('Hapus fingerprint terpilih?')) return
  router.post(
    '/fingerprints/bulk',
    {
      action: 'delete',
      ...selection.payload(),
      filters: {
        search: table.search.value,
        osType: table.filters.osType,
        browserType: table.filters.browserType,
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

function buildQuery() {
  return {
    page: meta.value.currentPage,
    per_page: table.perPage.value,
    search: table.search.value,
    osType: table.filters.osType,
    browserType: table.filters.browserType,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
    order: table.order.value,
    sort: table.sort.value,
  }
}

// Refresh fingerprints
function refresh() {
  router.get('/fingerprints', buildQuery(), { preserveScroll: true, preserveState: false })
}

const statsCard = [
  {
    label: 'Total Fingerprints',
    value: props.fingerprints.stats.total,
    icon: 'material-symbols:fingerprint',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    label: 'Windows',
    value: props.fingerprints.stats.windows,
    icon: 'logos:microsoft-windows-icon',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Linux',
    value: props.fingerprints.stats.linux,
    icon: 'logos:linux-tux',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    label: 'MacOS',
    value: props.fingerprints.stats.macos,
    icon: 'logos:macosx',
    color: 'text-muted-foreground',
  },
  {
    label: 'Chrome',
    value: props.fingerprints.stats.chrome,
    icon: 'logos:chrome',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Firefox',
    value: props.fingerprints.stats.firefox,
    icon: 'logos:firefox',
    color: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Safari',
    value: props.fingerprints.stats.safari,
    icon: 'logos:safari',
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: 'Edge',
    value: props.fingerprints.stats.edge,
    icon: 'logos:microsoft-edge',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
]
</script>

<template>
  <Head title="Fingerprints" />
  <App
    title="Fingerprint Profiles"
    description="Generate & kelola fingerprint browser (desktop) untuk injeksi anti-deteksi."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <button
          v-if="!showCreate"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          @click="showCreate = true"
        >
          <Plus class="size-4" /> Generate
        </button>
        <button
          v-else
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-content-foreground hover:bg-destructive/90 text-white"
          @click="showCreate = false"
        >
          <X class="size-4" /> Tutup
        </button>
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

    <!-- Generate panel -->
    <form v-if="showCreate" class="space-y-4" @submit.prevent="submitCreate">
      <div
        class="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-3"
      >
        <div class="grid gap-2">
          <label for="name" class="text-sm font-medium"> Nama profil </label>
          <input v-model="form.name" placeholder="Nama profil" class="bg-input" />
        </div>
        <div class="grid gap-2">
          <label for="osType" class="text-sm font-medium"> OS </label>
          <select v-model="form.osType" class="bg-input capitalize">
            <option v-for="o in OS.slice(1)" :key="o" :value="o">{{ o }}</option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="browserType" class="text-sm font-medium"> Browser </label>
          <select v-model="form.browserType" class="bg-input capitalize">
            <option v-for="b in BROWSERS.slice(1)" :key="b" :value="b">{{ b }}</option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="locale" class="text-sm font-medium"> Locale </label>
          <select v-model="form.locale" class="bg-input capitalize">
            <option
              v-for="l in IsoLanguages"
              :key="l.code"
              :value="l.code"
              class="capitalize"
            >
              {{ l.name }}
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="timezone" class="text-sm font-medium"> Timezone </label>
          <select v-model="form.timezone" class="bg-input capitalize">
            <option
              v-for="l in TimezoneList"
              :key="l.zone"
              :value="l.zone"
              class="capitalize"
            >
              {{ l.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="form.processing"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {{ form.processing ? "Generating…" : "Generate & Simpan" }}
        </button>
        <span v-if="form.errors.name" class="text-xs text-red-500">{{
          form.errors.name
        }}</span>
      </div>
    </form>

    <!-- Toolbar -->
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="relative max-w-xs flex-1">
        <Search
          class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          v-model="table.search.value"
          type="text"
          placeholder="Cari nama / UA…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker v-model="rangeDate" />
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.osType"
          @change="table.setFilter('osType', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in OS" :key="o" :value="o">
            {{ o === "all" ? "Semua OS" : o }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.browserType"
          @change="table.setFilter('browserType', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="b in BROWSERS" :key="b" :value="b">
            {{ b === "all" ? "Semua browser" : b }}
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
      empty-text="Belum ada fingerprint. Klik Generate untuk membuat."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-name="{ row }">
        <Link :href="`/fingerprints/${row.id}`" class="font-medium hover:underline">
          {{ row.name }}
        </Link>
      </template>
      <template #cell-os_type="{ row }">
        <span class="capitalize">{{ row.osType }}</span>
        <span v-if="row.osVersion" class="text-xs text-muted-foreground">
          {{ row.osVersion }}</span
        >
      </template>
      <template #cell-browser_type="{ row }">
        <span class="capitalize">{{ row.browserType }}</span>
        <span v-if="row.browserVersion" class="text-xs text-muted-foreground">
          {{ row.browserVersion }}</span
        >
      </template>
      <template #cell-userAgent="{ row }">
        <span
          class="block max-w-xs truncate font-mono text-xs text-muted-foreground"
          :title="row.userAgent ?? ''"
        >
          {{ row.userAgent || "—" }}
        </span>
      </template>
      <template #cell-screen="{ row }">
        <span class="text-xs">{{
          row.screenWidth && row.screenHeight
            ? `${row.screenWidth}×${row.screenHeight}`
            : "—"
        }}</span>
      </template>
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-muted-foreground">{{ fmtDate(row.createdAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-blue-500/40 px-2 py-1 text-xs text-blue-500 hover:bg-blue-500/10"
            title="Edit"
            @click="openEdit(row)"
          >
            <Edit2 class="size-3.5" />
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Duplikasi"
            @click="clone(row.id)"
          >
            <Copy class="size-3.5" />
          </button>
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

    <UpdateFingerprint
      v-model:open="dataToAction.show"
      :data="dataToAction.data"
      @close="closeEdit"
    />
  </App>
</template>
