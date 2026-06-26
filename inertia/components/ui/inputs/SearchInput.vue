<script lang="ts" setup>
import { SearchIcon, XCircleIcon } from "@lucide/vue";

const emits = defineEmits<{
  (e: "update:value", value?: string): void;
}>();

const props = defineProps<{
  variant?: string;
  class?: string;
  value?: string;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});
</script>

<template>
  <LabeledTextInput
    placeholder="Search.."
    class="pl-7"
    :value="modelValue"
    @update:value="(value) => (modelValue = value)"
  >
    <template #startAdornment>
      <SearchIcon
        class="w-5 h-5 mx-2 translate-y-[75%] text-gray-400 dark:text-white dark:opacity-70"
      />
    </template>
    <template #endAdornment>
      <IconButton
        v-if="modelValue"
        title="clear text"
        aria-label="clear text"
        class="ic-btn-ghost-gray m-2 p-2"
        @click="
          () => {
            if (modelValue) emits('update:value', '');
          }
        "
      >
        <XCircleIcon class="w-5 h-5" />
      </IconButton>
    </template>
  </LabeledTextInput>
</template>
