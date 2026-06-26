<script lang="ts" setup>
import { AlertCircle, CheckCircle2, AlertTriangle, Info, X } from "@lucide/vue";

const {
  isOpen,
  currentAlert,
  currentConfig,
  handleConfirm,
  handleCancel,
  handleOpenChange,
} = useGlobalAlert();

const ICON_MAP = {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
} as const;

const IconComponent = computed(() => {
  if (!currentConfig.value) return null;
  return ICON_MAP[currentConfig.value.icon as keyof typeof ICON_MAP] ?? AlertCircle;
});
</script>

<template>
  <Teleport to="body" @change="handleOpenChange">
    <Transition name="fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="fixed inset-0 bg-neutral-900/60 backdrop-blur-sm transition-opacity"
          @click="handleCancel"
        ></div>

        <Transition name="scale">
          <div
            v-if="isOpen"
            class="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-neutral-900 p-6 text-left align-middle shadow-xl transition-all space-y-4"
          >
            <button
              v-if="currentAlert && !currentAlert.persistent"
              class="absolute top-4 right-4 text-neutral-500 dark:text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-500 transition-colors disabled:pointer-events-none"
              aria-label="Close dialog"
              @click="handleCancel"
            >
              <X class="size-5" />
            </button>

            <div class="mx-auto space-y-4">
              <div
                v-if="IconComponent"
                :class="
                  cn(
                    'mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-background shadow-sm sm:mx-0',
                    currentConfig?.containerClass ?? 'border border-border'
                  )
                "
              >
                <component
                  :is="IconComponent"
                  :class="
                    cn('h-7 w-7', currentConfig?.iconClass ?? 'text-muted-foreground')
                  "
                />
              </div>
              <h3
                class="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
              >
                {{ currentAlert?.title ?? "" }}
              </h3>

              <div
                v-if="currentAlert?.description"
                class="mt-2 text-sm text-muted-foreground mb-6"
              >
                {{ currentAlert?.description }}
              </div>
            </div>
            <!-- Dialog Action Buttons Slot -->
            <div class="mt-4 flex justify-end gap-3">
              <button
                v-if="currentAlert && !currentAlert.persistent"
                type="button"
                :class="
                  cn(
                    buttonVariants({ variant: 'outline' }),
                    'mt-2 cursor-pointer active:scale-95 sm:mt-0',
                    currentAlert.cancelClass
                  )
                "
                @click="handleCancel"
              >
                {{ currentAlert.cancelLabel }}
              </button>
              <button
                v-if="currentAlert"
                type="button"
                :class="
                  cn(
                    buttonVariants({
                      variant:
                        currentConfig?.confirmVariant === 'destructive'
                          ? 'destructive'
                          : 'default',
                    }),
                    'cursor-pointer active:scale-95',
                    currentAlert.confirmClass
                  )
                "
                @click="handleConfirm"
              >
                {{ currentAlert.confirmLabel }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped></style>
