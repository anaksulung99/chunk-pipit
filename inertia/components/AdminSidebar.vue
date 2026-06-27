<script setup lang="ts">
import { usePage } from "@inertiajs/vue3";
import type { Data } from "@generated/data";

defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  (e: "close"): void;
}>();

const page = usePage<Data.SharedProps>();
const user = computed(() => page.props.user);
const isAdmin = computed(() => user.value?.isAdmin);

function isActive(href: string) {
  const url = page.url as string;
  return url === href || (href !== "/admin" && url.startsWith(href));
}

const mainNavItems: AdminNavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: `material-symbols:dashboard`,
  },
  {
    label: "Campaigns",
    href: "/campaigns",
    icon: `material-symbols:campaign`,
  },
  {
    label: "Accounts",
    href: "/accounts",
    icon: `mdi:facebook`,
  },
  {
    label: "Groups",
    href: "/groups",
    icon: `material-symbols:groups`,
  },
  {
    label: "Profiles",
    href: "/profiles",
    icon: `lucide:contact`,
  },
  {
    label: "Fingerprints",
    href: "/fingerprints",
    icon: `material-symbols:fingerprint`,
  },
  {
    label: "Proxies",
    href: "/proxies",
    icon: `ic:baseline-vpn-lock`,
  },
  {
    label: "Logs",
    href: "/logs",
    icon: `material-symbols:receipt-long`,
  },
  {
    label: "Anti-Detects",
    href: "/antidetects",
    icon: `hugeicons:anonymous`,
  },
];

const bottomNavItems: AdminNavItem[] = [
  ...mainNavItems,
  ...(isAdmin.value
    ? [
        {
          label: "Licenses",
          href: "/licenses",
          icon: `material-symbols:key-rounded`,
        },
        {
          label: "Teams",
          href: "/teams",
          icon: `heroicons:users-solid`,
        },
      ]
    : []),
];
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 motion-reduce:transition-none"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 motion-reduce:transition-none"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="absolute inset-0 z-30 bg-primary/50 lg:hidden"
      @click="emit('close')"
    />
  </Transition>

  <aside
    class="absolute inset-y-0 left-0 z-40 flex h-full w-20 shrink-0 flex-col border-r border-neutral-300 bg-background px-4 shadow-md transition-transform duration-200 motion-reduce:transition-none dark:border-neutral-700 sm:px-6 lg:static lg:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <nav class="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-4">
      <AdminSidebarLink
        v-for="item in bottomNavItems"
        :key="item.href"
        :href="item.href"
        :label="item.label"
        :icon="item.icon"
        :active="isActive(item.href)"
        @navigate="emit('close')"
      />
    </nav>

    <!-- Menu pinned di bawah (Pengaturan, dsb) -->
    <nav class="flex flex-col items-center gap-1 py-4">
      <!-- <AdminSidebarLink
        v-for="item in profileNavItems"
        :key="item.href"
        :href="item.href"
        :label="item.label"
        :icon="item.icon"
        :active="isActive(item.href)"
        @navigate="emit('close')"
      /> -->
    </nav>
  </aside>
</template>
