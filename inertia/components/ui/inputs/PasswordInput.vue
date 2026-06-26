<script setup lang="ts">
import { EyeOff, EyeIcon } from "@lucide/vue";

const emits = defineEmits<{
  (e: "update:value", value?: string): void;
}>();

const props = defineProps<{
  id?: string;
  type?: string;
  label?: string;
  value?: string;
  placeholder?: string;
  description?: string;
  bordered?: boolean;
  class?: string;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});

const showPassword = ref(false);
</script>

<template>
  <LabeledTextInput
    :id="props.id"
    :type="showPassword ? 'text' : 'password'"
    :label="props.label"
    :value="props.value"
    :placeholder="props.placeholder"
    :class="props.class"
    :bordered="props.bordered"
    @update:value="(value) => (modelValue = value)"
  >
    <template #endAdornment>
      <Button
        title="toggle password visibility"
        aria-label="toggle password visibility"
        class="m-2 p-2"
        variant="ghost"
        size="icon"
        @click="showPassword = !showPassword"
      >
        <EyeOff v-if="showPassword" class="w-5 h-5" />
        <EyeIcon v-else class="w-5 h-5" />
      </Button>
    </template>
  </LabeledTextInput>
</template>
