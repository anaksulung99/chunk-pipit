<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router, useForm } from '@inertiajs/vue3'
import { cn } from '~/lib/utils'
import { Search, Plus, Upload, RotateCw, Trash2, XIcon, RefreshCcw } from '@lucide/vue'
import { Icon } from '@iconify/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'
import {
  TransitionRoot,
  TransitionChild,
  Dialog as DialogRoot,
  DialogPanel,
  DialogTitle,
  DialogDescription,
} from '@headlessui/vue'
import { toast } from 'vue3-toastify'

type ProxyRow = {
  id: string
  protocol: string
  host: string
  port: number
  username: string | null
  status: string
  responseMs: number | null
  lastCheckedAt: string | null
  createdAt: string | null
}

const props = defineProps<{
  proxies: {
    data: ProxyRow[]
    stats: {
      total: number
      http: number
      https: number
      socks4: number
      socks5: number
      healthy: number
      unchecked: number
      slow: number
      dead: number
    }
    meta: TableMeta
  }
  filters: {
    search: string
    status: string
    protocol: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
}>()

const {
    showProgressModal,
    addProgress,
    check,
} = useProxyHealthCheck()

const rows = computed(() => props.proxies.data)
const meta = computed(() => props.proxies.meta)
const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const completedProgressRef = ref(null)
const validateProgressValue = computed(
  () => (addProgress.current / addProgress.total) * 100 || 0
);

const table = useDataTable({
  only: ['proxies'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      status: props.filters.status,
      protocol: props.filters.protocol,
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
  { key: 'host', label: 'Proxy', sortable: true },
  { key: 'protocol', label: 'Protokol' },
  { key: 'username', label: 'Auth' },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'response_ms', label: 'Latency', sortable: true },
  { key: 'lastCheckedAt', label: 'Dicek' },
  { key: 'actions', label: '', align: 'right' },
]

const STATUS = ['all', 'unchecked', 'healthy', 'slow', 'dead']
const PROTOCOLS = ['all', 'http', 'https', 'socks4', 'socks5']

const statusBadge = (s: string) =>
  ({
    healthy: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    slow: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dead: 'bg-red-500/15 text-red-600 dark:text-red-400',
    unchecked: 'bg-muted text-muted-foreground',
  })[s] ?? 'bg-muted text-muted-foreground'

// Add / Import panels
const showAdd = ref(false)
const showImport = ref(false)
const addForm = useForm({ protocol: 'http', host: '', port: 8080, username: '', password: '' })
const importForm = useForm({ text: '' })

function submitAdd() {
  addForm.post('/proxies', {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => {
      addForm.reset()
      showAdd.value = false
      refresh()
    },
  })
}
function submitImport() {
  importForm.post('/proxies/import', {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => {
      importForm.reset()
      showImport.value = false
      refresh()
    },
  })
}

// Row actions
function healthCheck(id: string) {
  router.post(
    `/proxies/${id}/health-check`,
    {},
    { preserveScroll: true, preserveState: false, onSuccess: () => refresh() }
  )
}
function destroy(id: string) {
  if (!confirm('Hapus proxy ini?')) return
  router.delete(`/proxies/${id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => router.reload(),
  })
}

// Bulk
function bulk(action: 'delete' | 'health_check') {
  if (action === 'delete' && !confirm('Hapus proxy terpilih?')) return
  router.post(
    '/proxies/bulk',
    {
      action,
      ...selection.payload(),
      filters: {
        search: table.search.value,
        status: table.filters.status,
        protocol: table.filters.protocol,
      },
    },
    {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => {
        selection.clear()
        router.reload()
      },
    }
  )
}

function buildQuery(page: number = meta.value.currentPage) {
  return {
    page,
    per_page: table.perPage.value,
    search: table.search.value,
    status: table.filters.status,
    protocol: table.filters.protocol,
    order: table.filters.order,
    sort: table.filters.sort,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
  }
}

// Refresh proxies
function refresh() {
  buildQuery()
  router.reload()
}

async function bulkCheck(){
  try {
    const result = await check(Array.from(selection.selected.value))
    toast.success(`Check selesai, ${result.total} proxy terpilih, ${result.healthy} healthy, ${result.slow} slow, ${result.dead} dead, ${result.failed} failed`)
  } catch(error){
    toast.error(error instanceof Error ? error.message : 'Error')
  } finally {
    showProgressModal.value = false
    selection.clear()
    refresh()
  }
}


const statsCard = [
  {
    label: 'Total Proxy',
    value: props.proxies.stats.total,
    icon: 'material-symbols-light:vpn-lock',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'HTTP',
    value: props.proxies.stats.http,
    icon: 'material-symbols-light:vpn-lock',
    color: 'text-sky-600 dark:text-sky-400',
  },
  {
    label: 'HTTPS',
    value: props.proxies.stats.https,
    icon: 'material-symbols-light:vpn-lock',
    color: 'text-cyan-600 dark:text-cyan-400',
  },
  {
    label: 'SOCKS4',
    value: props.proxies.stats.socks4,
    icon: 'material-symbols-light:vpn-lock',
    color: 'text-fuchsia-600 dark:text-fuchsia-400',
  },
  {
    label: 'SOCKS5',
    value: props.proxies.stats.socks5,
    icon: 'material-symbols-light:vpn-lock',
    color: 'text-muted text-muted-foreground',
  },
  {
    label: 'Healthy',
    value: props.proxies.stats.healthy,
    icon: 'stash:chart-trend-up-duotone',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Unchecked',
    value: props.proxies.stats.unchecked,
    icon: 'ph:minus-circle',
    color: 'text-muted-foreground',
  },
  {
    label: 'Slow',
    value: props.proxies.stats.slow,
    icon: 'stash:chart-trend-down-duotone',
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Dead',
    value: props.proxies.stats.dead,
    icon: 'material-symbols:block-outline',
    color: 'text-red-600 dark:text-red-400',
  },
]
</script>

<template>
  <Head title="Proxies" />
  <App title="Proxies Management" description="Kelola pool proxy & cek kesehatannya.">
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <button
          type="button"
          :class="
            cn(
              'inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm ',
              showImport
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-blue-600 dark:bg-blue-500 text-white'
            )
          "
          @click="(showImport = !showImport), (showAdd = false)"
        >
          <Upload v-if="!showImport" class="size-4" />
          <XIcon v-else class="size-4" />
          {{ showImport ? "Batal" : "Import" }}
        </button>
        <button
          type="button"
          :class="
            cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium',
              showAdd
                ? 'bg-destructive text-white hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )
          "
          @click="(showAdd = !showAdd), (showImport = false)"
        >
          <Plus v-if="!showAdd" class="size-4" />
          <XIcon v-else class="size-4" />
          {{ showAdd ? "Batal" : "Tambah" }}
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

    <!-- Add panel -->
    <form
      v-if="showAdd"
      class="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-6"
      @submit.prevent="submitAdd"
    >
      <select
        v-model="addForm.protocol"
        class="rounded-md border border-input bg-background px-2 py-2 text-sm"
      >
        <option v-for="p in PROTOCOLS.slice(1)" :key="p" :value="p">{{ p }}</option>
      </select>
      <input
        v-model="addForm.host"
        placeholder="host / ip"
        class="col-span-2 rounded-md border border-input bg-background px-2 py-2 text-sm"
      />
      <input
        v-model.number="addForm.port"
        type="number"
        placeholder="port"
        class="rounded-md border border-input bg-background px-2 py-2 text-sm"
      />
      <input
        v-model="addForm.username"
        placeholder="user (opsional)"
        class="rounded-md border border-input bg-background px-2 py-2 text-sm"
      />
      <input
        v-model="addForm.password"
        placeholder="pass (opsional)"
        class="rounded-md border border-input bg-background px-2 py-2 text-sm"
      />
      <div class="col-span-2 flex items-center gap-2 sm:col-span-6">
        <button
          type="submit"
          :disabled="addForm.processing"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Simpan
        </button>
        <span
          v-if="addForm.errors.host || addForm.errors.port"
          class="text-xs text-red-500"
          >{{ addForm.errors.host || addForm.errors.port }}</span
        >
      </div>
    </form>

    <!-- Import panel -->

    <form
      v-if="showImport"
      class="space-y-2 rounded-lg border border-border bg-card p-4"
      @submit.prevent="submitImport"
    >
      <textarea
        v-model="importForm.text"
        rows="4"
        placeholder="Satu proxy per baris: proto://user:pass@host:port atau host:port"
        class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
      />
      <button
        type="submit"
        :disabled="importForm.processing"
        class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        Import
      </button>
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
          placeholder="Cari host / user…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker v-model="rangeDate" />
        <div class="flex flex-wrap items-center gap-1">
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
          <select
            class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            :value="table.filters.protocol"
            @change="table.setFilter('protocol', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="p in PROTOCOLS" :key="p" :value="p">
              {{ p === "all" ? "Semua protokol" : p }}
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
        @click="bulkCheck"
      >
        Health check
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
      empty-text="Belum ada proxy."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-host="{ row }">
        <span class="font-mono text-xs">{{ row.host }}:{{ row.port }}</span>
      </template>
      <template #cell-protocol="{ row }">
        <span class="uppercase text-xs">{{ row.protocol }}</span>
      </template>
      <template #cell-username="{ row }">
        <span :class="row.username ? '' : 'text-muted-foreground'">{{
          row.username || "—"
        }}</span>
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
      <template #cell-response_ms="{ row }">
        {{ row.responseMs !== null ? `${row.responseMs}ms` : "—" }}
      </template>
      <template #cell-lastCheckedAt="{ row }">
        <span class="text-xs text-muted-foreground">{{
          fmtDateTime(row.lastCheckedAt)
        }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Health check"
            @click="healthCheck(row.id)"
          >
            <RotateCw class="size-3.5" />
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-1 rounded-md border border-red-500/40 px-2 py-1 text-xs text-red-500 hover:bg-red-500/10"
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

    <TransitionRoot appear :show="showProgressModal" as="template">
      <DialogRoot
        as="div"
        :initial-focus="completedProgressRef"
        class="relative z-50"
        @close="showProgressModal = false"
      >
        <TransitionChild
          as="template"
          enter="duration-300 ease-out"
          enter-from="opacity-0"
          enter-to="opacity-100"
          leave="duration-200 ease-in"
          leave-from="opacity-100"
          leave-to="opacity-0"
        >
          <div class="fixed inset-0 bg-black/25" />
        </TransitionChild>

        <div class="fixed inset-0 overflow-y-auto">
          <div class="flex min-h-full items-center justify-center p-4 text-center">
            <TransitionChild
              as="template"
              enter="duration-300 ease-out"
              enter-from="opacity-0 scale-95"
              enter-to="opacity-100 scale-100"
              leave="duration-200 ease-in"
              leave-from="opacity-100 scale-100"
              leave-to="opacity-0 scale-95"
            >
              <DialogPanel
                class="w-full max-w-md transform overflow-hidden rounded-2xl bg-card p-6 text-left align-middle shadow-xl transition-all"
              >
                <DialogTitle
                  as="h3"
                  class="text-lg font-medium leading-6 text-foreground"
                >
                  Check Progress
                </DialogTitle>
                <DialogDescription class="mt-2 text-sm text-muted-foreground">
                  Sedang mengecek proxy {{ selection.count.value }} terpilih.
                </DialogDescription>

                <div class="mt-6 space-y-4">
                  <div class="flex items-center gap-3">
                    <Spinner class="animate-spin" />
                    <h3 class="font-semibold">Validating Proxies Health</h3>
                  </div>
                  <div class="space-y-2">
                    <div class="flex justify-between text-sm">
                      <span>Progress</span>
                      <span> {{ addProgress.current }}/{{ addProgress.total }} </span>
                    </div>
                    <div class="h-2 w-full rounded-full bg-background">
                      <div
                        class="h-2 rounded-full bg-emerald-600"
                        :style="{ width: validateProgressValue + '%' }"
                      ></div>
                    </div>
                  </div>
                  <div class="grid grid-cols-4 gap-3 text-center">
                    <div class="rounded-lg bg-green-600/10 p-2">
                      <div class="font-bold text-green-600">
                        {{ addProgress.healthy }}
                      </div>
                      <div class="text-xs text-muted-foreground">Healthy</div>
                    </div>
                    <div class="rounded-lg bg-amber-600/10 p-2">
                      <div class="font-bold text-amber-600">
                        {{ addProgress.slow }}
                      </div>
                      <div class="text-xs text-muted-foreground">Slow</div>
                    </div>
                    <div class="rounded-lg bg-muted p-2">
                      <div class="font-bold text-muted-foreground">
                        {{ addProgress.dead }}
                      </div>
                      <div class="text-xs text-muted-foreground">Dead</div>
                    </div>
                    <div class="rounded-lg bg-red-600/10 p-2">
                      <div class="font-bold text-red-600">
                        {{ addProgress.failed }}
                      </div>
                      <div class="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                  <div class="text-sm text-muted-foreground">
                    Validating: {{ addProgress.currentProxyId || "Starting..." }}
                  </div>
                </div>

                <button ref="completedProgressRef" class="sr-only">Close</button>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </DialogRoot>
    </TransitionRoot>
  </App>
</template>
