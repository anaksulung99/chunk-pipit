<script lang="ts" setup>
import { Icon } from "@iconify/vue";

const props = defineProps<{
  data?: StatsCard;
  loading?: boolean;
}>();
const formattedValue = computed(() => {
  if (props.data?.value === undefined || props.data?.value === null) return "—";
  if (typeof props.data?.value === "string") return props.data.value;
  if (props.data.format === "compact") {
    if (props.data.value >= 1_000_000)
      return `${(props.data.value / 1_000_000).toFixed(1)}M`;
    if (props.data.value >= 1_000) return `${(props.data.value / 1_000).toFixed(1)}K`;
    return props.data.value.toLocaleString();
  }
  if (props.data.format === "percent") return `${props.data.value}%`;
  if (props.data.format === "number") return props.data.value.toLocaleString();
  return String(props.data.value);
});
const colorMap: Record<
  ColorVariant,
  {
    border: string;
    glow: string;
    value: string;
    icon: string;
    iconBg: string;
  }
> = {
  indigo: {
    border: "border-indigo-500/15",
    glow: "bg-indigo-500",
    value: "text-indigo-300",
    icon: "text-indigo-400",
    iconBg: "bg-indigo-500/10",
  },
  emerald: {
    border: "border-emerald-500/15",
    glow: "bg-emerald-500",
    value: "text-emerald-300",
    icon: "text-emerald-400",
    iconBg: "bg-emerald-500/10",
  },
  amber: {
    border: "border-amber-500/15",
    glow: "bg-amber-500",
    value: "text-amber-300",
    icon: "text-amber-400",
    iconBg: "bg-amber-500/10",
  },
  red: {
    border: "border-red-500/15",
    glow: "bg-red-500",
    value: "text-red-300",
    icon: "text-red-400",
    iconBg: "bg-red-500/10",
  },
  blue: {
    border: "border-blue-500/15",
    glow: "bg-blue-500",
    value: "text-blue-300",
    icon: "text-blue-400",
    iconBg: "bg-blue-500/10",
  },
  purple: {
    border: "border-purple-500/15",
    glow: "bg-purple-500",
    value: "text-purple-300",
    icon: "text-purple-400",
    iconBg: "bg-purple-500/10",
  },
  slate: {
    border: "border-white/[0.08]",
    glow: "bg-neutral-500",
    value: "text-neutral-200",
    icon: "text-neutral-400",
    iconBg: "bg-white/[0.05]",
  },
};

const borderColor = computed(
  () => colorMap[props.data?.color!]?.border ?? "border-indigo-500/15"
);
const glowColor = computed(() => colorMap[props.data?.color!]?.glow ?? "bg-indigo-500");
const valueColor = computed(
  () => colorMap[props.data?.color!]?.value ?? "text-indigo-300"
);
const iconColor = computed(() => colorMap[props.data?.color!]?.icon ?? "text-indigo-400");
const iconBg = computed(() => colorMap[props.data?.color!]?.iconBg ?? "bg-indigo-500/10");
</script>

<template>
  <div class="overflow-hidden overflow-x-auto shadow-md w-full">
    <div class="shadow-md border rounded-lg transition-all group" :class="borderColor">
      <div
        class="absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 group-hover:opacity-20 transition-opacity"
        :class="glowColor"
      />
      <div class="relative flex items-start justify-between">
        <div class="flex-1 min-w-0">
          <p class="text-xs font-medium uppercase tracking-wider text-muted mb-2">
            {{ props.data?.label }}
          </p>
          <div class="flex items-end gap-2">
            <span class="text-3xl font-bold tracking-tight" :class="valueColor">
              <slot name="value">{{ formattedValue }}</slot>
            </span>
            <span v-if="props.data?.unit" class="text-sm text-muted mb-0.5">{{
              props.data?.unit
            }}</span>
          </div>
          <div
            v-if="props.data?.change !== undefined"
            class="flex items-center gap-1 mt-2"
          >
            <UIcon
              :name="
                props.data?.change >= 0
                  ? 'i-heroicons-arrow-trending-up'
                  : 'i-heroicons-arrow-trending-down'
              "
              class="w-3.5 h-3.5"
              :class="
                props.data?.change >= 0
                  ? 'text-emerald-400 dark:text-emerald-50'
                  : 'text-red-400 dark:text-red-50'
              "
            />
            <span
              class="text-xs"
              :class="
                props.data?.change >= 0
                  ? 'text-emerald-400 dark:text-emerald-50'
                  : 'text-red-400 dark:text-red-50'
              "
            >
              {{ Math.abs(props.data?.change) }}%
            </span>
            <span class="text-xs text-muted">vs kemarin</span>
          </div>
          <p v-if="props.data?.description" class="text-xs text-muted mt-1">
            {{ props.data?.description }}
          </p>
        </div>

        <!-- Icon -->
        <div
          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          :class="iconBg"
        >
          <Icon
            v-if="props.data?.icon"
            :icon="props.data?.icon"
            class="w-5 h-5"
            :class="iconColor"
          />
        </div>
      </div>
      <div
        v-if="props?.loading"
        class="absolute inset-0 bg-[#080c14]/60 dark:bg-[#080c14]/80 rounded-xl flex items-center justify-center"
      >
        <Icon icon="heroicons:arrow-path" class="w-5 h-5 text-white animate-spin" />
      </div>
    </div>
  </div>
</template>
