<script setup lang="ts">
import { computed, ref } from 'vue'
import { Head, router } from '@inertiajs/vue3'
import { Link } from '@adonisjs/inertia/vue'
import { cn } from '~/lib/utils'
import { Search, Tag, RefreshCcw, Trash2, Users, Upload } from '@lucide/vue'
import DataTable, { type DataTableColumn } from '~/components/ui/DataTable.vue'
import Pagination from '~/components/ui/Pagination.vue'
import BulkActionBar from '~/components/ui/BulkActionBar.vue'
import { useDataTable, type TableMeta } from '~/composables/useDataTable'
import { useTableSelection } from '~/composables/useTableSelection'
import { Icon } from '@iconify/vue'

type ProfileRow = {
  id: string
  profileId: string
  profileName: string | null
  profileUrl: string | null
  friendCount: number | null
  mutualFriendCount: number | null
  followerCount: number | null
  followingCount: number | null
  sourceType: string
  sourceUrl: string | null
  lifecycleStatus: string
  relationshipStatus: string
  lastAction: string | null
  lastActionStatus: string | null
  lastActionMessage: string | null
  lastActionAt: string | null
  tags: string[]
  createdAt: string | null
}

const props = defineProps<{
  profiles: {
    data: ProfileRow[]
    stats: {
      totalProfile: number
      qualifiedProfile: number
      taggedProfile: number
      groupMemberProfile: number
      freshProfile: number
      requestedProfile: number
      connectedProfile: number
      invitedProfile: number
      failedProfile: number
      outgoingRequestProfile: number
      incomingRequestProfile: number
      friendRelationshipProfile: number
    }
    meta: TableMeta
  }
  filters: {
    search: string
    source: string
    profileTag: string
    sort: string
    order: 'asc' | 'desc'
    perPage: number
  }
  profileTagOptions: string[]
}>()



const rows = computed(() => props.profiles.data)
const meta = computed(() => props.profiles.meta)
const selection = useTableSelection(rows)
const bulkTagsText = ref('')
const importFile = ref<File | null>(null)
const importSourceType = ref('friend')
const importTagsText = ref('')
const importing = ref(false)

const table = useDataTable({
  only: ['profiles'],
  initial: {
    search: props.filters.search,
    sort: props.filters.sort,
    order: props.filters.order,
    perPage: props.filters.perPage,
    filters: {
      source: props.filters.source,
      profileTag: props.filters.profileTag,
    },
  },
})

const columns: DataTableColumn[] = [
  { key: 'profile_id', label: 'Profile', sortable: true },
  { key: 'friend_count', label: 'Friend', sortable: true },
  { key: 'lifecycleStatus', label: 'Lifecycle', sortable: true },
  { key: 'sourceType', label: 'Sumber', sortable: true },
  { key: 'tags', label: 'Tags' },
  { key: 'createdAt', label: 'Dibuat' },
  { key: 'actions', label: '', align: 'right' },
]

const SOURCES = ['all', 'group_member', 'page_profile_follower', 'friend', 'engagement_post']

function fmtDate(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function lifecycleBadge(status: string) {
  return (
    {
      fresh: 'bg-muted text-muted-foreground',
      friend_requested: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      friend_connected: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      invited: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
      failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
    }[status] ?? 'bg-muted text-muted-foreground'
  )
}

function actionStatusBadge(status: string | null) {
  return (
    {
      success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
      skipped: 'bg-muted text-muted-foreground',
      checkpoint: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    }[status ?? ''] ?? 'bg-muted text-muted-foreground'
  )
}

function relationshipBadge(status: string) {
  return (
    {
      friend: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      outgoing_request: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
      incoming_request: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
      unknown: 'bg-muted text-muted-foreground',
    }[status] ?? 'bg-muted text-muted-foreground'
  )
}

function fmtDateTime(value: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
  }
}

function refresh() {
  router.get('/profiles', buildQuery(), { preserveScroll: true, preserveState: false })
}

function destroy(id: string) {
  if (!confirm('Hapus profile ini?')) return
  bulk('delete', { ids: [id], mode: 'ids' })
}

function bulk(
  action: 'delete' | 'add_tags' | 'set_tags' | 'remove_tags' | 'clear_tags',
  override: Record<string, unknown> = {}
) {
  if (action === 'delete' && !confirm('Hapus profile terpilih?')) return
  if (action === 'clear_tags' && !confirm('Kosongkan semua label profile terpilih?')) return

  router.post(
    '/profiles/bulk',
    {
      action,
      ...selection.payload(),
      ...override,
      filters: {
        search: table.search.value,
        source: table.filters.source,
        profileTag: table.filters.profileTag,
      },
    },
    {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => {
        selection.clear()
        refresh()
        if (action !== 'delete') bulkTagsText.value = ''
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

function bulkImport() {
  if (!importFile.value) {
    alert('Pilih file CSV terlebih dahulu.')
    return
  }

  const form = new FormData()
  form.append('file', importFile.value)
  form.append('sourceType', importSourceType.value)
  if (importTagsText.value.trim()) form.append('tagsText', importTagsText.value.trim())

  router.post('/profiles/import', form, {
    forceFormData: true,
    preserveScroll: true,
    preserveState: false,
    onStart: () => {
      importing.value = true
    },
    onFinish: () => {
      importing.value = false
    },
    onSuccess: () => {
      importFile.value = null
      importTagsText.value = ''
      refresh()
    },
  })
}


const statsCard = [
  {
    label: 'Total Profile',
    value: props.profiles.stats.totalProfile,
    icon: 'material-symbols:person-search',
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Qualified',
    value: props.profiles.stats.qualifiedProfile,
    icon: 'material-symbols:verified-user-outline',
    color: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Tagged',
    value: props.profiles.stats.taggedProfile,
    icon: 'material-symbols:label-outline',
    color: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Group Member',
    value: props.profiles.stats.groupMemberProfile,
    icon: 'material-symbols:groups',
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Invited',
    value: props.profiles.stats.invitedProfile,
    icon: 'material-symbols:outgoing-mail-outline',
    color: 'text-violet-600 dark:text-violet-400',
  },
]

const lifecycleFunnelCard = [
  {
    label: 'Fresh',
    value: props.profiles.stats.freshProfile,
    tone: 'text-muted-foreground',
  },
  {
    label: 'Requested',
    value: props.profiles.stats.requestedProfile,
    tone: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Connected',
    value: props.profiles.stats.connectedProfile,
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    label: 'Invited',
    value: props.profiles.stats.invitedProfile,
    tone: 'text-violet-600 dark:text-violet-400',
  },
  {
    label: 'Failed',
    value: props.profiles.stats.failedProfile,
    tone: 'text-red-600 dark:text-red-400',
  },
]

const relationshipCard = [
  {
    label: 'Outgoing Request',
    value: props.profiles.stats.outgoingRequestProfile,
    tone: 'text-blue-600 dark:text-blue-400',
  },
  {
    label: 'Incoming Request',
    value: props.profiles.stats.incomingRequestProfile,
    tone: 'text-amber-600 dark:text-amber-400',
  },
  {
    label: 'Friend',
    value: props.profiles.stats.friendRelationshipProfile,
    tone: 'text-emerald-600 dark:text-emerald-400',
  },
]
</script>

<template>
  <Head title="Profiles" />
  <App
    title="Profile Pool"
    description="Kelola profile hasil scrape agar siap dipakai untuk flow add friend dan invite."
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <label
          class="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Upload class="size-4" />
          <span>{{ importFile ? importFile.name : "Pilih CSV" }}</span>
          <input
            type="file"
            accept=".csv,text/csv"
            class="hidden"
            @change="importFile = ($event.target as HTMLInputElement).files?.[0] ?? null"
          />
        </label>
        <select
          v-model="importSourceType"
          class="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option
            v-for="source in SOURCES.filter((source) => source !== 'all')"
            :key="source"
            :value="source"
          >
            {{ source.replaceAll("_", " ") }}
          </option>
        </select>
        <input
          v-model="importTagsText"
          type="text"
          placeholder="default tags, pisah koma"
          class="w-44 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
        />
        <Button
          variant="default"
          size="sm"
          :disabled="importing || !importFile"
          @click="bulkImport"
        >
          <Upload class="size-4" />
          {{ importing ? "Importing..." : "Import CSV" }}
        </Button>
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" />
          Refresh
        </Button>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-4 shadow-md">
      <div
        v-for="card in statsCard"
        :key="card.label"
        class="rounded-lg border border-border bg-background p-4"
      >
        <span class="text-xs text-muted-foreground">{{ card.label }}</span>
        <div class="flex items-center justify-between">
          <Icon :icon="card.icon" :class="cn('size-6', card.color)" />
          <div class="mt-1 text-2xl font-semibold">{{ card.value }}</div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
      <div class="rounded-lg border border-border bg-background p-4">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-sm font-medium">Funnel Lifecycle Profile</h3>
            <p class="text-xs text-muted-foreground">
              Ringkasan rantai dari pool mentah sampai siap dipakai untuk invite.
            </p>
          </div>
          <div class="text-xs text-muted-foreground">
            `add_friend -> confirm -> invite -> recycle`
          </div>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div
            v-for="card in lifecycleFunnelCard"
            :key="card.label"
            class="rounded-md border border-border bg-card px-3 py-2"
          >
            <div class="text-[11px] text-muted-foreground">{{ card.label }}</div>
            <div :class="cn('mt-1 text-xl font-semibold', card.tone)">{{ card.value }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-background p-4">
        <div>
          <h3 class="text-sm font-medium">Relationship Snapshot</h3>
          <p class="text-xs text-muted-foreground">
            Membaca cepat status hubungan aktual profile yang tersimpan di pool.
          </p>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-3">
          <div
            v-for="card in relationshipCard"
            :key="card.label"
            class="rounded-md border border-border bg-card px-3 py-2"
          >
            <div class="text-[11px] text-muted-foreground">{{ card.label }}</div>
            <div :class="cn('mt-1 text-xl font-semibold', card.tone)">{{ card.value }}</div>
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
          placeholder="Cari profile ID / nama / URL…"
          class="w-full rounded-md border border-input bg-background py-2 pr-3 pl-8 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.source"
          @change="table.setFilter('source', ($event.target as HTMLSelectElement).value)"
        >
          <option v-for="source in SOURCES" :key="source" :value="source">
            {{ source === "all" ? "Semua sumber" : source.replaceAll("_", " ") }}
          </option>
        </select>
        <select
          class="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
          :value="table.filters.profileTag"
          @change="table.setFilter('profileTag', ($event.target as HTMLSelectElement).value)"
        >
          <option value="all">Semua label</option>
          <option value="__untagged__">Tanpa label</option>
          <option v-for="tag in props.profileTagOptions" :key="tag" :value="tag">
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
            placeholder="label profile, pisah koma"
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
        class="rounded-md border border-red-500/40 px-2.5 py-1 text-sm text-red-500 hover:bg-red-500/10"
        @click="bulk('delete')"
      >
        Hapus
      </button>
      <div
        v-if="props.profileTagOptions.length"
        class="flex w-full flex-wrap items-center gap-1 pt-1"
      >
        <span class="text-xs text-muted-foreground">Label cepat:</span>
        <button
          v-for="tag in props.profileTagOptions"
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
      empty-text="Belum ada profile di pool."
      @toggle-row="selection.toggleRow"
      @toggle-page="selection.togglePage"
      @sort="table.toggleSort"
    >
      <template #cell-profile_id="{ row }">
        <div class="space-y-0.5">
          <a
            v-if="row.profileUrl"
            :href="row.profileUrl"
            target="_blank"
            rel="noopener"
            class="font-medium text-primary hover:underline"
          >
            {{ row.profileName || row.profileId }}
          </a>
          <span v-else class="font-medium">{{ row.profileName || row.profileId }}</span>
          <div class="font-mono text-xs text-muted-foreground">{{ row.profileId }}</div>
        </div>
      </template>
      <template #cell-friend_count="{ row }">
        <div class="space-y-0.5 text-xs">
          <div>
            {{ row.friendCount != null ? row.friendCount.toLocaleString("id-ID") : "—" }}
          </div>
          <div class="text-muted-foreground">
            Mutual
            {{
              row.mutualFriendCount != null
                ? row.mutualFriendCount.toLocaleString("id-ID")
                : "—"
            }}
          </div>
        </div>
      </template>
      <template #cell-lifecycleStatus="{ row }">
        <div class="space-y-1 text-xs">
          <div class="flex flex-wrap gap-1">
            <span
              :class="
                cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[10px] capitalize',
                  lifecycleBadge(row.lifecycleStatus)
                )
              "
            >
              {{ row.lifecycleStatus.replaceAll("_", " ") }}
            </span>
            <span
              :class="
                cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[10px] capitalize',
                  relationshipBadge(row.relationshipStatus)
                )
              "
            >
              {{ row.relationshipStatus.replaceAll("_", " ") }}
            </span>
          </div>
          <div v-if="row.lastAction" class="space-y-1">
            <div class="flex flex-wrap items-center gap-1 text-muted-foreground">
              <span>{{ row.lastAction.replaceAll("_", " ") }}</span>
              <span
                v-if="row.lastActionStatus"
                :class="
                  cn(
                    'inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium capitalize',
                    actionStatusBadge(row.lastActionStatus)
                  )
                "
              >
                {{ row.lastActionStatus }}
              </span>
            </div>
            <div class="text-muted-foreground">{{ fmtDateTime(row.lastActionAt) }}</div>
            <div v-if="row.lastActionMessage" class="line-clamp-2 text-muted-foreground">
              {{ row.lastActionMessage }}
            </div>
          </div>
        </div>
      </template>
      <template #cell-sourceType="{ row }">
        <div class="space-y-0.5 text-xs">
          <span class="capitalize">{{ row.sourceType.replaceAll("_", " ") }}</span>
          <a
            v-if="row.sourceUrl"
            :href="row.sourceUrl"
            target="_blank"
            rel="noopener"
            class="block truncate text-muted-foreground hover:underline"
          >
            sumber ↗
          </a>
        </div>
      </template>
      <template #cell-tags="{ row }">
        <div class="flex flex-wrap gap-1">
          <span
            v-for="tag in row.tags"
            :key="tag"
            class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
          >
            {{ tag }}
          </span>
          <span v-if="!row.tags.length" class="text-xs text-muted-foreground">—</span>
        </div>
      </template>
      <template #cell-createdAt="{ row }">
        <div class="space-y-0.5 text-xs text-muted-foreground">
          <div>{{ fmtDate(row.createdAt) }}</div>
          <div v-if="row.lastActionAt">Aksi {{ fmtDate(row.lastActionAt) }}</div>
        </div>
      </template>
      <template #cell-actions="{ row }">
        <div class="flex items-center justify-end gap-1">
          <Link
            :href="`/campaigns/create`"
            class="inline-flex items-center rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
            title="Buat campaign dari pool profile"
          >
            <Users class="size-3.5" />
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
