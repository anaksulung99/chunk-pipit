<script setup lang="ts">
import { watch } from 'vue'
import { usePage } from '@inertiajs/vue3'
import { toast, Toaster } from 'vue-sonner'
import type { Data } from '@generated/data'

// Chrome-less layout for full-screen gates (activation, locked). Still surfaces
// server flash messages as toasts, like the default layout.
const page = usePage<Data.SharedProps>()

watch(
  () => page.props.flash,
  (flash) => {
    if (flash?.error) toast.error(flash.error)
    if (flash?.success) toast.success(flash.success)
  },
  { immediate: true }
)
</script>

<template>
  <slot />
  <Toaster position="top-center" rich-colors />
</template>
