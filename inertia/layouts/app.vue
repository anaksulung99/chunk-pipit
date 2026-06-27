<script setup lang="ts">
import { usePage } from "@inertiajs/vue3";
import type { Data } from "@generated/data";

const props = defineProps<{
  title?: string;
  description?: string;
}>();

const page = usePage<Data.SharedProps>();

const sidebarOpen = ref(false);

const currentUser = computed(() => page.props.user ?? null);
</script>

<template>
  <div
    class="flex h-screen flex-col overflow-hidden bg-background text-neutral-900 dark:text-neutral-50"
  >
    <AdminHeader :user="currentUser" @toggle-sidebar="sidebarOpen = !sidebarOpen" />

    <div class="relative flex min-h-0 flex-1 overflow-hidden">
      <AdminSidebar :open="sidebarOpen" @close="sidebarOpen = false" />

      <div
        class="flex min-h-0 min-w-0 flex-1 flex-col gap-4 bg-neutral-100 p-3 pt-0 dark:bg-neutral-900 sm:p-4 sm:pt-0"
      >
        <div class="flex min-h-0 min-w-0 w-full flex-1 flex-col">
          <div
            class="mx-auto min-h-0 min-w-0 w-full max-w-360 flex-1 space-y-6 overflow-x-hidden overflow-y-auto p-3 sm:p-6"
          >
            <div class="flex min-w-0 flex-col gap-4 md:flex-row md:justify-between">
              <div class="flex min-w-0 flex-col justify-start text-start">
                <h1 v-if="props.title" class="text-2xl font-bold">
                  {{ props.title }}
                </h1>
                <p
                  v-if="props.description"
                  class="mt-1 max-w-4xl text-sm text-muted-foreground"
                >
                  {{ props.description }}
                </p>
              </div>
              <div v-if="$slots.actions" class="flex max-w-full shrink-0 flex-wrap gap-2">
                <slot name="actions" />
              </div>
            </div>
            <div class="min-w-0 max-w-full space-y-4">
              <slot />
            </div>
          </div>
        </div>
        <footer
          class="border-t border-border px-4 py-1.5 text-center text-xs text-muted-foreground sm:px-6 hidden"
        >
          © {{ new Date().getFullYear() }} Chunk Pipit. Seluruh hak cipta dilindungi.
        </footer>
      </div>
    </div>
  </div>
</template>
