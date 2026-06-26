<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router, useForm } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { cn } from '~/lib/utils'
import { Search, Upload, Download, Trash2, Tag, RefreshCcw } from '@lucide/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'
import { Icon } from '@iconify/vue'

type GroupRow = {
  id: string
  groupId: string
  groupName: string | null
  groupUrl: string | null
  groupType: string
  memberCount: number | null
  sourceType: string
  sourceKeyword: string | null
  tags: string[]
  createdAt: string | null
}

const props = defineProps<{
  groups: {
    data: GroupRow[]
    stats: {
      totalGroup: number
      publicGroup: number
      privateGroup: number
    }
    meta: TableMeta
  }
  filters: {
    search: string
    type: string
    source: string
    groupTag: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
    startDate: string
    endDate: string
  }
  groupTagOptions: string[]
}>()

const rows = computed(() => props.groups.data)
const meta = computed(() => props.groups.meta)
const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
)

const table = useDataTable({
  only: ['groups'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      type: props.filters.type,
      source: props.filters.source,
      groupTag: props.filters.groupTag,
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
const bulkTagsText = ref('')

const columns: DataTableColumn[] = [
  { key: 'group_id', label: 'Group', sortable: true },
  { key: 'group_type', label: 'Tipe', sortable: true },
  { key: 'member_count', label: 'Member', sortable: true },
  { key: 'sourceType', label: 'Sumber' },
  { key: 'tags', label: 'Tags' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '', align: 'right' },
]

const TYPES = ['all', 'public', 'private']
const SOURCES = ['all', 'keyword', 'friend_list', 'manual']

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const showImport = ref(false)
const importForm = useForm({ text: '', groupType: 'public', tagsText: '' })
function submitImport() {
  importForm.post('/groups/import', {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => {
      importForm.reset()
      showImport.value = false
      refresh()
    },
  })
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

// Refresh groups
function refresh() {
  router.get('/groups', buildQuery(), { preserveScroll: true, preserveState: false })
}

function setType(id: string, groupType: string) {
  router.post(
    `/groups/${id}/type`,
    { groupType },
    { preserveScroll: true, preserveState: false, onSuccess: () => refresh() }
  )
}
function destroy(id: string) {
  if (!confirm('Hapus group ini?')) return
  router.delete(`/groups/${id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => refresh(),
  })
}

function bulk(
  action: 'delete' | 'set_type' | 'add_tags' | 'set_tags' | 'remove_tags' | 'clear_tags',
  extra: Record<string, string> = {}
) {
  if (action === 'delete' && !confirm('Hapus group terpilih?')) return
  if (action === 'clear_tags' && !confirm('Kosongkan semua label kelompok untuk group terpilih?')) {
    return
  }
  router.post(
    '/groups/bulk',
    {
      action,
      ...extra,
      ...selection.payload(),
      filters: {
        search: table.search.value,
        type: table.filters.type,
        source: table.filters.source,
        groupTag: table.filters.groupTag,
      },
    },
    {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => {
        selection.clear()
        refresh()
        if (action !== 'delete' && action !== 'set_type') bulkTagsText.value = ''
      },
    }
  )
}
function bulkTags(action: 'add_tags' | 'set_tags' | 'remove_tags') {
  if (!bulkTagsText.value.trim()) return
  bulk(action, { tagsText: bulkTagsText.value.trim() })
}
function appendTag(tag: string) {
  const current = bulkTagsText.value
    .split(/[,\n|]/)
    .map((value) => value.trim())
    .filter(Boolean)
  if (current.includes(tag)) return
  bulkTagsText.value = [...current, tag].join(', ')
}

function exportCsv() {
  const params = new URLSearchParams({
    search: table.search.value,
    type: table.filters.type,
    source: table.filters.source,
    groupTag: table.filters.groupTag,
  })
  window.location.href = `/groups/export?${params.toString()}`
}

const statsCard = [
  {
    label: 'Total Group',
    value: props.groups.stats.totalGroup,
    icon: 'material-symbols:groups',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Public Group',
    value: props.groups.stats.publicGroup,
    icon: 'material-symbols:public',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Private Group',
    value: props.groups.stats.privateGroup,
    icon: 'material-symbols:lock',
    color: 'text-violet-600 dark:text-violet-400',
  },
]
</script>

<template>
  <Head title="Groups" />
  <App
    title="Group Management"
    description="Kelola daftar Facebook group target (hasil scrape / import manual)."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm bg-blue-600 dark:bg-blue-500 text-white"
          @click="exportCsv"
        >
          <Download class="size-4" /> Export
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          @click="showImport = !showImport"
        >
          <Upload class="size-4" /> Import
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

    <!-- Import panel -->
    <form
      v-if="showImport"
      class="space-y-3 rounded-lg border border-border bg-card p-4"
      @submit.prevent="submitImport"
    >
      <textarea
        v-model="importForm.text"
        rows="4"
        placeholder="Satu group per baris: URL (…/groups/123), ID, atau id|nama"
        class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
      />
      <div class="flex flex-wrap items-center gap-3">
        <select
          v-model="importForm.groupType"
          class="rounded-md border border-input bg-background px-2 py-2 text-sm"
        >
          <option value="public">public</option>
          <option value="private">private</option>
        </select>
        <input
          v-model="importForm.tagsText"
          placeholder="tags (pisah koma, opsional)"
          class="flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm"
        />
        <button
          type="submit"
          :disabled="importForm.processing"
          class="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          Import
        </button>
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
          placeholder="Cari ID / nama group…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DateRangePicker v-model="rangeDate" />
        <div class="flex items-center gap-1">
          <button
            v-for="t in TYPES"
            :key="t"
            type="button"
            :class="
              cn(
                'rounded-md border px-2 py-1.5 text-xs font-medium capitalize',
                table.filters.type === t
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-muted'
              )
            "
            @click="table.setFilter('type', t)"
          >
            {{ t === "all" ? "Semua" : t }}
          </button>
        </div>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.source"
          @change="table.setFilter('source', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="s in SOURCES" :key="s" :value="s">
            {{ s === "all" ? "Semua sumber" : s.replace("_", " ") }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.groupTag"
          @change="table.setFilter('groupTag', ($event.target as HTMLSelectElement).value)"
        >
          <option value="all">Semua label</option>
          <option value="__untagged__">Tanpa label</option>
          <option v-for="tag in props.groupTagOptions" :key="tag" :value="tag">
            {{ tag }}
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
      <div class="flex flex-wrap items-center gap-2">
        <div
          class="flex min-w-70 items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5"
        >
          <Tag class="size-3.5 text-muted-foreground" />
          <input
            v-model="bulkTagsText"
            type="text"
            placeholder="label kelompok, pisah koma"
            class="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
          @click="bulkTags('add_tags')"
        >
          Tambah label
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
          @click="bulkTags('set_tags')"
        >
          Ganti label
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
          @click="bulkTags('remove_tags')"
        >
          Hapus label
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1 rounded-md border border-amber-500/40 px-2.5 py-1 text-sm text-amber-700 hover:bg-amber-500/10 dark:text-amber-300"
          @click="bulk('clear_tags')"
        >
          Kosongkan label
        </button>
      </div>
      <button
        type="button"
        class="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
        @click="bulk('set_type', { groupType: 'private' })"
      >
        Set private
      </button>
      <button
        type="button"
        class="rounded-md border border-border px-2.5 py-1 text-sm hover:bg-muted"
        @click="bulk('set_type', { groupType: 'public' })"
      >
        Set public
      </button>
      <button
        type="button"
        class="rounded-md border border-red-500/40 px-2.5 py-1 text-sm text-red-500 hover:bg-red-500/10"
        @click="bulk('delete')"
      >
        Hapus
      </button>
      <div
        v-if="props.groupTagOptions.length"
        class="flex w-full flex-wrap items-center gap-1 pt-1"
      >
        <span class="text-xs text-muted-foreground">Label cepat:</span>
        <button
          v-for="tag in props.groupTagOptions"
          :key="tag"
          type="button"
          class="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
          @click="appendTag(tag)"
        >
          {{ tag }}
        </button>
      </div>
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
      empty-text="Belum ada group. Import untuk menambah."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-group_id="{ row }">
        <Link
          :href="`/groups/${row.id}`"
          class="font-medium text-primary hover:underline"
        >
          {{ row.groupName || row.groupId }}
        </Link>
        <a
          v-if="row.groupUrl"
          :href="row.groupUrl"
          target="_blank"
          rel="noopener"
          class="font-mono text-xs text-muted-foreground hover:underline"
        >
          {{ row.groupId }} ↗
        </a>
        <span v-else class="font-mono text-xs text-muted-foreground">{{
          row.groupId
        }}</span>
      </template>
      <template #cell-group_type="{ row }">
        <span
          :class="
            cn(
              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
              row.groupType === 'private'
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            )
          "
        >
          {{ row.groupType }}
        </span>
      </template>
      <template #cell-member_count="{ row }">
        <span class="text-xs">{{
          row.memberCount != null ? row.memberCount.toLocaleString("id-ID") : "—"
        }}</span>
      </template>
      <template #cell-sourceType="{ row }">
        <span class="text-xs capitalize">{{ row.sourceType.replace("_", " ") }}</span>
        <span v-if="row.sourceKeyword" class="text-xs text-muted-foreground">
          · {{ row.sourceKeyword }}</span
        >
      </template>
      <template #cell-tags="{ row }">
        <div class="flex flex-wrap gap-1">
          <span
            v-for="t in row.tags"
            :key="t"
            class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {{ t }}
          </span>
          <span v-if="!row.tags.length" class="text-xs text-muted-foreground">—</span>
        </div>
      </template>
      <template #cell-createdAt="{ row }">
        <span class="text-xs text-muted-foreground">{{ fmtDate(row.createdAt) }}</span>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <select
            class="rounded-md border border-input bg-background px-1.5 py-1 text-xs"
            :value="row.groupType"
            @change="setType(row.id, ($event.target as HTMLSelectElement).value)"
          >
            <option value="public">public</option>
            <option value="private">private</option>
          </select>
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
