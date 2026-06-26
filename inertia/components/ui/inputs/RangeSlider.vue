<script setup lang="ts">
const emits = defineEmits<{
  (e: "update:value", value?: number): void;
}>();

const props = defineProps<{
  self?: boolean;
  initialValue?: number;
  value?: number;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});

const handleValueChange = (event: Event) => {
  emits("update:value", Number((event.target as HTMLInputElement).value));
};
</script>

<template>
  <input
    min="0"
    max="100"
    type="range"
    class="slider accent-indigo-500"
    :value="modelValue"
    @input="handleValueChange"
  />
</template>
