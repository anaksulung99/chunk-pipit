<script lang="ts" setup>
import { useForm } from "@inertiajs/vue3";
import { XIcon, EyeIcon } from "@lucide/vue";

type AccountRow = {
  id: string;
  label: string;
  fbUserId: string | null;
  profileUrl: string | null;
  sessionStatus: string;
  notes: string | null;
  cookiesCount: number;
  lastUsedAt: string | null;
  createdAt: string | null;
};

type EditForm = {
  fbUserId?: string;
  profileUrl?: string;
  notes?: string;
  cookiesText?: string | null;
  label: string;
};

const emits = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();

const props = defineProps<{
  open?: boolean;
  data?: AccountRow | null;
}>();

const isOpen = useVModel(props, "open", emits, {
  passive: true,
});

const showCookiesField = ref(false);

const form = useForm<EditForm>({
  label: "",
  profileUrl: "",
  fbUserId: "",
  cookiesText: null,
  notes: "",
});

watch(
  () => props.data,
  (newVal) => {
    if (newVal) {
      form.label = newVal.label || "";
      form.profileUrl = newVal.profileUrl || "";
      form.fbUserId = newVal.fbUserId || "";
      form.notes = newVal.notes || "";
    }
  }
);

function submit() {
  form.put(`/accounts/${props.data?.id}/update`, {
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
</script>

<template>
  <Modal
    v-model:open="isOpen"
    title="Update Account Facebook"
    description="Perbarui metadata account Facebook yang sudah tersimpan."
    @close="isOpen = false"
  >
    <template #content>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <label for="label" class="text-sm font-medium text-muted-foreground">
            Nama account Facebook
          </label>
          <input
            v-model="form.label"
            placeholder="Nama account Facebook"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="fbUserId" class="text-sm font-medium text-muted-foreground">
            ID account Facebook
          </label>
          <input
            v-model="form.fbUserId"
            placeholder="ID account Facebook"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="profileUrl" class="text-sm font-medium text-muted-foreground">
            URL profil account Facebook
          </label>
          <input
            v-model="form.profileUrl"
            placeholder="URL profil account Facebook"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <div class="flex items-center justify-end w-full">
            <button
              v-if="showCookiesField"
              type="button"
              class="text-[10px] p-1 rounded-md inline-flex items-center justify-center bg-destructive text-white gap-1"
              @click="showCookiesField = false"
            >
              <XIcon class="size-3" />
              Tutup
            </button>
            <button
              v-else
              type="button"
              class="text-[10px] p-1 rounded-md inline-flex items-center justify-center bg-emerald-600 text-white gap-1"
              @click="showCookiesField = true"
            >
              <EyeIcon class="size-3" />
              Tampilkan Cookies
            </button>
          </div>
          <textarea
            v-if="showCookiesField"
            v-model="form.cookiesText"
            rows="5"
            placeholder='Paste cookies JSON (EditThisCookie / Cookie-Editor): [{"name":"c_user","value":"...","domain":".facebook.com",...}]'
            class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          />
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
