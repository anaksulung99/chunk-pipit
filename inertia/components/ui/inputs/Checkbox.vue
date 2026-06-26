<script setup lang="ts">
import { CheckIcon } from "@lucide/vue";

const emits = defineEmits<{
  (e: "update:value", value?: boolean): void;
}>();

const props = defineProps<{
  value: boolean;
  inputId?: string;
  handleCheck?: () => void;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});
</script>

<template>
  <div class="relative flex justify-center items-center">
    <input
      :id="props.inputId"
      :class="modelValue ? ['bg-indigo-300'] : []"
      type="checkbox"
      :checked="modelValue"
      class="h-5 w-5 appearance-none relative cursor-pointer outline-none rounded-[.3125rem] border border-indigo-300 transition-all duration-300"
      @click="
        () => {
          if (props.handleCheck) props.handleCheck();
          modelValue = !modelValue;
        }
      "
    />
    <CheckIcon
      class="absolute top-0.75 cursor-pointer z-10 left-0.5 w-4 h-4 text-white transition-all duration-300"
      :class="modelValue ? [] : ['hidden']"
      @click="
        () => {
          if (props.handleCheck) props.handleCheck();
          modelValue = !modelValue;
        }
      "
    />
  </div>
</template>
