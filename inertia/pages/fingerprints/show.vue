<script lang="ts" setup>
import { computed } from "vue";
import { Head } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import { ArrowLeft, Fingerprint, Activity, LayoutList, ExternalLink } from "@lucide/vue";
import { cn } from "~/lib/utils";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type FingerprintDetail = {
  id: string;
  name: string;
  deviceType: string;
  osType: string;
  osVersion: string | null;
  browserType: string;
  browserVersion: string | null;
  userAgent: string | null;
  screenWidth: number | null;
  screenHeight: number | null;
  webglVendor: string | null;
  webglRenderer: string | null;
  canvasNoise: number | null;
  locale: string | null;
  timezone: string | null;
  clientHints: JsonValue;
  rawFingerprint: JsonValue;
  createdAt: string | null;
  updatedAt: string | null;
};

type CampaignStats = {
  total: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  draft: number;
  successRate: number;
  lastUsedAt: string | null;
};

type RelatedCampaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  maxAccounts: number;
  maxConcurrency: number;
  useProxy: boolean;
  accountsAssigned: number;
  groupsAssigned: number;
  createdAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  updatedAt: string | null;
};

type CampaignTypeAnalysis = {
  type: string;
  total: number;
  draft: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  accountsAssigned: number;
  groupsAssigned: number;
  lastActivityAt: string | null;
};

const props = defineProps<{
  fingerprint: FingerprintDetail;
  campaignStats: CampaignStats;
  recentCampaigns: RelatedCampaign[];
  campaignTypeAnalysis: CampaignTypeAnalysis[];
}>();

const statusBadge = (status: string) =>
  ({
    draft: "bg-muted text-muted-foreground",
    running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
  }[status] ?? "bg-muted text-muted-foreground");

const typeLabel = (type: string) =>
  ({ scrape_group: "Scrape Group", auto_share: "Auto Share", auto_join: "Auto Join" }[
    type
  ] ?? type);

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}

function fmtPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function fmtScreen(width: number | null, height: number | null) {
  return width && height ? `${width} × ${height}` : "—";
}

function fmtJson(value: JsonValue) {
  return value ? JSON.stringify(value, null, 2) : "—";
}

const overviewCards = computed(() => [
  {
    label: "Total Campaign",
    value: props.campaignStats.total.toLocaleString("id-ID"),
    tone: "text-foreground",
  },
  {
    label: "Campaign Running",
    value: props.campaignStats.running.toLocaleString("id-ID"),
    tone: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Campaign Selesai",
    value: props.campaignStats.completed.toLocaleString("id-ID"),
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Campaign Failed",
    value: props.campaignStats.failed.toLocaleString("id-ID"),
    tone: "text-red-600 dark:text-red-400",
  },
  {
    label: "Success Rate",
    value: fmtPercent(props.campaignStats.successRate),
    tone: "text-foreground",
  },
  {
    label: "Terakhir Dipakai",
    value: fmtDate(props.campaignStats.lastUsedAt),
    tone: "text-foreground",
  },
]);
</script>

<template>
  <Head :title="`Fingerprint · ${fingerprint.name}`" />
  <App
    :title="fingerprint.name"
    :description="`Fingerprint ${fingerprint.browserType} di ${fingerprint.osType} untuk analisa campaign terkait.`"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Link
          href="/fingerprints"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft class="size-4" /> Kembali
        </Link>
      </div>
    </template>

    <div class="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-start gap-3">
          <div
            class="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <Fingerprint class="size-5" />
          </div>
          <div class="space-y-1">
            <h2 class="text-lg font-semibold">{{ fingerprint.name }}</h2>
            <p class="text-sm text-muted-foreground">
              {{ fingerprint.browserType }} {{ fingerprint.browserVersion || "—" }} ·
              {{ fingerprint.osType }} {{ fingerprint.osVersion || "—" }} ·
              {{ fingerprint.deviceType }}
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="card in overviewCards"
            :key="card.label"
            class="rounded-lg border border-border bg-background p-4"
          >
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ card.label }}
            </div>
            <div class="mt-2 text-lg font-semibold" :class="card.tone">
              {{ card.value }}
            </div>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              User Agent
            </div>
            <p class="mt-2 break-all font-mono text-xs text-muted-foreground">
              {{ fingerprint.userAgent || "—" }}
            </p>
          </div>
          <div class="rounded-lg border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              WebGL & Screen
            </div>
            <div class="mt-2 space-y-1 text-sm">
              <p>
                <span class="text-muted-foreground">Screen:</span>
                {{ fmtScreen(fingerprint.screenWidth, fingerprint.screenHeight) }}
              </p>
              <p>
                <span class="text-muted-foreground">Vendor:</span>
                {{ fingerprint.webglVendor || "—" }}
              </p>
              <p>
                <span class="text-muted-foreground">Renderer:</span>
                {{ fingerprint.webglRenderer || "—" }}
              </p>
              <p>
                <span class="text-muted-foreground">Canvas Noise:</span>
                {{ fingerprint.canvasNoise ?? "—" }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Detail Fingerprint</h2>
        </div>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm">
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">ID</dt>
            <dd class="mt-1 break-all font-mono text-xs">{{ fingerprint.id }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Dibuat</dt>
            <dd class="mt-1">{{ fmtDate(fingerprint.createdAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Terakhir Diperbarui</dt>
            <dd class="mt-1">{{ fmtDate(fingerprint.updatedAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Campaign Draft / Pause</dt>
            <dd class="mt-1">{{ campaignStats.draft }} / {{ campaignStats.paused }}</dd>
          </div>
        </dl>
      </section>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <LayoutList class="size-4 text-primary" />
          <div>
            <h2 class="text-base font-semibold">Client Hints</h2>
            <p class="text-xs text-muted-foreground">
              Snapshot metadata browser yang tersimpan di fingerprint ini.
            </p>
          </div>
        </div>
        <pre class="mt-4 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{{
          fmtJson(fingerprint.clientHints)
        }}</pre>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <LayoutList class="size-4 text-primary" />
          <div>
            <h2 class="text-base font-semibold">Raw Fingerprint</h2>
            <p class="text-xs text-muted-foreground">
              Payload teknis hasil generator untuk analisa detail.
            </p>
          </div>
        </div>
        <pre class="mt-4 max-h-80 overflow-auto rounded-md bg-muted p-3 text-xs">{{
          fmtJson(fingerprint.rawFingerprint)
        }}</pre>
      </section>
    </div>

    <div class="grid gap-4">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">Riwayat Campaign Terkait</h2>
            <p class="text-xs text-muted-foreground">
              Campaign terbaru yang memakai fingerprint ini.
            </p>
          </div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ recentCampaigns.length }} row terbaru
          </span>
        </div>

        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground">
              <tr class="border-b border-border">
                <th class="px-3 py-2.5 text-left font-medium">Campaign</th>
                <th class="px-3 py-2.5 text-left font-medium">Tipe</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                <th class="px-3 py-2.5 text-right font-medium">Akun</th>
                <th class="px-3 py-2.5 text-right font-medium">Group</th>
                <th class="px-3 py-2.5 text-left font-medium">Aktivitas</th>
                <th class="px-3 py-2.5 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="recentCampaigns.length === 0">
                <td colspan="7" class="px-3 py-10 text-center text-muted-foreground">
                  Fingerprint ini belum dipakai oleh campaign mana pun.
                </td>
              </tr>
              <tr
                v-for="row in recentCampaigns"
                :key="row.id"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-3 py-2.5">
                  <div class="font-medium">{{ row.name }}</div>
                  <div class="text-xs text-muted-foreground">
                    Dibuat {{ fmtDate(row.createdAt) }}
                  </div>
                </td>
                <td class="px-3 py-2.5">{{ typeLabel(row.type) }}</td>
                <td class="px-3 py-2.5">
                  <span
                    :class="
                      cn(
                        'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                        statusBadge(row.status)
                      )
                    "
                  >
                    {{ row.status }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right">{{ row.accountsAssigned }}</td>
                <td class="px-3 py-2.5 text-right">{{ row.groupsAssigned }}</td>
                <td class="px-3 py-2.5">
                  <div>{{ fmtDate(row.updatedAt) }}</div>
                  <div class="text-xs text-muted-foreground">
                    {{ row.useProxy ? "Proxy aktif" : "Tanpa proxy" }} · concurrency
                    {{ row.maxConcurrency }}
                  </div>
                </td>
                <td class="px-3 py-2.5 text-right">
                  <Link
                    :href="`/campaigns/${row.id}`"
                    class="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
                  >
                    Buka <ExternalLink class="size-3.5" />
                  </Link>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h2 class="text-base font-semibold">Analisa Campaign Per Tipe</h2>
            <p class="text-xs text-muted-foreground">
              Distribusi status campaign untuk fingerprint ini berdasarkan tipe
              automation.
            </p>
          </div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ campaignTypeAnalysis.length }} tipe
          </span>
        </div>

        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground">
              <tr class="border-b border-border">
                <th class="px-3 py-2.5 text-left font-medium">Tipe</th>
                <th class="px-3 py-2.5 text-right font-medium">Total</th>
                <th class="px-3 py-2.5 text-right font-medium">Draft</th>
                <th class="px-3 py-2.5 text-right font-medium">Running</th>
                <th class="px-3 py-2.5 text-right font-medium">Paused</th>
                <th class="px-3 py-2.5 text-right font-medium">Completed</th>
                <th class="px-3 py-2.5 text-right font-medium">Failed</th>
                <th class="px-3 py-2.5 text-right font-medium">Akun</th>
                <th class="px-3 py-2.5 text-right font-medium">Group</th>
                <th class="px-3 py-2.5 text-left font-medium">Aktivitas Terakhir</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="campaignTypeAnalysis.length === 0">
                <td colspan="10" class="px-3 py-10 text-center text-muted-foreground">
                  Belum ada data campaign untuk dianalisa.
                </td>
              </tr>
              <tr
                v-for="row in campaignTypeAnalysis"
                :key="row.type"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-3 py-2.5 font-medium">{{ typeLabel(row.type) }}</td>
                <td class="px-3 py-2.5 text-right">{{ row.total }}</td>
                <td class="px-3 py-2.5 text-right">{{ row.draft }}</td>
                <td class="px-3 py-2.5 text-right text-blue-600 dark:text-blue-400">
                  {{ row.running }}
                </td>
                <td class="px-3 py-2.5 text-right text-amber-600 dark:text-amber-400">
                  {{ row.paused }}
                </td>
                <td class="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                  {{ row.completed }}
                </td>
                <td class="px-3 py-2.5 text-right text-red-600 dark:text-red-400">
                  {{ row.failed }}
                </td>
                <td class="px-3 py-2.5 text-right">{{ row.accountsAssigned }}</td>
                <td class="px-3 py-2.5 text-right">{{ row.groupsAssigned }}</td>
                <td class="px-3 py-2.5">{{ fmtDate(row.lastActivityAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </App>
</template>
