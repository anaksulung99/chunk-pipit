<script setup lang="ts">
import { X } from '@lucide/vue'

const emits = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();
const props = defineProps<{
  open: boolean;
  title?: string;
  description?: string;
}>();

const isOpen = useVModel(props, "open", emits);

const onOpenChange = (open: boolean) => {
  isOpen.value = open;
};
</script>

<template>
  <Teleport to="body" @change="onOpenChange">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
          @click="onOpenChange(false)"
        ></div>

        <Transition name="scale">
          <div
            v-if="isOpen"
            class="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-6 text-left align-middle shadow-xl transition-all space-y-4"
          >
            <button
              class="absolute top-4 right-4 text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-500 transition-colors disabled:pointer-events-none"
              aria-label="Close dialog"
              @click="onOpenChange(false)"
            >
              <X class="size-5" />
            </button>

            <div class="mx-auto space-y-4">
              <h3
                v-if="props.title"
                class="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
              >
                {{ props.title }}
              </h3>

              <p
                v-if="props.description"
                class="mt-2 text-sm text-muted-foreground mb-6"
              >
                {{ props.description }}
              </p>

              <slot name="content" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active {
  transition: opacity 0.1s ease;
}

.fade-leave-active {
  transition: opacity 0.6s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
