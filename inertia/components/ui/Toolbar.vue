<script setup lang="ts">
import { X, ZoomIn, ZoomOut, TrashIcon } from "@lucide/vue";

const props = defineProps<{
  handleCloseCarousel: () => void;
  handleIncreaseZoom: () => void;
  handleDecreaseZoom: () => void;
  isImage: boolean;
}>();
</script>

<template>
  <div class="w-full flex justify-end mb-5">
    <!--decrease zoom-->
    <Button
      v-show="props.isImage"
      title="decrease zoom"
      aria-label="decrease zoom"
      class="mr-5"
      size="icon"
      @click="props.handleDecreaseZoom()"
    >
      <ZoomOut class="w-6 h-6 text-white opacity-80 hover:opacity-100" />
    </Button>

    <!--increase zoom-->
    <Button
      v-show="props.isImage"
      title="increase zoom"
      aria-label="increase zoom"
      class="mr-5"
      size="icon"
      @click="props.handleIncreaseZoom()"
    >
      <ZoomIn class="w-6 h-6 text-white opacity-80 hover:opacity-100" />
    </Button>

    <!--delete media-->
    <Button
      aria-label="delete attachment"
      class="mr-5"
      title="delete attachment"
      size="icon"
      variant="destructive"
    >
      <TrashIcon class="w-6 h-6 text-white opacity-80 hover:opacity-100" />
    </Button>

    <!--close carousel-->
    <Button
      title="close carousel"
      aria-label="close carousel"
      size="icon"
      variant="destructive"
      @click="props.handleCloseCarousel()"
    >
      <X class="w-6 h-6 text-white opacity-80 hover:opacity-100" />
    </Button>
  </div>
</template>
