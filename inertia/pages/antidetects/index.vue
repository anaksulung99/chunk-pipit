<script lang="ts" setup>
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { Search, Plus, Copy, Trash2, RefreshCcw, Edit2, PlayIcon } from '@lucide/vue'
import { Icon } from '@iconify/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'

type AntidetectRow = {
  id: string
  name: string
  userId: string
  engine: string
  deviceType: string
  osName: string
  osVersion: string
  browserName: string
  browserVersion: string
  userAgent: string
  language: string
  timezone: string
  locale: string
  proxyId: string | null
  screenHeight: number | null
  screenWidth: number | null
  deviceScaleFactor: number
  isMobile: boolean
  hasTouch: boolean
  canvasMode: string
  canvasSeed: number | null
  webglVendor: string | null
  webglRenderer: string | null
  hardwareConcurrency: number
  deviceMemory: number | null
  rawFingerprint: any
  createdAt: string | null
  updatedAt: string | null
}
type StatsData = {
  total: number
  windows: number
  linux: number
  macos: number
  android: number
  ios: number
  chrome: number
  firefox: number
  safari: number
  edge: number
  chromeMobile: number
  safariMobile: number
  firefoxMobile: number
}
type ProxyOption = {
  id: string
  label: string
  status: string | null
  country: string | null
}

const props = defineProps<{
  antidetects: {
    data: AntidetectRow[]
    stats: StatsData
    meta: {
      total: number
      perPage: number
      currentPage: number
      lastPage: number
      firstPage: number
    }
  }
  filters: {
    search: string
    engine: string
    deviceType: string
    osName: string
    browserName: string
    language: string
    timezone: string
    sort: string
    order: string
    perPage: number
    startDate: string
    endDate: string
  }
  proxies: ProxyOption[]
}>()
const showCreateForm = ref(false)

const rows = computed(() => props.antidetects.data)
const meta = computed(() => props.antidetects.meta)
const dataToAction = ref({
  show: false,
  data: null as AntidetectRow | null,
})

const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const table = useDataTable({
  only: ['antidetects'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order as TableOrder,
    perPage: props.filters.perPage,
    filters: {
      engine: props.filters.engine ?? 'all',
      deviceType: props.filters.deviceType ?? 'all',
      osName: props.filters.osName ?? 'all',
      browserName: props.filters.browserName ?? 'all',
      language: props.filters.language ?? 'all',
      timezone: props.filters.timezone ?? 'all',
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
  { key: 'engine', label: 'Engine', sortable: true },
  { key: 'device_type', label: 'Device Type', sortable: true },
  { key: 'os_name', label: 'OS', sortable: true },
  { key: 'browser_name', label: 'Browser', sortable: true },
  { key: 'language', label: 'Language', sortable: true },
  { key: 'timezone', label: 'Timezone', sortable: true },
  { key: 'locale', label: 'Locale', sortable: true },
  { key: 'screen_width', label: 'Screen Width', sortable: true },
  { key: 'screen_height', label: 'Screen Height', sortable: true },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '', align: 'right' },
]

const ENGINES = ['all', 'chrome', 'firefox', 'webkit']
const DEVICE_TYPE = ['all', 'desktop', 'mobile']
const OS_NAME = ['all', 'windows', 'linux', 'macos', 'android', 'ios']
const BROWSER_NAME = [
  'all',
  'chrome',
  'firefox',
  'safari',
  'edge',
  'chrome_mobile',
  'safari_mobile',
  'firefox_mobile',
]

function buildQuery() {
  return {
    page: meta.value.currentPage,
    per_page: table.perPage.value,
    search: table.search.value,
    engine: table.filters.engine,
    deviceType: table.filters.deviceType,
    osName: table.filters.osName,
    browserName: table.filters.browserName,
    language: table.filters.language,
    timezone: table.filters.timezone,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
    order: table.order.value,
    sort: table.sort.value,
  }
}

function refresh() {
  router.get('/antidetects', buildQuery(), { preserveScroll: true, preserveState: false })
}

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
const deviceStatsCard = [
  {
    label: 'Total Antidetects',
    value: props.antidetects.stats.total,
    icon: 'material-symbols:fingerprint',
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    label: 'Windows',
    value: props.antidetects.stats.windows,
    icon: 'logos:microsoft-windows-icon',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Linux',
    value: props.antidetects.stats.linux,
    icon: 'logos:linux-tux',
    color: 'text-yellow-600 dark:text-yellow-400',
  },
  {
    label: 'MacOS',
    value: props.antidetects.stats.macos,
    icon: 'logos:macosx',
    color: 'text-muted-foreground',
  },
  {
    label: 'Android',
    value: props.antidetects.stats.android,
    icon: 'logos:android-icon',
    color: 'text-muted-foreground',
  },
  {
    label: 'iOS',
    value: props.antidetects.stats.ios,
    icon: 'ic:baseline-apple',
    color: 'text-muted-foreground',
  },
]
const browserStatsCard = [
   {
    label: 'Chrome',
    value: props.antidetects.stats.chrome,
    icon: 'logos:chrome',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Firefox',
    value: props.antidetects.stats.firefox,
    icon: 'logos:firefox',
    color: 'text-red-600 dark:text-red-400',
  },
  {
    label: 'Safari',
    value: props.antidetects.stats.safari,
    icon: 'logos:safari',
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: 'Edge',
    value: props.antidetects.stats.edge,
    icon: 'logos:microsoft-edge',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    label: 'Chrome Mobile',
    value: props.antidetects.stats.chromeMobile,
    icon: 'logos:chrome',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Safari Mobile',
    value: props.antidetects.stats.safariMobile,
    icon: 'logos:safari',
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: 'Firefox Mobile',
    value: props.antidetects.stats.firefoxMobile,
    icon: 'logos:firefox',
    color: 'text-red-600 dark:text-red-400',
  },
]

function clone(data: AntidetectRow){
 router.post(`/antidetects/${data.id}/clone`, {}, {
  preserveScroll: true,
  preserveState: false,
  onSuccess: () => refresh(),
 })
}
function destroy(data: AntidetectRow){
 if (!confirm('Hapus antidetect ini?')) return
  router.delete(`/antidetects/${data.id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => refresh(),
  })
}
function bulk() {
  if (!confirm('Hapus antidetect terpilih?')) return
  router.post(
    '/antidetects/bulk',
    {
      action: 'delete',
      ...selection.payload(),
      filters: {
        search: table.search.value,
        engine: table.filters.engine,
        deviceType: table.filters.deviceType,
        osName: table.filters.osName,
        browserName: table.filters.browserName,
        language: table.filters.language,
        timezone: table.filters.timezone,
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

function getCookie(name: string) {
  return (
    document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${name}=`))
      ?.split('=')
      .slice(1)
      .join('=') ?? ''
  )
}

async function start(data: AntidetectRow) {
  try {
    const xsrfToken = decodeURIComponent(getCookie('XSRF-TOKEN'))
    const response = await fetch(`/antidetects/${data.id}/start`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(xsrfToken ? { 'X-XSRF-TOKEN': xsrfToken } : {}),
      },
    })
    const result = await response.json().catch(() => null)

    if (!response.ok) {
      alert(result?.message ?? 'Antidetect gagal dimulai.')
      return
    }

    alert(result?.message ?? 'Antidetect dimulai.')
  } catch (error) {
    alert(error instanceof Error ? error.message : 'Antidetect gagal dimulai.')
  }
}
</script>

<template>
  <Head title="Virtual Antidetect Browser" />
  <App
    title="Virtual Antidetect Browser"
    description="Generate & virtual antidetect browser (desktop) untuk injeksi anti-deteksi."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          @click="showCreateForm = true"
        >
          <Plus class="size-4" /> Buat Baru
        </button>
      </div>
    </template>

    <div class="space-y-4">
      <div class="space-y-2 rounded-md border border-border p-2">
        <div>Device Antidetect Yang Dibuat</div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3 shadow-md">
          <div
            v-for="k in deviceStatsCard"
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
      </div>
      <div class="space-y-2 rounded-md border border-border p-2">
        <div>Browser Antidetect Yang Dibuat</div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-3 shadow-md">
          <div
            v-for="k in browserStatsCard"
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
      </div>
    </div>

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
          :value="table.filters.engine"
          @change="table.setFilter('engine', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in ENGINES" :key="o" :value="o">
            {{ o === "all" ? "Semua engine" : o }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.deviceType"
          @change="table.setFilter('deviceType', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in DEVICE_TYPE" :key="o" :value="o">
            {{ o === "all" ? "Semua device" : o }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.osName"
          @change="table.setFilter('osName', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="o in OS_NAME" :key="o" :value="o">
            {{ o === "all" ? "Semua OS" : o }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.browserName"
          @change="table.setFilter('browserName', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="b in BROWSER_NAME" :key="b" :value="b">
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
        @click="bulk"
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
      empty-text="Belum ada antidetect. Klik Generate untuk membuat."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-name="{ row }">
        <Link :href="`/antidetects/${row.id}`" class="font-medium hover:underline">
          {{ row.name }}
        </Link>
      </template>
      <template #cell-engine="{ row }">
        <span class="capitalize">{{ row.engine }}</span>
      </template>
      <template #cell-os_name="{ row }">
        <span class="capitalize">{{ row.osName }}</span>
        <span v-if="row.osVersion" class="text-xs text-muted-foreground">
          {{ row.osVersion }}</span
        >
      </template>
      <template #cell-browser_name="{ row }">
        <span class="capitalize">{{ row.browserName }}</span>
        <span v-if="row.browserVersion" class="text-xs text-muted-foreground">
          {{ row.browserVersion }}</span
        >
      </template>
      <template #cell-language="{ row }">
        <span class="capitalize">{{ row.language }}</span>
      </template>
      <template #cell-timezone="{ row }">
        <span class="capitalize">{{ row.timezone }}</span>
      </template>
      <template #cell-locale="{ row }">
        <span class="capitalize">{{ row.locale }}</span>
      </template>
      <template #cell-screen_width="{ row }">
        <span class="capitalize">{{ row.screenWidth }}</span>
      </template>
      <template #cell-screen_height="{ row }">
        <span class="capitalize">{{ row.screenHeight }}</span>
      </template>
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-muted-foreground">{{ fmtDate(row.createdAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button
            type="button"
            class="inline-flex items-center px-2 py-1 text-xs text-cyan-600 dark:text-cyan-500 hover:text-cyan-700 dark:hover:text-cyan-600"
            title="Mulai"
            @click="start(row)"
          >
            <PlayIcon class="size-3.5" />
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-blue-500/40 px-2 py-1 text-xs text-blue-500 hover:bg-blue-500/10"
            title="Edit"
            @click="
              () => {
                dataToAction.data = row;
                dataToAction.show = true;
              }
            "
          >
            <Edit2 class="size-3.5" />
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Duplikasi"
            @click="clone(row)"
          >
            <Copy class="size-3.5" />
          </button>

          <button
            type="button"
            class="inline-flex items-center rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
            title="Hapus"
            @click="destroy(row)"
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

    <CreateAntidetectForm
      v-model:open="showCreateForm"
      :proxies="props.proxies"
      @close="showCreateForm = false"
    />
  </App>
</template>

<style scoped></style>
