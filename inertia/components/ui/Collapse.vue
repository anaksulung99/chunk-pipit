<script setup lang="ts">
const props = defineProps<{
  collapsed: boolean;
}>();
</script>

<template>
  <CollapseTransition>
    <div
      v-if="!props.collapsed"
      class="w-full flex flex-col px-5"
      :aria-hidden="props.collapsed"
    >
      <slot></slot>
    </div>
  </CollapseTransition>
</template>
