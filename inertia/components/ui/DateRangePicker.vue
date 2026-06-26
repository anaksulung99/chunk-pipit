<script lang="ts" setup>
import { VueDatePicker } from "@vuepic/vue-datepicker";
import { id } from "date-fns/locale/id";

const emits = defineEmits<{
  (e: "update:modelValue", value: DateRange): void;
  (e: "change", value: DateRange): void;
  (e: "update:startDate", value: Date | null): void;
  (e: "update:endDate", value: Date | null): void;
}>();

const props = withDefaults(
  defineProps<{
    modelValue?: DateRange;
    placeholder?: string;
    startDate?: Date | null;
    endDate?: Date | null;
    disabled?: boolean;
    clearable?: boolean;
  }>(),
  {
    modelValue: null,
    placeholder: "Select Date Range ...",
    startDate: null,
    endDate: null,
    disabled: false,
    clearable: true,
  }
);

const theme = useThemeStore();

const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
});

watch(
  modelValue,
  (newValue) => {
    if (newValue && Array.isArray(newValue) && newValue.length === 2) {
      emits("update:startDate", newValue[0]);
      emits("update:endDate", newValue[1]);
    } else {
      emits("update:startDate", null);
      emits("update:endDate", null);
    }
  },
  { deep: true }
);

const handleChange = (value: string | Event | null) => {
  let valueDate: string | undefined;

  if (value instanceof Event) {
    const target = value.target as HTMLInputElement;
    valueDate = target?.value;
  } else if (typeof value === "string") {
    valueDate = value;
  }

  emits("change", valueDate ? [new Date(valueDate), new Date(valueDate)] : null);
};
</script>

<template>
  <VueDatePicker
    v-model="modelValue"
    :placeholder="placeholder"
    range
    model-auto
    :locale="id"
    :clearable="clearable"
    :disabled="disabled"
    :dark="theme.isDark"
    @text-input="handleChange"
  />
</template>

<style scoped></style>
