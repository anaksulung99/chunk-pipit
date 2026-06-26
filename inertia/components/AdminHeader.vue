<script setup lang="ts">
import type { Data } from "@generated/data";
import { Link } from "@adonisjs/inertia/vue";
defineProps<{
  user?: Data.User | null;
}>();

defineEmits<{
  (e: "toggle-sidebar"): void;
}>();
</script>

<template>
  <header
    class="sticky top-0 z-50 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-neutral-300 bg-background px-4 shadow-md dark:border-neutral-700 sm:px-6"
  >
    <div class="flex items-center gap-3">
      <button
        type="button"
        class="-ml-1 inline-flex items-center justify-center rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 lg:hidden"
        aria-label="Buka navigasi"
        @click="$emit('toggle-sidebar')"
      >
        <svg
          class="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
        >
          <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" stroke-linecap="round" />
        </svg>
      </button>

      <Link
        href="/"
        class="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
      >
        <slot name="logo">
          <img src="/logo.png" alt="" class="h-7 w-7 rounded-full" />
          <span class="hidden text-base font-semibold text-primary sm:inline">
            Chunk Pipit
          </span>
        </slot>
      </Link>
    </div>

    <div class="flex items-center gap-2">
      <ThemeToggle />
      <span
        class="rounded-md text-xs border text-emerald-600 border-emerald-600 p-2 uppercase"
      >
        {{ user?.role ?? "User" }}
      </span>
    </div>
  </header>
</template>
