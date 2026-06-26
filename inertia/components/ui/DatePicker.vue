<script lang="ts" setup>
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { id } from "date-fns/locale/id";

const emits = defineEmits<{
  (e: "update:modelValue", value: Date | null): void;
  (e: "change", value: Date | null): void;
}>();

const props = withDefaults(
  defineProps<{
    modelValue?: Date | null;
    placeholder?: string;
    disabled?: boolean;
    clearable?: boolean;
    minDate?: Date | null;
  }>(),
  {
    modelValue: null,
    placeholder: "Select Date ...",
    disabled: false,
    clearable: true,
    minDate: null,
  }
);
const theme = useThemeStore();

const modelValue = computed({
  get: () => props.modelValue ?? null,
  set: (value: Date | null) => emits("update:modelValue", value),
});

watch(modelValue, (value) => emits("change", value ?? null));
</script>

<template>
  <VueDatePicker
    v-model="modelValue"
    :placeholder="placeholder"
    text-input
    auto-apply
    :enable-time-picker="false"
    :min-date="minDate ?? undefined"
    :locale="id"
    :clearable="clearable"
    :disabled="disabled"
    :dark="theme.isDark"
  />
</template>

<style scoped></style>
