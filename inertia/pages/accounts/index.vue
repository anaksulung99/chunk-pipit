<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { cn } from '~/lib/utils'
import { Search, Plus, Trash2, Cookie, RefreshCcw, PenBox, ShieldCheck } from '@lucide/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'
import { Icon } from '@iconify/vue'
import {
  TransitionRoot,
  TransitionChild,
  Dialog as DialogRoot,
  DialogPanel,
  DialogTitle,
  DialogDescription,
} from '@headlessui/vue'
import { toast } from 'vue3-toastify'

type AccountRow = {
  id: string
  label: string
  fbUserId: string | null
  profileUrl: string | null
  sessionStatus: string
  notes: string | null
  cookiesCount: number
  lastUsedAt: string | null
  createdAt: string | null
}

const props = defineProps<{
  accounts: {
    data: AccountRow[]
    stats: {
      total: number
      active: number
      checkpoint: number
      inactive: number
      loggedOut: number
      banned: number
    }
    meta: TableMeta
  }
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

const {
    showProgressModal,
    addProgress,
    check,
} = useFacebookAccount()

const actionUpdate = ref<{
  open: boolean
  data: AccountRow | null
}>({
  open: false,
  data: null,
})

const rows = computed(() => props.accounts.data)
const meta = computed(() => props.accounts.meta)
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
  only: ['accounts'],
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
  { key: 'label', label: 'Label', sortable: true },
  { key: 'fbUserId', label: 'FB User ID' },
  { key: 'session_status', label: 'Status', sortable: true },
  { key: 'cookiesCount', label: 'Cookies' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '', align: 'right' },
]

const STATUS = ['all', 'active', 'checkpoint', 'logged_out', 'banned']
const SETTABLE = ['active', 'checkpoint', 'logged_out', 'banned']

const statusBadge = (s: string) =>
  ({
    active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    checkpoint: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    logged_out: 'bg-muted text-muted-foreground',
    banned: 'bg-red-500/15 text-red-600 dark:text-red-400',
  })[s] ?? 'bg-muted text-muted-foreground'

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const showAdd = ref(false)
const form = useForm({ label: '', fbUserId: '', profileUrl: '', cookiesText: '' })
function submitAdd() {
  form.post('/accounts', {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => {
      form.reset()
      showAdd.value = false
    },
  })
}

function setStatus(id: string, status: string) {
  router.post(
    `/accounts/${id}/status`,
    { status },
    { preserveScroll: true, preserveState: false, onSuccess: () => refresh() }
  )
}
function destroy(id: string) {
  if (!confirm('Hapus akun ini beserta cookies-nya?')) return
  router.delete(`/accounts/${id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => refresh(),
  })
}
function bulk(action: 'delete' | 'set_status', status?: string) {
  if (action === 'delete' && !confirm('Hapus akun terpilih?')) return
  router.post(
    '/accounts/bulk',
    {
      action,
      status,
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
    filters: table.filters,
    order: table.filters.order,
    sort: table.filters.sort,
    startDate: table.filters.startDate,
    endDate: table.filters.endDate,
  }
}

// Refresh accounts
function refresh() {
  router.get('/accounts', buildQuery(), { preserveScroll: true, preserveState: false })
}

function healthCheck(id: string) {
  router.post(`/accounts/${id}/health-check`, {}, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => refresh(),
  })
}

async function bulkCheck(){
  try {
    const result = await check(Array.from(selection.selected.value))
    toast.success(`Check selesai, ${result.total} profile terpilih`)
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
    label: 'Total Account',
    value: props.accounts.stats.total,
    icon: 'material-symbols:account-circle',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Active',
    value: props.accounts.stats.active,
    icon: 'material-symbols:check-circle-outline',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Inactive',
    value: props.accounts.stats.inactive,
    icon: 'lucide:circle-minus',
    color: 'text-rose-600 dark:text-rose-400',
  },
  {
    label: 'Checkpoint',
    value: props.accounts.stats.checkpoint,
    icon: 'lucide:circle-alert',
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Logged Out',
    value: props.accounts.stats.loggedOut,
    icon: 'mdi:location-exit',
    color: 'text-muted text-muted-foreground',
  },
  {
    label: 'Banned',
    value: props.accounts.stats.banned,
    icon: 'lucide:circle-x',
    color: 'text-red-600 dark:text-red-400',
  },
]
</script>

<template>
  <Head title="Accounts" />
  <App
    title="Account Cookies"
    description="Kelola akun Facebook via injeksi session cookies. Nilai cookie dienkripsi di database."
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
          @click="showAdd = !showAdd"
        >
          <Plus class="size-4" /> Tambah Akun
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
      class="space-y-3 rounded-lg border border-border bg-card p-4"
      @submit.prevent="submitAdd"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <input
          v-model="form.label"
          placeholder="Label akun *"
          class="rounded-md border border-input bg-background px-2 py-2 text-sm"
        />
        <input
          v-model="form.fbUserId"
          placeholder="FB User ID (opsional, auto dari c_user)"
          class="rounded-md border border-input bg-background px-2 py-2 text-sm"
        />
        <input
          v-model="form.profileUrl"
          placeholder="URL profil (opsional)"
          class="rounded-md border border-input bg-background px-2 py-2 text-sm"
        />
      </div>
      <textarea
        v-model="form.cookiesText"
        rows="5"
        placeholder='Paste cookies JSON (EditThisCookie / Cookie-Editor): [{"name":"c_user","value":"...","domain":".facebook.com",...}]'
        class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
      />
      <div class="flex items-center gap-2">
        <button
          type="submit"
          :disabled="form.processing"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Simpan
        </button>
        <button
          type="button"
          :disabled="form.processing"
          class="rounded-md bg-destructive text-white px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          @click="showAdd = false"
        >
          Batal
        </button>
        <span
          v-if="form.errors.label || form.errors.cookiesText"
          class="text-xs text-red-500"
        >
          {{ form.errors.label || form.errors.cookiesText }}
        </span>
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
          placeholder="Cari label / FB ID…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-1">
        <div class="flex items-center gap-2">
          <DateRangePicker v-model="rangeDate" />
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
            {{ s === "all" ? "Semua" : s.replace("_", " ") }}
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
        class="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
        @click="bulk('set_status', 'checkpoint')"
      >
        Tandai checkpoint
      </button>
      <button
        type="button"
        class="rounded-md border border-emerald-500/40 px-2.5 py-1 text-sm text-emerald-500 hover:bg-emerald-500/10"
        @click="bulkCheck"
      >
        Check
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
      empty-text="Belum ada akun. Klik Tambah Akun untuk paste cookies."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-label="{ row }">
        <Link :href="`/accounts/${row.id}`">
          <div class="font-medium hover:underline">{{ row.label }}</div>
        </Link>
        <a
          v-if="row.profileUrl"
          :href="row.profileUrl"
          target="_blank"
          rel="noopener"
          class="text-xs text-muted-foreground hover:underline"
        >
          profil ↗
        </a>
      </template>
      <template #cell-fbUserId="{ row }">
        <span class="font-mono text-xs">{{ row.fbUserId || "—" }}</span>
      </template>
      <template #cell-session_status="{ row }">
        <span
          :class="
            cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              statusBadge(row.sessionStatus)
            )
          "
        >
          {{ row.sessionStatus.replace("_", " ") }}
        </span>
      </template>
      <template #cell-cookiesCount="{ row }">
        <span class="inline-flex items-center gap-1 text-xs">
          <Cookie class="size-3.5 text-muted-foreground" /> {{ row.cookiesCount }}
        </span>
      </template>
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-muted-foreground">{{ fmtDate(row.createdAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <select
            class="rounded-md border border-input bg-background px-1.5 py-1 text-xs"
            :value="row.sessionStatus"
            @change="setStatus(row.id, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="s in SETTABLE" :key="s" :value="s">
              {{ s.replace("_", " ") }}
            </option>
          </select>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-blue-500/40 px-2 py-1 text-xs text-blue-500 hover:bg-blue-500/10"
            title="Update"
            @click="
              () => {
                actionUpdate.open = true;
                actionUpdate.data = row;
              }
            "
          >
            <PenBox class="size-3.5" />
          </button>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-cyan-500/40 px-2 py-1 text-xs text-cyan-500 hover:bg-cyan-500/10"
            title="Check Status"
            @click="healthCheck(row.id)"
          >
            <ShieldCheck class="size-3.5" />
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

    <UpdateAccountFacebook
      v-model:open="actionUpdate.open"
      :data="actionUpdate.data"
      @close="
        () => {
          actionUpdate.open = false;
          actionUpdate.data = null;
        }
      "
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
                  Sedang mengecek profile {{ selection.count.value }} terpilih.
                </DialogDescription>

                <div class="mt-6 space-y-4">
                  <div class="flex items-center gap-3">
                    <Spinner class="animate-spin" />
                    <h3 class="font-semibold">Validating Accounts</h3>
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
                        {{ addProgress.active }}
                      </div>
                      <div class="text-xs text-muted-foreground">Active</div>
                    </div>
                    <div class="rounded-lg bg-amber-600/10 p-2">
                      <div class="font-bold text-amber-600">
                        {{ addProgress.checkpoint }}
                      </div>
                      <div class="text-xs text-muted-foreground">Checkpoint</div>
                    </div>
                    <div class="rounded-lg bg-muted p-2">
                      <div class="font-bold text-muted-foreground">
                        {{ addProgress.logged_out }}
                      </div>
                      <div class="text-xs text-muted-foreground">Logged Out</div>
                    </div>
                    <div class="rounded-lg bg-red-600/10 p-2">
                      <div class="font-bold text-red-600">
                        {{ addProgress.failed }}
                      </div>
                      <div class="text-xs text-muted-foreground">Failed</div>
                    </div>
                  </div>
                  <div class="text-sm text-muted-foreground">
                    Validating: {{ addProgress.currentProfileId || "Starting..." }}
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
