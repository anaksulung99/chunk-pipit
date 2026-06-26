<script lang="ts" setup>
import { XCircle, CheckCircle2, InfoIcon, AlertCircleIcon } from "@lucide/vue";

type AlertType = "error" | "success" | "info" | "warning";

const props = defineProps<{
  type: AlertType;
  message: string;
}>();

const titleMap = {
  error: "Error!",
  success: "Success!",
  info: "Info!",
  warning: "Warning!",
};

const iconMaps = {
  error: XCircle,
  success: CheckCircle2,
  info: InfoIcon,
  warning: AlertCircleIcon,
};
</script>

<template>
  <div
    class="bg-red-50 text-sm p-3 rounded-md flex flex-col gap-3 border border-red-100 sm:items-center sm:flex-row dark:bg-red-900/20 dark:border-red-800/40"
    role="alert"
  >
    <div class="flex items-center gap-2.5 text-red-900 font-medium dark:text-red-300">
      <component :is="iconMaps[type]" v-if="iconMaps[type]" class="size-4.5" />

      <p>{{ titleMap[type] }}</p>
    </div>
    <p class="text-red-900 dark:text-red-400">
      {{ message }}
    </p>
  </div>
</template>
