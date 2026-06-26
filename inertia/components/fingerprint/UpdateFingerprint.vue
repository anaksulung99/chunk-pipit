<script lang="ts" setup>
import { useForm } from "@inertiajs/vue3";

type FingerprintEditable = {
  id: string;
  name: string;
  osType: string;
  browserType: string;
  locale?: string | null;
  timezone?: string | null;
};

const emits = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();

const props = defineProps<{
  open?: boolean;
  data?: FingerprintEditable | null;
}>();

const isOpen = useVModel(props, "open", emits, {
  passive: true,
});

const form = useForm({
  name: props.data?.name || "",
  osType: props.data?.osType || "windows",
  browserType: props.data?.browserType || "chrome",
  locale: props.data?.locale || "en-US",
  timezone: props.data?.timezone || "Asia/Jakarta",
});

watch(
  () => props.data,
  (newVal) => {
    if (newVal) {
      form.name = newVal.name || "";
      form.osType = newVal.osType || "windows";
      form.browserType = newVal.browserType || "chrome";
      form.locale = newVal.locale || "en-US";
      form.timezone = newVal.timezone || "Asia/Jakarta";
    }
  }
);

function submit() {
  form.put(`/fingerprints/${props.data?.id}/update`, {
    preserveScroll: true,
    onSuccess: () => {
      form.reset();
      emits("close");
    },
  });
}

function closeModal() {
  emits("close");
}

const OS = ["all", "windows", "linux", "macos"];
const BROWSERS = ["all", "chrome", "firefox", "safari", "edge"];
</script>

<template>
  <Modal
    v-model:open="isOpen"
    title="Update Fingerprint"
    description="Perbarui metadata fingerprint yang sudah tersimpan."
    @close="closeModal"
  >
    <template #content>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <label for="name" class="text-sm font-medium text-muted-foreground">
            Nama fingerprint
          </label>
          <input
            v-model="form.name"
            placeholder="Nama fingerprint"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="osType" class="text-sm font-medium text-muted-foreground">
            OS Type
          </label>
          <select v-model="form.osType" class="bg-input capitalize">
            <option v-for="o in OS.slice(1)" :key="o" :value="o" class="capitalize">
              {{ o }}
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="browserType" class="text-sm font-medium text-muted-foreground">
            Browser Type
          </label>
          <select v-model="form.browserType" class="bg-input capitalize">
            <option v-for="b in BROWSERS.slice(1)" :key="b" :value="b" class="capitalize">
              {{ b }}
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="locale" class="text-sm font-medium text-muted-foreground">
            Locale
          </label>
          <select v-model="form.locale" class="bg-input capitalize">
            <option
              v-for="l in IsoLanguages"
              :key="l.code"
              :value="l.code"
              class="capitalize"
            >
              {{ l.name }}
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="timezone" class="text-sm font-medium text-muted-foreground">
            Timezone
          </label>
          <select v-model="form.timezone" class="bg-input capitalize">
            <option
              v-for="l in TimezoneList"
              :key="l.zone"
              :value="l.zone"
              class="capitalize"
            >
              {{ l.name }}
            </option>
          </select>
        </div>
        <div class="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            :disabled="form.processing"
            @click="closeModal"
          >
            Close
          </Button>
          <Button
            type="submit"
            class="bg-emerald-600 dark:bg-emerald-500 text-white"
            :disabled="form.processing"
          >
            {{ form.processing ? "Updating..." : "Update" }}
          </Button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<style scoped></style>
