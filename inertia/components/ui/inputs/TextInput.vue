<script setup lang="ts">
const emits = defineEmits<{
  (e: "update:value", value?: string): void;
}>();

const props = defineProps<{
  id?: string;
  type?: string;
  value?: string;
  name?: string;
  placeholder?: string;
  bordered?: boolean;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});

const handleInput = (event: any) => {
  emits("update:value", (event.target as HTMLInputElement).value);
};
</script>

<template>
  <input
    :id="props.id"
    :type="props.type || 'text'"
    name="props.name"
    class="text-input"
    :class="[props.bordered ? 'bordered-input' : 'ringed-input']"
    :value="modelValue"
    :placeholder="props.placeholder"
    @input="handleInput"
  />
</template>
