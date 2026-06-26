<script lang="ts" setup>
const props = defineProps<{
  title?: string;
  description?: string;
}>();
</script>

<template>
  <div
    class="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-neutral-900 dark:text-neutral-50 relative"
  >
    <div class="absolute top-3 right-3 z-50">
      <ThemeToggle />
    </div>
    <div class="w-full max-w-md space-y-2">
      <div class="flex items-center justify-center">
        <img src="/logo.png" alt="logo" class="h-16 w-auto object-fill" />
      </div>
      <div class="mb-8 text-center">
        <h1 class="text-2xl font-semibold tracking-tight">{{ title }}</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ description }}
        </p>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped></style>
