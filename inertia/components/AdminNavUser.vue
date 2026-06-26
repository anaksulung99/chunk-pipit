<script lang="ts" setup>
import { router } from "@inertiajs/vue3";
import { Icon } from "@iconify/vue";

const handleLogout = () => {
  router.post("/logout");
};
</script>

<template>
  <Button type="button" variant="ghost" size="icon" @click="handleLogout">
    <Icon icon="material-symbols:logout" class="size-5 text-destructive" />
  </Button>
</template>
