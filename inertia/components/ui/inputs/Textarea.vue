<script lang="ts" setup>
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
  autoResize?: boolean;
}>();

const modelValue = useVModel(props, "value", emits, {
  passive: true,
});

const textarea = ref<HTMLTextAreaElement | null>(null);

const autoResize = () => {
  if (props.autoResize && textarea.value) {
    textarea.value.style.height = "auto";
    textarea.value.style.height = textarea.value.scrollHeight + "px";
  }
};
const handleInput = (event: any) => {
  modelValue.value = (event.target as HTMLTextAreaElement).value;
  autoResize();
};
</script>

<template>
  <textarea
    :id="props.id"
    ref="textarea"
    :value="modelValue"
    name="props.name"
    class="text-input"
    :class="[props.bordered ? 'bordered-input' : 'ringed-input']"
    :placeholder="props.placeholder"
    @input="handleInput"
  />
</template>
