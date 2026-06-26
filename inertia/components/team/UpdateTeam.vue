<script lang="ts" setup>
import { useForm } from "@inertiajs/vue3";
import { formatDate, parseDate } from "~/utils/time";

type TeamRow = {
  id: string;
  fullName: string | null;
  email: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
type LicenseRow = {
  id: string;
  key: string;
  status: string;
  maxDevices: number;
  plan: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
  createdAt: string | null;
  devices?: any[];
};

type UpdateForm = {
  maxDevices?: number;
  email: string;
  fullName: string | null;
  role: "superadmin" | "team";
};
const emits = defineEmits<{
  (e: "close"): void;
}>();

const props = defineProps<{
  team?: TeamRow | null;
  license?: LicenseRow | null;
}>();

const expiresAtDate = ref<Date | null>(
  props.license?.expiresAt ? parseDate(props.license.expiresAt.slice(0, 10)) : null
);

const form = useForm<UpdateForm>({
  maxDevices: props.license?.maxDevices ?? 1,
  email: props.team?.email ?? "",
  fullName: props.team?.fullName ?? "",
  role: (props.team?.role as "superadmin" | "team") ?? "team",
});

watch(
  () => props.team,
  (newTeam) => {
    form.fullName = newTeam?.fullName || "";
    form.email = newTeam?.email || "";
    form.role = (newTeam?.role as "superadmin" | "team") ?? "team";
  },
  { immediate: true }
);
watch(
  () => props.license,
  (newLic) => {
    form.maxDevices = newLic?.maxDevices ?? 1;
    expiresAtDate.value = newLic?.expiresAt
      ? parseDate(newLic.expiresAt.slice(0, 10))
      : null;
  },
  { immediate: true }
);

function submit() {
  form
    .transform((data) => ({
      ...data,
      expiresAt: expiresAtDate.value ? formatDate(expiresAtDate.value) : undefined,
    }))
    .put(`/teams/${props.team?.id}/update`, {
      preserveScroll: true,
      onSuccess: () => {
        form.reset();
        emits("close");
      },
    });
}

const ROLES = ["superadmin", "team"] as const;
</script>

<template>
  <div class="rounded-xl border border-border bg-card p-6 shadow-sm">
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
        <label for="role" class="text-sm font-medium text-muted-foreground"> Role </label>
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
          v-model="expiresAtDate"
          placeholder="Expires At"
          :disabled="form.processing"
        />
      </div>

      <div class="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          :disabled="form.processing"
          @click="emits('close')"
        >
          Close
        </Button>
        <Button
          type="submit"
          class="bg-emerald-600 dark:bg-emerald-500 text-white"
          :disabled="form.processing"
        >
          {{ form.processing ? "Uploading..." : "Update" }}
        </Button>
      </div>
    </form>
  </div>
</template>

<style scoped></style>
