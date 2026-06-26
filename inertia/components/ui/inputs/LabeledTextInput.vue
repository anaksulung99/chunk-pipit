<script setup lang="ts">
const emits = defineEmits<{
  (e: "update:value", value?: string): void;
}>();

const props = defineProps<{
  id?: string;
  type?: string;
  label?: string;
  value?: string;
  name?: string;
  class?: string;
  placeholder?: string;
  bordered?: boolean;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});
</script>

<template>
  <div class="flex flex-col">
    <label
      v-if="props.label"
      :id="props.id"
      class="body-2 text-black/70 dark:text-white/70 mb-3"
    >
      {{ props.label }}
    </label>

    <div class="relative">
      <div class="absolute left-0 top-0">
        <slot name="startAdornment"></slot>
      </div>

      <TextInput
        :id="props.id"
        :type="props.type || 'text'"
        name="props.name"
        :value="modelValue"
        :class="[props.bordered ? 'bordered-input' : 'ringed-input', props.class]"
        :placeholder="props.placeholder"
        @update:value="(value) => (modelValue = value)"
      />

      <div class="absolute top-0 right-0">
        <slot name="endAdornment"></slot>
      </div>
    </div>
  </div>
</template>
