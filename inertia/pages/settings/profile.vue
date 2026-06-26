<script setup lang="ts">
import type { Data } from "@generated/data";
import { Head, useForm, usePage } from "@inertiajs/vue3";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { SaveIcon, Loader2 } from "@lucide/vue";

const props = defineProps<{
  licenses: Data.License[];
}>();

const page = usePage<Data.SharedProps>();
const { confirm } = useGlobalAlert();

const user = computed(() => page.props.user as Data.User);

const profileForm = useForm({
  fullName: user.value?.fullName || "",
  email: user.value?.email || "",
});
const licenses = computed(() => {
  return props.licenses.map((l) => ({
    ...l,
  }));
});

const passwordForm = useForm({
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
});

const submitProfile = () => {
  confirm("Are you sure?", "Are you sure you want to save your profile?").then((val) => {
    if (val) {
      profileForm.put("/settings/profile", {
        preserveScroll: true,
        onSuccess: () => {
          profileForm.reset("email", "fullName");
        },
      });
    }
  });
};

const submitPassword = () => {
  confirm("Are you sure?", "Are you sure you want to update your password?").then(
    (val) => {
      if (val) {
        passwordForm.put("/settings/security", {
          preserveScroll: true,
          onSuccess: () => {
            passwordForm.reset("currentPassword", "newPassword", "confirmPassword");
          },
        });
      }
    }
  );
};

function formatDate(date: string | null | undefined): string {
  if (!date) return "-";
  return format(new Date(date), "dd MMM yyyy HH:mm", { locale: id });
}

function getStatusBadge(status: string) {
  const config: Record<string, { color: string; label: string }> = {
    active: { color: "success", label: "Active" },
    inactive: { color: "neutral", label: "Inactive" },
    expired: { color: "error", label: "Expired" },
    pending: { color: "warning", label: "Pending" },
    revoked: { color: "error", label: "Revoked" },
    verified: { color: "success", label: "Verified" },
  };
  return (
    config[status?.toLowerCase()] || { color: "neutral", label: status || "Unknown" }
  );
}

function getRoleBadge(role: string | null) {
  if (!role) return { color: "neutral", label: "Unknown" };
  const config: Record<string, { color: string; label: string }> = {
    superadmin: { color: "red", label: "Super Admin" },
    team: { color: "blue", label: "Team" },
  };
  return config[role?.toLowerCase()] || { color: "neutral", label: role || "Unknown" };
}
function getLicenseStatusColor(status?: string) {
  const colors: Record<string, "emerald" | "red" | "amber" | "neutral"> = {
    active: "emerald",
    suspended: "red",
    expired: "amber",
    revoked: "red",
  };
  return colors[status?.toLowerCase() || ""] || "neutral";
}
function getDeviceStatusColor(status?: string) {
  const colors: Record<string, "emerald" | "red"> = {
    active: "emerald",
    revoked: "red",
  };
  return colors[status?.toLowerCase() || ""] || "neutral";
}
</script>

<template>
  <Head title="Profile" />
  <App
    title="Profile & Security"
    description="Update your profile and security account settings"
  >
    <div class="rounded-xl border border-border bg-background p-6 shadow-sm">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex items-center gap-4">
          <div
            class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-2xl font-semibold text-emerald-600 dark:text-emerald-400"
          >
            {{ (user?.fullName || "U").charAt(0).toUpperCase() }}
          </div>

          <div>
            <h2 class="text-xl font-bold text-foreground">
              {{ user?.fullName || "Nama tidak tersedia" }}
            </h2>
            <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{{ user?.email || "Email tidak tersedia" }}</span>
              <span class="hidden md:inline">•</span>
              <span
                :class="
                  cn(
                    `bg-${
                      getRoleBadge(user?.role).color
                    }-500 text-white px-2 rounded-full text-xs`
                  )
                "
              >
                {{ getRoleBadge(user?.role).label }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-4">
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Role</div>
          <div class="text-sm font-medium">{{ getRoleBadge(user?.role).label }}</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Status</div>
          <div class="text-sm font-medium capitalize">
            {{ user?.isActive ? "Active" : "Inactive" }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Last Login</div>
          <div class="text-sm font-medium">{{ formatDate(user?.lastLoginAt) }}</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Total License</div>
          <div class="text-sm font-medium">{{ licenses.length || 0 }}</div>
        </div>
      </div>
    </div>
    <template v-for="license in props.licenses" :key="license.id">
      <div v-if="license" class="space-y-4">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div
            class="rounded-xl border border-border bg-background p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            <!-- License Header -->
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2">
                    <span
                      class="font-mono text-xs font-semibold text-foreground truncate"
                    >
                      {{ license.key || "N/A" }}
                    </span>
                    <span
                      :class="
                        cn(
                          `rounded-md text-[10px] font-medium bg-${getLicenseStatusColor(
                            license.status
                          )}-500 text-white px-2 rounded-full`
                        )
                      "
                    >
                      {{ getStatusBadge(license.status || "unknown").label }}
                    </span>
                  </div>
                </div>
                <div class="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                  <span class="capitalize">{{ license.plan || "No Plan" }}</span>
                  <span class="hidden sm:inline">•</span>
                  <span class="hidden sm:inline"
                    >{{ license.maxDevices || 0 }} devices</span
                  >
                </div>
              </div>
            </div>

            <!-- License Details -->
            <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
              <div>
                <span class="text-muted-foreground">Issued</span>
                <div class="font-medium">{{ formatDate(license.issuedAt) }}</div>
              </div>
              <div>
                <span class="text-muted-foreground">Expires</span>
                <div
                  class="font-medium"
                  :class="{
                    'text-red-600':
                      license.expiresAt && new Date(license.expiresAt) < new Date(),
                    'text-yellow-600':
                      license.expiresAt &&
                      new Date(license.expiresAt) <
                        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                  }"
                >
                  {{ formatDate(license.expiresAt) }}
                </div>
              </div>
              <div class="col-span-2">
                <span class="text-muted-foreground">Devices</span>
                <div class="font-medium">
                  {{ license.devices?.length || 0 }} / {{ license.maxDevices || 0 }}
                </div>
              </div>
            </div>

            <!-- Devices Progress -->
            <div v-if="license.maxDevices" class="mt-2">
              <div class="h-1.5 w-full rounded-full bg-muted">
                <div
                  class="h-1.5 rounded-full bg-emerald-500 transition-all"
                  :style="{
                    width: `${Math.min(
                      ((license.devices?.length || 0) / (license.maxDevices || 1)) * 100,
                      100
                    )}%`,
                  }"
                />
              </div>
            </div>

            <!-- Devices List (Collapsible) -->
            <div
              v-if="license.devices && license.devices.length > 0"
              class="mt-3 border-t border-border pt-3"
            >
              <div class="flex items-center justify-between text-xs">
                <span class="text-muted-foreground">Devices</span>
                <span class="font-medium">{{ license.devices.length }}</span>
              </div>
              <div class="mt-1 space-y-1 max-h-32 overflow-y-auto">
                <div
                  v-for="(device, dIdx) in license.devices.slice(0, 3)"
                  :key="device.id || dIdx"
                  class="flex items-center justify-between rounded bg-muted/30 px-2 py-1 text-xs"
                >
                  <span class="truncate font-mono">{{
                    device.deviceName || device.deviceId || "Unknown"
                  }}</span>
                  <span
                    :class="
                      cn(
                        `rounded-md text-[10px] font-medium bg-${getDeviceStatusColor(
                          device.status
                        )}-500 text-white px-2 rounded-full`
                      )
                    "
                  >
                    {{ device.status || "Unknown" }}
                  </span>
                </div>
                <div
                  v-if="license.devices.length > 3"
                  class="text-center text-xs text-muted-foreground"
                >
                  +{{ license.devices.length - 3 }} more devices
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <div class="rounded-lg bg-background p-4 space-y-4">
      <div class="space-y-2">
        <h3
          class="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
        >
          Update Profile
        </h3>
        <p class="text-sm text-muted-foreground">Update your profile information.</p>
      </div>
      <form class="space-y-4" @submit.prevent="submitProfile">
        <div class="grid gap-2">
          <label for="fullName" class="text-sm font-medium text-foreground">
            Full Name
          </label>
          <input
            id="fullName"
            v-model="profileForm.fullName"
            type="text"
            placeholder="Full Name"
            required
            autocomplete="name"
            :disabled="profileForm.processing"
            class="bg-input"
          />
          <p v-if="profileForm.errors.fullName" class="text-destructive text-sm">
            {{ profileForm.errors.fullName }}
          </p>
        </div>
        <div class="grid gap-2">
          <label for="email" class="text-sm font-medium text-foreground"> Email </label>
          <input
            id="email"
            v-model="profileForm.email"
            type="email"
            placeholder="Email"
            required
            autocomplete="email"
            :disabled="profileForm.processing"
            class="bg-input"
          />
          <p v-if="profileForm.errors.email" class="text-destructive text-sm">
            {{ profileForm.errors.email }}
          </p>
        </div>
        <div class="flex items-center justify-end">
          <Button
            type="submit"
            class="bg-emerald-700 dark:bg-emerald-600 text-white px-4 py-2 rounded-md"
            :disabled="profileForm.processing"
          >
            <Loader2 v-if="profileForm.processing" class="animate-spin" />
            <SaveIcon v-else />
            {{ profileForm.processing ? "Saving..." : "Save" }}
          </Button>
        </div>
      </form>
    </div>
    <div class="rounded-lg bg-background p-4 space-y-4">
      <div class="space-y-2">
        <h3
          class="text-lg font-semibold leading-6 text-neutral-900 dark:text-neutral-100"
        >
          Update Password
        </h3>
        <p class="text-sm text-muted-foreground">Update your password.</p>
      </div>
      <form class="space-y-4" @submit.prevent="submitPassword">
        <div class="grid gap-2">
          <label for="currentPassword" class="text-sm font-medium text-foreground">
            Current Password
          </label>
          <input
            id="currentPassword"
            v-model="passwordForm.currentPassword"
            type="password"
            placeholder="Current Password"
            required
            autocomplete="current-password"
            :disabled="passwordForm.processing"
            class="bg-input"
          />
          <p v-if="passwordForm.errors.currentPassword" class="text-destructive text-sm">
            {{ passwordForm.errors.currentPassword }}
          </p>
        </div>
        <div class="grid gap-2">
          <label for="newPassword" class="text-sm font-medium text-foreground">
            New Password
          </label>
          <input
            id="newPassword"
            v-model="passwordForm.newPassword"
            type="password"
            placeholder="New Password"
            required
            autocomplete="new-password"
            :disabled="passwordForm.processing"
            class="bg-input"
          />
          <p v-if="passwordForm.errors.newPassword" class="text-destructive text-sm">
            {{ passwordForm.errors.newPassword }}
          </p>
        </div>
        <div class="grid gap-2">
          <label for="confirmPassword" class="text-sm font-medium text-foreground">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            v-model="passwordForm.confirmPassword"
            type="password"
            placeholder="Confirm Password"
            required
            autocomplete="confirm-password"
            :disabled="passwordForm.processing"
            class="bg-input"
          />
          <p v-if="passwordForm.errors.confirmPassword" class="text-destructive text-sm">
            {{ passwordForm.errors.confirmPassword }}
          </p>
        </div>
        <div class="flex items-center justify-end">
          <Button
            type="submit"
            class="bg-emerald-700 dark:bg-emerald-600 text-white px-4 py-2 rounded-md"
            :disabled="passwordForm.processing"
          >
            <Loader2 v-if="passwordForm.processing" class="animate-spin" />
            <SaveIcon v-else />
            {{ passwordForm.processing ? "Updating..." : "Update" }}
          </Button>
        </div>
      </form>
    </div>
  </App>
</template>
