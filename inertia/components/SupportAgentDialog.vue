<script lang="ts" setup>
import { Icon } from "@iconify/vue";

const emits = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();

const props = defineProps<{
  open: boolean;
}>();

const isOpen = useVModel(props, "open", emits, {
  passive: true,
});

const supportAgents = ref([
  {
    value: "telegram",
    name: "Telegram",
    icon: "logos:telegram",
    url: "https://t.me/grpc93",
    cta: "Join",
    desc: "Join our Telegram group to get support.",
  },
  {
    value: "whatsapp",
    name: "WhatsApp",
    icon: "logos:whatsapp-icon",
    url: "https://wa.me/+6285314830040",
    cta: "Join",
    desc: "Join our WhatsApp group to get support.",
  },
  {
    value: "email",
    name: "Email",
    icon: "logos:google-gmail",
    url:
      "mailto:premiumwatchdevice@gmail.com?subject=Subject=Question&body=Hello, I have a question.",
    cta: "Join",
    desc: "Send us an email to get support.",
  },
  {
    value: "donation",
    name: "Donation",
    icon: "fluent-color:gift-24",
    url: "https://paypal.me/agcforge",
    cta: "Donate",
    desc: "Donate to support us.",
  },
]);

function openSupportAgent(url: string) {
  window.open(url, "_blank");
}
</script>

<template>
  <Modal
    v-model:open="isOpen"
    title="Contact the Developer Team"
    description="Pilih contact method yang akan digunakan."
    @close="emits('close')"
  >
    <template #content>
      <div class="space-y-4 overflow-y-auto max-h-[calc(100vh-200px)]">
        <div
          v-for="agent in supportAgents"
          :key="agent.value"
          class="flex items-center justify-between gap-4 p-4 cursor-pointer border border-amber-600/40 rounded-md"
          @click="openSupportAgent(agent.url)"
        >
          <div class="flex items-center gap-3">
            <Icon :icon="agent.icon" class="size-10" />
            <div>
              <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                {{ agent.name }}
              </p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">
                {{ agent.desc }}
              </p>
            </div>
          </div>
          <Button size="sm" class="text-white" @click="openSupportAgent(agent.url)">
            {{ agent.cta }}
          </Button>
        </div>
      </div>
    </template>
  </Modal>
</template>

<style scoped></style>
