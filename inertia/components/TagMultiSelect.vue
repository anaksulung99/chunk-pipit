<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { cn } from "~/lib/utils";

const props = withDefaults(
  defineProps<{
    modelValue: string[];
    options: string[];
    label: string;
    placeholder?: string;
    helper?: string;
    emptyLabel?: string;
  }>(),
  {
    placeholder: "Cari label kelompok...",
    helper: "",
    emptyLabel: "Belum ada label tersimpan.",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const search = ref("");
const customInput = ref("");

const normalizedValue = computed(() => Array.from(new Set(props.modelValue.filter(Boolean))));
const filteredOptions = computed(() => {
  const query = search.value.trim().toLowerCase();
  if (!query) return props.options;
  return props.options.filter((option) => option.toLowerCase().includes(query));
});

watch(
  () => props.modelValue,
  (value) => {
    if (!value.length) customInput.value = "";
  }
);

function update(next: string[]) {
  emit("update:modelValue", Array.from(new Set(next.map((item) => item.trim()).filter(Boolean))));
}

function toggle(tag: string) {
  if (normalizedValue.value.includes(tag)) {
    update(normalizedValue.value.filter((item) => item !== tag));
    return;
  }
  update([...normalizedValue.value, tag]);
}

function remove(tag: string) {
  update(normalizedValue.value.filter((item) => item !== tag));
}

function addCustomTags() {
  const parsed = customInput.value
    .split(/[,\n|]/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (!parsed.length) return;
  update([...normalizedValue.value, ...parsed]);
  customInput.value = "";
}
</script>

<template>
  <div class="rounded-md border border-input bg-background p-3">
    <div class="flex items-center justify-between gap-3">
      <div>
        <div class="text-sm font-medium">{{ label }}</div>
        <p v-if="helper" class="text-xs text-muted-foreground">{{ helper }}</p>
      </div>
      <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
        {{ normalizedValue.length }} dipilih
      </span>
    </div>

    <div v-if="normalizedValue.length" class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="tag in normalizedValue"
        :key="tag"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs text-primary"
        @click="remove(tag)"
      >
        <span>{{ tag }}</span>
        <span class="text-[10px] opacity-70">hapus</span>
      </button>
    </div>

    <div class="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div class="space-y-3">
        <input
          v-model="search"
          type="text"
          :placeholder="placeholder"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <div class="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-2">
          <button
            v-for="tag in filteredOptions"
            :key="tag"
            type="button"
            :class="
              cn(
                'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition',
                normalizedValue.includes(tag)
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border hover:bg-muted'
              )
            "
            @click="toggle(tag)"
          >
            <span class="truncate">{{ tag }}</span>
            <span class="text-[11px] opacity-70">
              {{ normalizedValue.includes(tag) ? "Dipilih" : "Pilih" }}
            </span>
          </button>
          <p v-if="!filteredOptions.length" class="px-1 py-2 text-xs text-muted-foreground">
            {{ emptyLabel }}
          </p>
        </div>
      </div>

      <div class="space-y-2 rounded-md border border-dashed border-border p-3">
        <div class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Tambah Label Baru
        </div>
        <textarea
          v-model="customInput"
          rows="4"
          placeholder="mis. grey-anatomy, health, buyer-2026"
          class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
        />
        <button
          type="button"
          class="w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          @click="addCustomTags"
        >
          Tambahkan ke Pilihan
        </button>
        <p class="text-[11px] text-muted-foreground">
          Pisahkan label dengan koma, baris baru, atau tanda `|`.
        </p>
      </div>
    </div>
  </div>
</template>
