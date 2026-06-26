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

const bgMaps = {
  error: "bg-red-50 border-red-100 dark:bg-red-900/20 dark:border-red-800/40",
  success:
    "bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800/40",
  info: "bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800/40",
  warning: "bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800/40",
};

const titleColorMap = {
  error: "text-red-900 dark:text-red-300",
  success: "text-emerald-900 dark:text-emerald-300",
  info: "text-blue-900 dark:text-blue-300",
  warning: "text-amber-900 dark:text-amber-300",
};

const messageColorMap = {
  error: "text-red-900 dark:text-red-400",
  success: "text-emerald-900 dark:text-emerald-400",
  info: "text-blue-900 dark:text-blue-400",
  warning: "text-amber-900 dark:text-amber-400",
};
</script>

<template>
  <div
    :class="
      cn(
        'text-sm p-3 rounded-md flex flex-col gap-3 sm:items-center sm:flex-row',
        bgMaps[type]
      )
    "
    role="alert"
  >
    <div class="flex-1 space-y-2">
      <div
        :class="cn('flex items-center gap-2.5 font-medium text-sm', titleColorMap[type])"
      >
        <component :is="iconMaps[type]" v-if="iconMaps[type]" class="size-4.5" />

        <p>{{ titleMap[type] }}</p>
      </div>
      <p :class="cn('text-xs', messageColorMap[type])">
        {{ message }}
      </p>
    </div>
  </div>
</template>
