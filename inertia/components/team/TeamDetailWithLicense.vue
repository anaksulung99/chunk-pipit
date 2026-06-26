<script lang="ts" setup>
import type { Data } from "@generated/data";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { Icon } from "@iconify/vue";
import { router } from "@inertiajs/vue3";
import { RefreshCcw, XIcon, CheckCircle } from "@lucide/vue";

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

const props = defineProps<{
  team: TeamRow;
  license: Data.License | null;
}>();

const openUpdate = ref(false);

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

function getRoleBadge(role: string) {
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

function setStatus(status: "active" | "inactive") {
  if (
    confirm(
      `Set status team ${status} untuk ${props.team.fullName || "Nama tidak tersedia"}?`
    )
  ) {
    router.put(
      `/teams/${props.team.id}/${status}/status`,
      {
        status,
      },
      { preserveScroll: true, preserveState: true }
    );
  }
}

function setStatusLicense(licenseId: string, status: string) {
  router.post(
    `/licenses/${licenseId}/status`,
    { status },
    { preserveScroll: true, preserveState: true }
  );
}

function resetDevices(licenseId: string) {
  if (
    !confirm("Reset binding perangkat untuk lisensi ini? Pengguna harus aktivasi ulang.")
  )
    return;
  router.post(
    `/licenses/${licenseId}/reset-devices`,
    {},
    { preserveScroll: true, preserveState: true }
  );
}
</script>

<template>
  <div class="space-y-6">
    <div v-if="!openUpdate" class="rounded-xl border border-border bg-card p-6 shadow-sm">
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div class="flex items-center gap-4">
          <!-- Avatar -->
          <div
            class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 text-2xl font-semibold text-emerald-600 dark:text-emerald-400"
          >
            {{ (team.fullName || "U").charAt(0).toUpperCase() }}
          </div>

          <div>
            <h2 class="text-xl font-bold text-foreground">
              {{ team.fullName || "Nama tidak tersedia" }}
            </h2>
            <div class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{{ team.email || "Email tidak tersedia" }}</span>
              <span class="hidden md:inline">•</span>
              <span
                :class="
                  cn(
                    `bg-${
                      getRoleBadge(team.role).color
                    }-500 text-white px-2 rounded-full text-xs`
                  )
                "
              >
                {{ getRoleBadge(team.role).label }}
              </span>
              <span
                :class="
                  cn(
                    `bg-${getLicenseStatusColor(
                      license?.status
                    )}-500 text-white px-2 rounded-full text-xs capitalize`
                  )
                "
              >
                {{ license?.status }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <Button size="sm" variant="outline">
            <Icon icon="lucide:mail" />
            Email
          </Button>
          <Button
            size="sm"
            class="bg-blue-600 hover:bg-blue-700 text-white"
            @click="openUpdate = true"
          >
            <Icon icon="lucide:pencil" />
            Edit
          </Button>
          <Button
            v-if="team.isActive"
            size="sm"
            variant="destructive"
            @click="setStatus('inactive')"
          >
            <Icon icon="material-symbols:block-outline" />
            Suspend
          </Button>
          <Button
            v-else
            size="sm"
            class="bg-emerald-600 hover:bg-emerald-700 text-white"
            @click="setStatus('active')"
          >
            <Icon icon="material-symbols:check-circle-unread-outline" />
            Reactivate
          </Button>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-3 border-t border-border pt-4 md:grid-cols-4">
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Role</div>
          <div class="text-sm font-medium">{{ getRoleBadge(team.role).label }}</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Status</div>
          <div class="text-sm font-medium capitalize">
            {{ team.isActive ? "Active" : "Inactive" }}
          </div>
        </div>
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Last Login</div>
          <div class="text-sm font-medium">{{ formatDate(team.lastLoginAt) }}</div>
        </div>
        <div class="text-center">
          <div class="text-xs text-muted-foreground">Licenses</div>
          <div class="text-sm font-medium">{{ license?.key || 0 }}</div>
        </div>
      </div>
    </div>
    <UpdateTeam
      v-if="openUpdate"
      :team="team"
      :license="license"
      @close="openUpdate = false"
    />

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
                  <span class="font-mono text-xs font-semibold text-foreground truncate">
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
                <div class="flex items-center gap-2">
                  <button
                    class="bg-amber-500 hover:bg-amber-600 text-white flex items-center rounded-full p-1 justify-center"
                    title="Reset Devices"
                    @click="resetDevices(license.id)"
                  >
                    <RefreshCcw class="size-4" />
                  </button>
                  <button
                    v-if="license.status === 'active'"
                    class="bg-red-500 hover:bg-red-600 text-white flex items-center rounded-full p-1 justify-center"
                    title="Suspend License"
                    @click="setStatusLicense(license.id, 'suspended')"
                  >
                    <XIcon class="size-4" />
                  </button>
                  <button
                    v-if="license.status === 'suspended'"
                    class="bg-emerald-500 hover:bg-emerald-600 text-white flex items-center rounded-full p-1 justify-center"
                    title="Reactivate License"
                    @click="setStatusLicense(license.id, 'active')"
                  >
                    <CheckCircle class="size-4" />
                  </button>
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

    <div
      v-else
      class="rounded-xl border border-dashed border-border bg-card p-12 text-center"
    >
      <Icon icon="lucide:key" class="mx-auto h-12 w-12 text-muted-foreground/50" />
      <h4 class="mt-3 text-sm font-medium text-foreground">No Licenses Found</h4>
      <p class="mt-1 text-sm text-muted-foreground">
        This member doesn't have any licenses yet.
      </p>
      <Button class="mt-4" size="sm" icon="i-lucide-plus"> Assign License </Button>
    </div>

    <div class="text-xs text-muted-foreground border-t border-border pt-4">
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span>Created: {{ formatDate(license?.createdAt as string) }}</span>
        <span>Expires: {{ formatDate(license?.expiresAt as string) }}</span>
      </div>
    </div>
  </div>
</template>
