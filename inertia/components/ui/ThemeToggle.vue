<script lang="ts" setup>
import { SunIcon, MoonIcon } from "@lucide/vue";

const store = useThemeStore();
</script>

<template>
  <Button variant="outline" size="icon" @click="store.toggleTheme">
    <SunIcon v-if="store.isDark" class="text-yellow-500" />
    <MoonIcon v-else class="text-indigo-500" />
  </Button>
</template>
