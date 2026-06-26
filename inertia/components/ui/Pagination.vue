<script setup lang="ts">
import { computed } from "vue";
import { ChevronLeft, ChevronRight } from "@lucide/vue";
import type { TableMeta } from "~/composables/useDataTable";

const props = defineProps<{
  meta: TableMeta;
  perPage: number;
  perPageOptions?: number[];
}>();

const emit = defineEmits<{
  (e: "go", page: number): void;
  (e: "per-page", value: number): void;
}>();

const options = computed(() => props.perPageOptions ?? [15, 25, 50, 100]);

const from = computed(() =>
  props.meta.total === 0 ? 0 : (props.meta.currentPage - 1) * props.meta.perPage + 1
);
const to = computed(() =>
  Math.min(props.meta.currentPage * props.meta.perPage, props.meta.total)
);

// Compact page window around the current page.
const pages = computed(() => {
  const { currentPage, lastPage } = props.meta;
  const out: number[] = [];
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(lastPage, currentPage + 2);
  for (let p = start; p <= end; p++) out.push(p);
  return out;
});
</script>

<template>
  <div
    class="flex flex-col gap-3 px-1 py-2 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"
  >
    <div class="flex items-center gap-2">
      <span>Menampilkan {{ from }}–{{ to }} dari {{ meta.total }}</span>
      <select
        class="rounded-md border border-input bg-background px-2 py-1 text-foreground min-w-max"
        :value="perPage"
        @change="emit('per-page', Number(($event.target as HTMLSelectElement).value))"
      >
        <option v-for="opt in options" :key="opt" :value="opt" class="min-w-max">
          {{ opt }}
        </option>
      </select>
    </div>

    <div class="flex items-center gap-1">
      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
        :disabled="meta.currentPage <= 1"
        @click="emit('go', meta.currentPage - 1)"
      >
        <ChevronLeft class="size-4" />
      </button>

      <button
        v-for="p in pages"
        :key="p"
        type="button"
        :class="[
          'inline-flex size-8 items-center justify-center rounded-md border text-sm',
          p === meta.currentPage
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border hover:bg-muted',
        ]"
        @click="emit('go', p)"
      >
        {{ p }}
      </button>

      <button
        type="button"
        class="inline-flex size-8 items-center justify-center rounded-md border border-border hover:bg-muted disabled:opacity-40"
        :disabled="meta.currentPage >= meta.lastPage"
        @click="emit('go', meta.currentPage + 1)"
      >
        <ChevronRight class="size-4" />
      </button>
    </div>
  </div>
</template>
