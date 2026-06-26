<script setup lang="ts">
import { X } from '@lucide/vue'

const props = defineProps<{
  /** Explicitly-selected count; null means "all matching" mode is active. */
  count: number | null
  allMatching: boolean
  /** Total rows matching the current filters (for the "select all" affordance). */
  matchingTotal?: number
}>()

defineEmits<{
  (e: 'select-all-matching'): void
  (e: 'clear'): void
}>()
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/60 px-3 py-2 text-sm"
  >
    <span class="font-medium text-foreground">
      <template v-if="allMatching">
        Semua {{ matchingTotal ?? '' }} item yang cocok dipilih
      </template>
      <template v-else>{{ count }} dipilih</template>
    </span>

    <button
      v-if="!allMatching && matchingTotal && count && count < matchingTotal"
      type="button"
      class="text-primary hover:underline"
      @click="$emit('select-all-matching')"
    >
      Pilih semua {{ matchingTotal }} item yang cocok
    </button>

    <div class="ml-auto flex items-center gap-2">
      <slot />
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        @click="$emit('clear')"
      >
        <X class="size-3.5" /> Batal
      </button>
    </div>
  </div>
</template>
