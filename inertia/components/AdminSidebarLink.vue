<script setup lang="ts">
import type { Data } from "@generated/data";
import { Link } from "@adonisjs/inertia/vue";
import { Icon } from "@iconify/vue";
import { usePage } from "@inertiajs/vue3";

defineProps<{
  href: string;
  label: string;
  icon: string;
  active: boolean;
}>();

defineEmits<{
  (e: "navigate"): void;
}>();

const page = usePage<Data.SharedProps>();
</script>

<template>
  <Link
    :href="href"
    :aria-label="label"
    :aria-current="active ? 'page' : undefined"
    class="group relative flex h-11 w-11 items-center justify-center rounded-xl outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400"
    :class="
      page.url === href
        ? ' text-emerald-600 dark:text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-600'
        : 'text-muted-foreground hover:bg-muted'
    "
    @click="$emit('navigate')"
  >
    <span
      v-if="page.url === href"
      class="absolute left-0 h-5 w-0.5 rounded-full bg-emerald-400"
    />

    <Icon :icon="icon" class="h-5 w-5" />

    <!-- tooltip  -->
    <span
      class="pointer-events-none absolute left-full ml-3 hidden whitespace-nowrap rounded-md bg-muted px-2 py-1 text-xs font-medium shadow-lg group-hover:flex"
    >
      {{ label }}
    </span>
  </Link>
</template>
