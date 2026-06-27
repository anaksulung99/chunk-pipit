<script lang="ts" setup>
import type { Data } from "@generated/data";
import { Menu, MenuButton, MenuItems, MenuItem } from "@headlessui/vue";
import { Link } from "@adonisjs/inertia/vue";
import { router } from "@inertiajs/vue3";
import { Icon } from "@iconify/vue";

defineProps<{
  user?: Data.User | null;
}>();

const profileNavItems: AdminNavItem[] = [
  {
    label: "Profile",
    href: "/settings/profile",
    icon: `material-symbols:account-circle`,
  },
  {
    label: "Settings",
    href: "/settings/personal-setting",
    icon: `material-symbols:settings`,
  },
];
const handleLogout = () => {
  router.post("/logout");
};
</script>

<template>
  <div class="w-max text-right">
    <Menu as="div" class="relative inline-block text-left">
      <div>
        <MenuButton
          class="shadow-md bg-blue-600/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-600/30 hover:text-emerald-700 dark:hover:text-emerald-600 border border-emerald-600/50 rounded-full uppercase p-1.5"
        >
          {{ user?.fullName?.slice(0, 2) ?? "User" }}
        </MenuButton>
      </div>

      <transition
        enter-active-class="transition duration-100 ease-out"
        enter-from-class="transform scale-95 opacity-0"
        enter-to-class="transform scale-100 opacity-100"
        leave-active-class="transition duration-75 ease-in"
        leave-from-class="transform scale-100 opacity-100"
        leave-to-class="transform scale-95 opacity-0"
      >
        <MenuItems
          class="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-muted rounded-md bg-background shadow-lg ring-1 ring-muted focus:outline-none"
        >
          <div class="space-y-0 p-3">
            <div class="flex items-center gap-2">
              <div class="text-sm font-medium">
                {{ user?.fullName ?? "User" }}
              </div>
              <span
                class="rounded-md text-[10px] border text-emerald-600 border-emerald-600 py-0.5 px-1 uppercase"
              >
                {{ user?.role ?? "User" }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">{{ user?.email }}</p>
          </div>
          <div class="px-1 py-1">
            <MenuItem
              v-for="item in profileNavItems"
              :key="item.href"
              v-slot="{ active }"
            >
              <Link
                :href="item.href"
                :class="[
                  active
                    ? 'bg-cyan-500 dark:bg-cyan-600 text-white'
                    : 'text-muted-foreground',
                  'group flex w-full items-center rounded-md px-2 py-2 text-sm',
                ]"
              >
                <Icon :icon="item.icon" class="mr-2" />
                {{ item.label }}
              </Link>
            </MenuItem>
          </div>
          <div class="px-1 py-1">
            <MenuItem v-slot="{ active }">
              <button
                :class="[
                  active ? 'bg-red-500 dark:bg-red-600 text-white' : 'text-destructive',
                  'group flex w-full items-center rounded-md px-2 py-2 text-sm',
                ]"
                @click="handleLogout"
              >
                <Icon icon="material-symbols:logout" class="mr-2" />
                Logout
              </button>
            </MenuItem>
          </div>
        </MenuItems>
      </transition>
    </Menu>
  </div>
</template>

<style scoped></style>
