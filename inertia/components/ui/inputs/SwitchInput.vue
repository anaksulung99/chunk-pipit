<script lang="ts" setup>
const emits = defineEmits<{
  (e: "update:value", value?: number): void;
}>();

const props = defineProps<{
  id?: string;
  label?: string;
  value: boolean;
  description?: string;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});

const handleToggleSwitchOnEnter = (event: KeyboardEvent) => {
  if (event.key === "Enter") {
    modelValue.value = !modelValue.value;
  }
};

const handleClickCapture = (_event: PointerEvent) => {
  modelValue.value = !modelValue.value;
};
</script>

<template>
  <!--switch-->
  <div
    role="switch"
    :aria-checked="!!props.value"
    :aria-label="'Switch ' + (props.value ? 'checked' : 'not checked')"
    class="relative flex select-none outline-none transition-all duration-200 ease-in"
    tabindex="0"
  >
    <input
      :id="id"
      :checked="props.value"
      type="checkbox"
      :name="label"
      class="absolute block w-5 h-5 rounded-full bg-white scale-[0.6] appearance-none cursor-pointer foucs:outline-none transition-all duration-300"
      :class="{ 'right-0': value }"
      tabindex="-1"
    />

    <label
      :for="id"
      class="block w-7 h-5 rounded-full outline-none cursor-pointer"
      :class="{
        'bg-indigo-300': value,
        'bg-gray-300 dark:bg-gray-600': !value,
      }"
      tabindex="-1"
      @click.capture="handleClickCapture"
      @keydown="handleToggleSwitchOnEnter"
    >
    </label>
  </div>
</template>
