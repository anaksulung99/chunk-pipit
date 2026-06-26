<script setup lang="ts" generic="T extends { id: string }">
import { cn } from '~/lib/utils'
import { ChevronUp, ChevronDown, ChevronsUpDown } from '@lucide/vue'

export type DataTableColumn = {
  key: string
  label: string
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  class?: string
}

const props = defineProps<{
  columns: DataTableColumn[]
  rows: T[]
  loading?: boolean
  sort?: string
  order?: 'asc' | 'desc'
  selectable?: boolean
  isSelected?: (id: string) => boolean
  allPageSelected?: boolean
  somePageSelected?: boolean
  emptyText?: string
}>()

const emit = defineEmits<{
  (e: 'toggle-row', id: string): void
  (e: 'toggle-page'): void
  (e: 'sort', key: string): void
}>()

const alignClass = (a?: string) =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left'
</script>

<template>
  <div class="relative overflow-x-auto rounded-lg border border-border">
    <table class="w-full text-sm">
      <thead class="bg-muted/50 text-muted-foreground">
        <tr class="border-b border-border">
          <th v-if="selectable" class="w-10 px-3 py-2.5">
            <input
              :ref="
                (el) =>
                  el &&
                  ((el as HTMLInputElement).indeterminate = !!somePageSelected && !allPageSelected)
              "
              type="checkbox"
              class="size-4 rounded border-input accent-primary"
              :checked="allPageSelected"
              @change="emit('toggle-page')"
            />
          </th>
          <th
            v-for="col in columns"
            :key="col.key"
            :class="
              cn('px-3 py-2.5 font-medium whitespace-nowrap', alignClass(col.align), col.class)
            "
          >
            <button
              v-if="col.sortable"
              type="button"
              class="inline-flex items-center gap-1 hover:text-foreground"
              @click="emit('sort', col.key)"
            >
              {{ col.label }}
              <ChevronUp v-if="sort === col.key && order === 'asc'" class="size-3.5" />
              <ChevronDown v-else-if="sort === col.key && order === 'desc'" class="size-3.5" />
              <ChevronsUpDown v-else class="size-3.5 opacity-50" />
            </button>
            <span v-else>{{ col.label }}</span>
          </th>
        </tr>
      </thead>

      <tbody>
        <tr v-if="loading && rows.length === 0">
          <td
            :colspan="columns.length + (selectable ? 1 : 0)"
            class="px-3 py-10 text-center text-muted-foreground"
          >
            Memuat…
          </td>
        </tr>
        <tr v-else-if="rows.length === 0">
          <td
            :colspan="columns.length + (selectable ? 1 : 0)"
            class="px-3 py-10 text-center text-muted-foreground"
          >
            {{ emptyText ?? 'Tidak ada data.' }}
          </td>
        </tr>

        <tr
          v-for="row in rows"
          :key="row.id"
          :class="
            cn(
              'border-b border-border last:border-0 hover:bg-muted/40',
              isSelected?.(row.id) && 'bg-muted/60'
            )
          "
        >
          <td v-if="selectable" class="px-3 py-2.5">
            <input
              type="checkbox"
              class="size-4 rounded border-input accent-primary"
              :checked="isSelected?.(row.id)"
              @change="emit('toggle-row', row.id)"
            />
          </td>
          <td
            v-for="col in columns"
            :key="col.key"
            :class="cn('px-3 py-2.5 align-middle', alignClass(col.align), col.class)"
          >
            <slot :name="`cell-${col.key}`" :row="row" :value="(row as any)[col.key]">
              {{ (row as any)[col.key] }}
            </slot>
          </td>
        </tr>
      </tbody>
    </table>

    <div
      v-if="loading && rows.length > 0"
      class="pointer-events-none absolute inset-0 bg-background/40"
    />
  </div>
</template>
