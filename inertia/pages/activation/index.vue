<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { router, usePage } from "@inertiajs/vue3";
import type { Data } from "@generated/data";
import BlankLayout from "~/layouts/blank.vue";

defineOptions({ layout: BlankLayout });

type DeviceInfo = {
  id: string;
  name: string;
  os: string;
  osVersion?: string;
  appVersion?: string;
};

const page = usePage<Data.SharedProps>();

type ActivationBridge = {
  isElectron?: boolean;
  activation?: {
    getStored: () => Promise<{ licenseKey?: string }>;
    setStored: (data: { licenseKey?: string }) => Promise<unknown>;
    clearStored: () => Promise<unknown>;
  };
};

const email = ref("");
const licenseKey = ref("");
const loading = ref(false);
const verifying = ref(false);
const error = ref<string | null>(null);
const device = reactive<DeviceInfo>({
  id: "",
  name: "",
  os: "",
  osVersion: "",
  appVersion: "",
});

const electron = (window as any).electronAPI as ActivationBridge | undefined;

const ERROR_MESSAGES: Record<string, string> = {
  E_LICENSE_NOT_FOUND: "Lisensi tidak ditemukan. Periksa kembali license key.",
  E_LICENSE_INACTIVE: "Lisensi tidak aktif atau sudah kedaluwarsa.",
  E_EMAIL_MISMATCH: "Email tidak cocok dengan lisensi ini.",
  E_USER_INACTIVE: "Akun dinonaktifkan. Hubungi superadmin.",
  E_DEVICE_REVOKED: "Akses perangkat ini telah dicabut. Hubungi superadmin.",
  E_DEVICE_LIMIT:
    "Lisensi sudah aktif di perangkat lain. Minta superadmin mereset binding.",
};

function detectOs(): string {
  const p = String(
    (navigator as any).userAgentData?.platform || navigator.platform || ""
  ).toLowerCase();
  if (p.includes("win")) return "windows";
  if (p.includes("mac")) return "macos";
  if (p.includes("linux")) return "linux";
  return p || "unknown";
}

/**
 * In Electron the main process injects window.__APP_DEVICE__ (stable hardware
 * id). In a plain browser we fall back to a persisted random dev id so the
 * page stays testable.
 */
function resolveDevice(): DeviceInfo {
  const injected = (window as any).__APP_DEVICE__ as DeviceInfo | undefined;
  if (injected?.id) return injected;

  let id = localStorage.getItem("fb_dev_device_id");
  if (!id) {
    id = "dev-" + crypto.randomUUID().replace(/-/g, "");
    localStorage.setItem("fb_dev_device_id", id);
  }
  return { id, name: "Dev Browser", os: detectOs(), osVersion: "", appVersion: "dev" };
}

function shortId(id: string) {
  return id.length > 16 ? `${id.slice(0, 8)}…${id.slice(-6)}` : id;
}

async function submit() {
  if (loading.value) return;
  error.value = null;
  loading.value = true;
  try {
    const res = await fetch("/api/activation/activate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        email: email.value.trim(),
        licenseKey: licenseKey.value.trim(),
        deviceId: device.id,
        deviceName: device.name || undefined,
        os: device.os,
        osVersion: device.osVersion || undefined,
        appVersion: device.appVersion || undefined,
      }),
    });

    const data = await res.json().catch(() => ({} as any));

    if (res.ok && data.ok) {
      // Persist the license key so the app can re-verify online on next launch.
      await electron?.activation
        ?.setStored({ licenseKey: licenseKey.value.trim() })
        .catch(() => {});
      router.visit("/");
      return;
    }

    if (res.status === 422 && Array.isArray(data.errors)) {
      error.value = data.errors.map((e: any) => e.message).join(" · ");
    } else {
      error.value =
        ERROR_MESSAGES[data.code] || data.message || "Aktivasi gagal. Coba lagi.";
    }
  } catch {
    error.value = "Tidak dapat terhubung ke server. Periksa koneksi internet.";
  } finally {
    loading.value = false;
  }
}

async function autoVerify(key: string) {
  verifying.value = true;
  error.value = null;
  try {
    const res = await fetch("/api/activation/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ licenseKey: key.trim(), deviceId: device.id }),
    });
    const data = await res.json().catch(() => ({} as any));
    if (res.ok && data.ok) {
      router.visit("/");
      return;
    }
    // Verify failed (revoked / expired / moved machine) — fall back to the form.
    error.value =
      ERROR_MESSAGES[data.code] || data.message || "Verifikasi lisensi gagal.";
  } catch {
    error.value = "Tidak dapat terhubung ke server. Periksa koneksi internet.";
  } finally {
    verifying.value = false;
  }
}

onMounted(async () => {
  if (page.props.user) {
    router.visit("/");
    return;
  }
  Object.assign(device, resolveDevice());

  // In Electron: online-required re-verification on every launch using the
  // stored license key (session cookies are cleared by the main process).
  if (electron?.isElectron && electron.activation) {
    try {
      const stored = await electron.activation.getStored();
      if (stored?.licenseKey) {
        licenseKey.value = stored.licenseKey;
        await autoVerify(stored.licenseKey);
      }
    } catch {
      // ignore — show the manual form
    }
  }
});
</script>

<template>
  <Guest
    title="Aktivasi Perangkat"
    description="Masukkan email &amp; license key untuk mengaktifkan aplikasi di perangkat ini."
  >
    <form
      class="space-y-5 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-xl"
      @submit.prevent="submit"
    >
      <div
        v-if="verifying"
        class="rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200"
      >
        Memverifikasi lisensi…
      </div>

      <div
        v-if="error"
        class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
      >
        {{ error }}
      </div>

      <div class="space-y-1.5">
        <label for="email" class="text-sm font-medium text-muted-foreground">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="username"
          required
          placeholder="nama@email.com"
          class="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div class="space-y-1.5">
        <label for="license" class="text-sm font-medium text-muted-foreground"
          >License Key</label
        >
        <input
          id="license"
          v-model="licenseKey"
          type="text"
          required
          spellcheck="false"
          placeholder="FBA-XXXX-XXXX-XXXX-XXXX"
          class="bg-input"
        />
      </div>

      <button type="submit" :disabled="loading || verifying" class="bg-input">
        {{ verifying ? "Memverifikasi…" : loading ? "Mengaktifkan…" : "Aktivasi" }}
      </button>

      <p v-if="device.id" class="text-center text-xs text-neutral-500">
        Perangkat: <span class="font-mono">{{ shortId(device.id) }}</span> ·
        {{ device.os }}
      </p>
    </form>

    <p class="mt-6 text-center text-xs text-neutral-600">
      1 email · 1 lisensi · 1 perangkat. Hubungi superadmin untuk reset perangkat.
    </p>
  </Guest>
</template>
