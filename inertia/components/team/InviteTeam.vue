<script lang="ts" setup>
import { useForm } from "@inertiajs/vue3";
import { formatDate } from "~/utils/time";

type InviteUserDto = {
  fullName: string;
  email: string;
  password: string;
  role: typeof ROLES[number];
  maxDevices: number;
  expiresAt: Date | null;
};

const emits = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();

const props = defineProps<{
  open?: boolean;
}>();

const isOpen = useVModel(props, "open", emits, {
  passive: true,
});

const form = useForm<InviteUserDto>({
  fullName: "",
  email: "",
  password: "",
  role: "team",
  maxDevices: 1,
  expiresAt: null,
});

function submit() {
  form
    .transform((data) => ({
      ...data,
      expiresAt: data.expiresAt ? formatDate(data.expiresAt) : undefined,
    }))
    .post(`/teams`, {
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

const ROLES = ["superadmin", "team"] as const;
</script>

<template>
  <Modal
    v-model:open="isOpen"
    title="Invite Team Member"
    description="Invite a new team member to your team."
    @close="closeModal"
  >
    <template #content>
      <form class="space-y-4" @submit.prevent="submit">
        <div class="grid gap-2">
          <label for="fullName" class="text-sm font-medium text-muted-foreground">
            Nama Lengkap
          </label>
          <input
            v-model="form.fullName"
            placeholder="Nama Lengkap"
            autocomplete="name"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="email" class="text-sm font-medium text-muted-foreground">
            Email
          </label>
          <input
            v-model="form.email"
            type="email"
            placeholder="Email"
            autocomplete="email"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="password" class="text-sm font-medium text-muted-foreground">
            Password
          </label>
          <input
            v-model="form.password"
            type="password"
            placeholder="Password"
            autocomplete="password"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="role" class="text-sm font-medium text-muted-foreground">
            Role
          </label>
          <select v-model="form.role" class="bg-input capitalize">
            <option v-for="b in ROLES" :key="b" :value="b" class="capitalize">
              {{ b }}
            </option>
          </select>
        </div>
        <div class="grid gap-2">
          <label for="maxDevices" class="text-sm font-medium text-muted-foreground">
            Max Devices
          </label>
          <input
            v-model.number="form.maxDevices"
            type="number"
            placeholder="Max Devices"
            autocomplete="number"
            class="bg-input"
            required
          />
        </div>
        <div class="grid gap-2">
          <label for="expiresAt" class="text-sm font-medium text-muted-foreground">
            Expires At
          </label>
          <DatePicker
            v-model="form.expiresAt"
            placeholder="Expires At"
            :min-date="new Date()"
            :disabled="form.processing"
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
            {{ form.processing ? "Inviting..." : "Invite" }}
          </Button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<style scoped></style>
