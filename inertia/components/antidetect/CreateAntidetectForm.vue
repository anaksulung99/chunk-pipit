<script lang="ts" setup>
const emits = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "close"): void;
}>();
const props = defineProps<{
  open: boolean;
  proxies?: {
    id: string;
    label: string;
    status: string | null;
    country: string | null;
  }[];
}>();

const {
  form,
  availableOsOptions,
  availableOsVersionOptions,
  availableBrowserOptions,
  availableBrowserVersionOptions,
  applyPresets,
  generateUa,
  toPayload,
} = useAntidetectForm();

const isOpen = useVModel(props, "open", emits, {
  passive: true,
});

const submit = () => {
  form
    .transform(() => toPayload())
    .post("/antidetects", {
      preserveScroll: true,
      preserveState: false,
      onSuccess: () => {
        form.reset();
        applyPresets();
        isOpen.value = false;
        emits("close");
      },
    });
};

const ENGINES = ["chrome", "firefox", "webkit"];
const DEVICE_TYPES = ["desktop", "mobile"];
const CANVAS_MODES = ["off", "noise", "block"];

function onLanguageChange(e: Event) {
  const lang = (e.target as HTMLSelectElement).value;
  form.locale = lang;
}
</script>

<template>
  <Modal
    v-model:open="isOpen"
    title="Create Antidetect"
    description="Buat metadata antidetect baru."
    @close="emits('close')"
  >
    <template #content>
      <form class="space-y-4" @submit.prevent="submit">
        <div
          class="space-y-4 max-h-[calc(100vh-400px)] overflow-y-auto rounded-md border border-border p-2"
        >
          <div class="grid gap-2">
            <label for="name" class="text-sm font-medium text-muted-foreground">
              Nama antidetect
            </label>
            <input
              v-model="form.name"
              placeholder="Nama antidetect"
              class="bg-input"
              required
            />
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="engine" class="text-sm font-medium text-muted-foreground">
                Engine
              </label>
              <select v-model="form.engine" class="bg-input capitalize">
                <option v-for="o in ENGINES" :key="o" :value="o" class="capitalize">
                  {{ o }}
                </option>
              </select>
            </div>
            <div class="grid gap-2">
              <label for="deviceType" class="text-sm font-medium text-muted-foreground">
                Device Type
              </label>
              <select v-model="form.deviceType" class="bg-input capitalize">
                <option v-for="o in DEVICE_TYPES" :key="o" :value="o" class="capitalize">
                  {{ o }}
                </option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="osName" class="text-sm font-medium text-muted-foreground">
                OS Name
              </label>
              <select v-model="form.osName" class="bg-input capitalize">
                <option
                  v-for="o in availableOsOptions"
                  :key="o"
                  :value="o"
                  class="capitalize"
                >
                  {{ o }}
                </option>
              </select>
            </div>
            <div class="grid gap-2">
              <label for="osVersion" class="text-sm font-medium text-muted-foreground">
                OS Version
              </label>
              <select v-model="form.osVersion" class="bg-input capitalize">
                <option
                  v-for="o in availableOsVersionOptions"
                  :key="o"
                  :value="o"
                  class="capitalize"
                >
                  {{ o }}
                </option>
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="browserName" class="text-sm font-medium text-muted-foreground">
                Browser Name
              </label>
              <select v-model="form.browserName" class="bg-input capitalize">
                <option
                  v-for="o in availableBrowserOptions"
                  :key="o"
                  :value="o"
                  class="capitalize"
                >
                  {{ o }}
                </option>
              </select>
            </div>
            <div class="grid gap-2">
              <label
                for="browserVersion"
                class="text-sm font-medium text-muted-foreground"
              >
                Browser Version
              </label>
              <select v-model="form.browserVersion" class="bg-input capitalize">
                <option
                  v-for="o in availableBrowserVersionOptions"
                  :key="o"
                  :value="o"
                  class="capitalize"
                >
                  {{ o }}
                </option>
              </select>
            </div>
          </div>
          <div class="space-y-2">
            <label for="userAgent" class="text-sm font-medium text-muted-foreground">
              User Agent String
            </label>
            <div class="grid gap-0.5">
              <div class="flex items-center justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  class="text-xs"
                  @click="generateUa"
                >
                  Auto Generate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  class="ml-2 text-xs"
                  @click="applyPresets"
                >
                  Apply Full Preset
                </Button>
              </div>
              <textarea
                v-model="form.userAgent"
                rows="5"
                placeholder="Paste user agent string"
                class="w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="language" class="text-sm font-medium text-muted-foreground">
                Language
              </label>
              <select
                v-model="form.language"
                class="bg-input capitalize"
                @change="onLanguageChange"
              >
                <option
                  v-for="o in IsoLanguages"
                  :key="o.code"
                  :value="o.code"
                  class="capitalize"
                >
                  {{ o.name }}
                </option>
              </select>
            </div>
            <div class="grid gap-2">
              <label for="timezone" class="text-sm font-medium text-muted-foreground">
                Timezone
              </label>
              <select v-model="form.timezone" class="bg-input capitalize">
                <option
                  v-for="o in TimezoneList"
                  :key="o.zone"
                  :value="o.zone"
                  class="capitalize"
                >
                  {{ o.name }}
                </option>
              </select>
            </div>
          </div>
          <div class="grid gap-2">
            <label for="proxyId" class="text-sm font-medium text-muted-foreground">
              Proxy
            </label>
            <select v-model="form.proxyId" class="bg-input">
              <option :value="null">Tanpa proxy</option>
              <option v-for="proxy in props.proxies ?? []" :key="proxy.id" :value="proxy.id">
                {{ proxy.label }}
                {{ proxy.country ? ` · ${proxy.country}` : "" }}
                {{ proxy.status ? ` · ${proxy.status}` : "" }}
              </option>
            </select>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="screenHeight" class="text-sm font-medium text-muted-foreground">
                Screen Height
              </label>
              <input
                v-model.number="form.screenHeight"
                type="number"
                min="1"
                placeholder="Screen Height"
                class="bg-input"
                required
              />
            </div>
            <div class="grid gap-2">
              <label for="screenWidth" class="text-sm font-medium text-muted-foreground">
                Screen Width
              </label>
              <input
                v-model.number="form.screenWidth"
                type="number"
                min="1"
                placeholder="Screen Width"
                class="bg-input"
                required
              />
            </div>
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div class="grid gap-2">
              <label
                for="deviceScaleFactor"
                class="text-sm font-medium text-muted-foreground"
              >
                DPR / Scale
              </label>
              <input
                v-model.number="form.deviceScaleFactor"
                type="number"
                min="0.1"
                step="0.1"
                class="bg-input"
                required
              />
            </div>
            <label
              class="mt-7 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <input v-model="form.isMobile" type="checkbox" />
              Is Mobile
            </label>
            <label
              class="mt-7 flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
            >
              <input v-model="form.hasTouch" type="checkbox" />
              Has Touch
            </label>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="canvasMode" class="text-sm font-medium text-muted-foreground">
                Canvas Mode
              </label>
              <select v-model="form.canvasMode" class="bg-input capitalize">
                <option v-for="mode in CANVAS_MODES" :key="mode" :value="mode">
                  {{ mode }}
                </option>
              </select>
            </div>
            <div class="grid gap-2">
              <label for="canvasSeed" class="text-sm font-medium text-muted-foreground">
                Canvas Seed
              </label>
              <input
                v-model.number="form.canvasSeed"
                type="number"
                min="0"
                placeholder="Auto seed"
                class="bg-input"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label for="webglVendor" class="text-sm font-medium text-muted-foreground">
                WebGL Vendor
              </label>
              <input v-model="form.webglVendor" class="bg-input" placeholder="WebGL vendor" />
            </div>
            <div class="grid gap-2">
              <label for="webglRenderer" class="text-sm font-medium text-muted-foreground">
                WebGL Renderer
              </label>
              <input
                v-model="form.webglRenderer"
                class="bg-input"
                placeholder="WebGL renderer"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <div class="grid gap-2">
              <label
                for="hardwareConcurrency"
                class="text-sm font-medium text-muted-foreground"
              >
                CPU Threads
              </label>
              <input
                v-model.number="form.hardwareConcurrency"
                type="number"
                min="1"
                class="bg-input"
              />
            </div>
            <div class="grid gap-2">
              <label for="deviceMemory" class="text-sm font-medium text-muted-foreground">
                Device Memory GB
              </label>
              <input
                v-model.number="form.deviceMemory"
                type="number"
                min="1"
                class="bg-input"
              />
            </div>
          </div>
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
            {{ form.processing ? "Creating..." : "Create" }}
          </Button>
        </div>
      </form>
    </template>
  </Modal>
</template>

<style scoped></style>
