<script setup lang="ts">
import { computed, ref } from "vue";
import { Head, router } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import { cn } from "~/lib/utils";
import {
  RefreshCcw,
  Download,
  Megaphone,
  Cookie,
  Users,
  ShieldCheck,
  Contact2Icon,
  Fingerprint,
  Activity,
  TrendingUp,
  BarChart3,
  CalendarDays,
  HatGlasses,
} from "@lucide/vue";

type Tally = Record<string, number>;
type DailyActivityPoint = {
  date: string;
  label: string;
  total: number;
  success: number;
  failed: number;
};
type ActionBreakdownRow = {
  action: string;
  total: number;
  success: number;
  failed: number;
  lastAt: string | null;
};
type CampaignTypeBreakdownRow = {
  type: string;
  total: number;
  draft: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
};
type ChartPoint = DailyActivityPoint & {
  x: number;
  totalY: number;
  successY: number;
  failedY: number;
};

const props = defineProps<{
  stats: {
    campaigns: { total: number; byStatus: Tally };
    groups: { total: number; byType: Tally };
    accounts: { total: number; byStatus: Tally };
    proxies: { total: number; byStatus: Tally };
    fingerprints: number;
    facebookProfiles: number;
    profileLifecycle: Tally;
    profileRelationship: Tally;
    antidetects: number;
    today: { total: number; success: number; failed: number };
  };
  running: { id: string; name: string; type: string; total: number; done: number }[];
  filters: {
    startDate: string;
    endDate: string;
  };
  analytics: {
    windowLabel: string;
    totalLogVolume: number;
    successLogVolume: number;
    failedLogVolume: number;
    successRate: number;
    dailyActivity: DailyActivityPoint[];
    actionBreakdown: ActionBreakdownRow[];
    campaignTypeBreakdown: CampaignTypeBreakdownRow[];
  };
  recentLogs: {
    id: string;
    action: string;
    status: string;
    message: string | null;
    campaignId: string;
    campaignName: string;
    createdAt: string | null;
  }[];
}>();

const rangeDate = ref<DateRange>(
  props.filters.startDate && props.filters.endDate
    ? [parseDate(props.filters.startDate), parseDate(props.filters.endDate)]
    : null
);

const n = (t: Tally, k: string) => t[k] ?? 0;

const kpis = [
  {
    label: "Campaigns",
    value: props.stats.campaigns.total,
    sub: `${n(props.stats.campaigns.byStatus, "running")} running`,
    icon: Megaphone,
    color: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Akun Aktif",
    value: n(props.stats.accounts.byStatus, "active"),
    sub: `dari ${props.stats.accounts.total} akun`,
    icon: Cookie,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Groups",
    value: props.stats.groups.total,
    sub: `${n(props.stats.groups.byType, "public")} public · ${n(
      props.stats.groups.byType,
      "private"
    )} private`,
    icon: Users,
    color: "text-violet-600 dark:text-violet-400",
  },
  {
    label: "Facebook Profiles",
    value: props.stats.facebookProfiles,
    sub: "profil",
    icon: Contact2Icon,
    color: "text-teal-600 dark:text-teal-400",
  },
  {
    label: "Proxy Sehat",
    value: n(props.stats.proxies.byStatus, "healthy"),
    sub: `dari ${props.stats.proxies.total} proxy`,
    icon: ShieldCheck,
    color: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Fingerprints",
    value: props.stats.fingerprints,
    sub: "profil",
    icon: Fingerprint,
    color: "text-amber-600 dark:text-amber-400",
  },
  {
    label: "Antidetects",
    value: props.stats.antidetects,
    sub: "profil",
    icon: HatGlasses,
    color: "text-muted-foreground",
  },
  {
    label: "Aksi Hari Ini",
    value: props.stats.today.success,
    sub: `dari ${props.stats.today.total} (${props.stats.today.failed} gagal)`,
    icon: Activity,
    color: "text-sky-600 dark:text-sky-400",
  },
];

const statusBadge = (s: string) =>
  ({
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    error: "bg-red-500/15 text-red-600 dark:text-red-400",
    skipped: "bg-muted text-muted-foreground",
    checkpoint: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  }[s] ?? "bg-muted text-muted-foreground");

const barColor = (k: string) =>
  ({
    running: "bg-blue-500",
    completed: "bg-emerald-500",
    healthy: "bg-emerald-500",
    active: "bg-emerald-500",
    public: "bg-emerald-500",
    failed: "bg-red-500",
    dead: "bg-red-500",
    banned: "bg-red-500",
    paused: "bg-amber-500",
    slow: "bg-amber-500",
    checkpoint: "bg-amber-500",
    private: "bg-violet-500",
    draft: "bg-slate-400",
  }[k] ?? "bg-muted-foreground/40");

function breakdown(t: Tally) {
  const entries = Object.entries(t).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...entries.map((e) => e[1]));
  return entries.map(([key, value]) => ({
    key,
    value,
    pct: Math.round((value / max) * 100),
  }));
}

function fmt(value: string | null) {
  return value
    ? new Date(value).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";
}

function fmtPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}

function typeLabel(value: string) {
  return (
    {
      scrape_group: "Scrape Group",
      auto_share: "Auto Share",
      auto_join: "Auto Join",
    }[value] ?? value
  );
}

function actionLabel(value: string) {
  return value.replaceAll("_", " ");
}

function refresh() {
  router.reload();
}

function exportCsv() {
  const params = new URLSearchParams();
  const query = buildQuery();
  if (query.startDate) params.set("startDate", query.startDate);
  if (query.endDate) params.set("endDate", query.endDate);
  const suffix = params.toString();
  window.location.href = suffix ? `/dashboard/export?${suffix}` : "/dashboard/export";
}

function buildQuery() {
  return {
    startDate: rangeDate.value?.[0] ? formatDate(rangeDate.value[0]) : undefined,
    endDate: rangeDate.value?.[1] ? formatDate(rangeDate.value[1]) : undefined,
  };
}

function sameDay(left: Date, right: Date) {
  return formatDate(left) === formatDate(right);
}

function setRangePreset(preset: "today" | "7d" | "30d" | "month") {
  const end = new Date();
  const start = new Date(end);

  if (preset === "today") {
    rangeDate.value = [new Date(end), new Date(end)];
    return;
  }

  if (preset === "7d") {
    start.setDate(end.getDate() - 6);
    rangeDate.value = [start, new Date(end)];
    return;
  }

  if (preset === "30d") {
    start.setDate(end.getDate() - 29);
    rangeDate.value = [start, new Date(end)];
    return;
  }

  rangeDate.value = [new Date(end.getFullYear(), end.getMonth(), 1), new Date(end)];
}

const activePreset = computed(() => {
  if (!rangeDate.value?.[0] || !rangeDate.value?.[1]) return null;

  const [start, end] = rangeDate.value;
  const today = new Date();
  const preset7d = new Date(today);
  preset7d.setDate(today.getDate() - 6);
  const preset30d = new Date(today);
  preset30d.setDate(today.getDate() - 29);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  if (sameDay(start, today) && sameDay(end, today)) return "today";
  if (sameDay(start, preset7d) && sameDay(end, today)) return "7d";
  if (sameDay(start, preset30d) && sameDay(end, today)) return "30d";
  if (sameDay(start, monthStart) && sameDay(end, today)) return "month";
  return null;
});

const presets = [
  { key: "today", label: "Hari Ini" },
  { key: "7d", label: "7 Hari" },
  { key: "30d", label: "30 Hari" },
  { key: "month", label: "Bulan Ini" },
] as const;

watch(
  rangeDate,
  () => {
    router.get("/", buildQuery(), {
      preserveScroll: true,
      preserveState: true,
      replace: true,
    });
  },
  { deep: true }
);

const chartWidth = 560;
const chartHeight = 200;
const chartPaddingX = 20;
const chartPaddingY = 18;

function projectY(value: number, max: number) {
  const innerHeight = chartHeight - chartPaddingY * 2;
  return chartHeight - chartPaddingY - (value / max) * innerHeight;
}

const chartPoints = computed<ChartPoint[]>(() => {
  const points = props.analytics.dailyActivity;
  const max = Math.max(1, ...points.map((point) => point.total));
  const innerWidth = chartWidth - chartPaddingX * 2;
  return points.map((point, index) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : chartPaddingX + (index / (points.length - 1)) * innerWidth;
    return {
      ...point,
      x,
      totalY: projectY(point.total, max),
      successY: projectY(point.success, max),
      failedY: projectY(point.failed, max),
    };
  });
});

const totalLinePoints = computed(() =>
  chartPoints.value.map((point) => `${point.x},${point.totalY}`).join(" ")
);
const successLinePoints = computed(() =>
  chartPoints.value.map((point) => `${point.x},${point.successY}`).join(" ")
);
const failedLinePoints = computed(() =>
  chartPoints.value.map((point) => `${point.x},${point.failedY}`).join(" ")
);
const totalAreaPath = computed(() => {
  if (!chartPoints.value.length) return "";
  const first = chartPoints.value[0];
  const last = chartPoints.value[chartPoints.value.length - 1];
  const baseline = chartHeight - chartPaddingY;
  return [
    `M ${first.x} ${baseline}`,
    ...chartPoints.value.map((point) => `L ${point.x} ${point.totalY}`),
    `L ${last.x} ${baseline}`,
    "Z",
  ].join(" ");
});

const analyticsCards = computed(() => [
  {
    label: "Volume Log",
    value: props.analytics.totalLogVolume.toLocaleString("id-ID"),
    sub: props.analytics.windowLabel,
  },
  {
    label: "Success Log",
    value: props.analytics.successLogVolume.toLocaleString("id-ID"),
    sub: `${props.analytics.failedLogVolume} gagal`,
  },
  {
    label: "Success Rate",
    value: fmtPercent(props.analytics.successRate),
    sub: "berdasarkan session log",
  },
]);

const profileLifecycleCards = computed(() => [
  {
    label: "Fresh",
    value: n(props.stats.profileLifecycle, "fresh"),
    tone: "text-muted-foreground",
  },
  {
    label: "Requested",
    value: n(props.stats.profileLifecycle, "friend_requested"),
    tone: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Connected",
    value: n(props.stats.profileLifecycle, "friend_connected"),
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Invited",
    value: n(props.stats.profileLifecycle, "invited"),
    tone: "text-violet-600 dark:text-violet-400",
  },
  {
    label: "Failed",
    value: n(props.stats.profileLifecycle, "failed"),
    tone: "text-red-600 dark:text-red-400",
  },
]);

const profileRelationshipCards = computed(() => [
  {
    label: "Outgoing",
    value: n(props.stats.profileRelationship, "outgoing_request"),
    tone: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Incoming",
    value: n(props.stats.profileRelationship, "incoming_request"),
    tone: "text-amber-600 dark:text-amber-400",
  },
  {
    label: "Friend",
    value: n(props.stats.profileRelationship, "friend"),
    tone: "text-emerald-600 dark:text-emerald-400",
  },
]);

const topActionMax = computed(() =>
  Math.max(1, ...props.analytics.actionBreakdown.map((row) => row.total), 1)
);
</script>

<template>
  <Head title="Dashboard" />
  <App
    title="Dashboard"
    description="Ringkasan campaign, akun, group, proxy & aktivitas terbaru."
  >
    <template #actions>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex flex-wrap items-center gap-1">
          <button
            v-for="preset in presets"
            :key="preset.key"
            type="button"
            :class="
              cn(
                'rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                activePreset === preset.key
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              )
            "
            @click="setRangePreset(preset.key)"
          >
            {{ preset.label }}
          </button>
        </div>
        <DateRangePicker v-model="rangeDate" />
        <Button
          class="bg-blue-600 hover:bg-blue-700 text-white"
          variant="ghost"
          size="sm"
          @click="exportCsv"
        >
          <Download class="size-4" /> Export CSV
        </Button>
        <Button variant="outline" size="sm" @click="refresh">
          <RefreshCcw class="size-4" /> Refresh
        </Button>
      </div>
    </template>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div
        v-for="k in kpis"
        :key="k.label"
        class="rounded-lg border border-border bg-background p-4"
      >
        <div class="flex items-center justify-between">
          <span class="text-xs text-muted-foreground">{{ k.label }}</span>
          <component :is="k.icon" :class="cn('size-4', k.color)" />
        </div>
        <div class="mt-1 text-2xl font-semibold">{{ k.value }}</div>
        <div class="text-xs text-muted-foreground">{{ k.sub }}</div>
      </div>
    </div>

    <section class="grid grid-cols-1 gap-3 xl:grid-cols-[1.5fr_1fr]">
      <div class="rounded-lg border border-border bg-card p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-sm font-medium">Funnel Lifecycle Profile</h3>
            <p class="text-xs text-muted-foreground">
              Snapshot global untuk membaca readiness funnel profile dari pool mentah sampai
              tahap invite.
            </p>
          </div>
          <Link
            href="/profiles"
            class="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
          >
            Buka Profile Pool
          </Link>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
          <div
            v-for="card in profileLifecycleCards"
            :key="card.label"
            class="rounded-md border border-border bg-background px-3 py-2"
          >
            <div class="text-[11px] text-muted-foreground">{{ card.label }}</div>
            <div :class="cn('mt-1 text-lg font-semibold', card.tone)">{{ card.value }}</div>
          </div>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-card p-4">
        <div>
          <h3 class="text-sm font-medium">Relationship Snapshot</h3>
          <p class="text-xs text-muted-foreground">
            Ringkasan status hubungan aktual yang tersimpan di seluruh profile pool.
          </p>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-3">
          <div
            v-for="card in profileRelationshipCards"
            :key="card.label"
            class="rounded-md border border-border bg-background px-3 py-2"
          >
            <div class="text-[11px] text-muted-foreground">{{ card.label }}</div>
            <div :class="cn('mt-1 text-lg font-semibold', card.tone)">{{ card.value }}</div>
          </div>
        </div>
      </div>
    </section>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr]">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <TrendingUp class="size-4 text-primary" />
              <h3 class="text-sm font-medium">Trend Aktivitas</h3>
            </div>
            <p class="text-xs text-muted-foreground">
              Chart analytics dari session log {{ analytics.windowLabel }}.
            </p>
          </div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ analytics.windowLabel }}
          </span>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div
            v-for="card in analyticsCards"
            :key="card.label"
            class="rounded-lg border border-border bg-background px-3 py-3"
          >
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ card.label }}
            </div>
            <div class="mt-1 text-lg font-semibold">{{ card.value }}</div>
            <div class="text-xs text-muted-foreground">{{ card.sub }}</div>
          </div>
        </div>

        <div class="mt-4 rounded-lg border border-border bg-background p-4">
          <div
            class="mb-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground"
          >
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-sky-500"></span>Total
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-emerald-500"></span>Success
            </span>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-red-500"></span>Failed
            </span>
          </div>

          <svg
            class="h-55 w-full"
            :viewBox="`0 0 ${chartWidth} ${chartHeight}`"
            preserveAspectRatio="none"
          >
            <line
              v-for="y in [25, 50, 75]"
              :key="y"
              x1="0"
              :y1="(chartHeight * y) / 100"
              :x2="chartWidth"
              :y2="(chartHeight * y) / 100"
              stroke="currentColor"
              class="text-border/70"
              stroke-dasharray="4 4"
            />
            <path :d="totalAreaPath" fill="rgba(59, 130, 246, 0.12)" />
            <polyline
              v-if="totalLinePoints"
              :points="totalLinePoints"
              fill="none"
              stroke="#3b82f6"
              stroke-width="3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <polyline
              v-if="successLinePoints"
              :points="successLinePoints"
              fill="none"
              stroke="#10b981"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <polyline
              v-if="failedLinePoints"
              :points="failedLinePoints"
              fill="none"
              stroke="#ef4444"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle
              v-for="point in chartPoints"
              :key="point.date"
              :cx="point.x"
              :cy="point.totalY"
              r="4"
              fill="#3b82f6"
            >
              <title>
                {{
                  `${point.label}: total ${point.total}, success ${point.success}, failed ${point.failed}`
                }}
              </title>
            </circle>
          </svg>

          <div class="mt-3 grid grid-cols-7 gap-2 text-[11px] text-muted-foreground">
            <div
              v-for="point in chartPoints"
              :key="`${point.date}-label`"
              class="text-center"
            >
              {{ point.label }}
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <BarChart3 class="size-4 text-primary" />
              <h3 class="text-sm font-medium">Top Action</h3>
            </div>
            <p class="text-xs text-muted-foreground">
              Aksi automation terbanyak dari session log terbaru.
            </p>
          </div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ analytics.actionBreakdown.length }} aksi
          </span>
        </div>

        <div v-if="analytics.actionBreakdown.length" class="mt-4 space-y-4">
          <div
            v-for="row in analytics.actionBreakdown"
            :key="row.action"
            class="space-y-1.5 bg-background rounded-md p-2 border border-border"
          >
            <div class="flex items-center justify-between gap-3 text-sm">
              <div class="font-medium capitalize">{{ actionLabel(row.action) }}</div>
              <div class="text-xs text-muted-foreground">
                {{ row.total }} log · {{ fmt(row.lastAt) }}
              </div>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-muted">
              <div
                class="flex h-full rounded-full"
                :style="{
                  width: `${Math.max(8, Math.round((row.total / topActionMax) * 100))}%`,
                }"
              >
                <div
                  class="bg-emerald-500"
                  :style="{
                    width: `${row.total ? (row.success / row.total) * 100 : 0}%`,
                  }"
                ></div>
                <div
                  class="bg-red-500"
                  :style="{ width: `${row.total ? (row.failed / row.total) * 100 : 0}%` }"
                ></div>
                <div class="flex-1 bg-sky-500/45"></div>
              </div>
            </div>
            <div class="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>Success {{ row.success }}</span>
              <span>Failed {{ row.failed }}</span>
              <span>Other {{ row.total - row.success - row.failed }}</span>
            </div>
          </div>
        </div>
        <p v-else class="mt-4 text-xs text-muted-foreground">Belum ada action log.</p>
      </section>
    </div>

    <section class="rounded-lg border border-border bg-card p-5">
      <div class="flex items-start justify-between gap-3">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <CalendarDays class="size-4 text-primary" />
            <h3 class="text-sm font-medium">Campaign per Tipe</h3>
          </div>
          <p class="text-xs text-muted-foreground">
            Distribusi status campaign dari seluruh campaign yang tersimpan.
          </p>
        </div>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {{ analytics.campaignTypeBreakdown.length }} tipe
        </span>
      </div>

      <div v-if="analytics.campaignTypeBreakdown.length" class="mt-4 space-y-4">
        <div
          v-for="row in analytics.campaignTypeBreakdown"
          :key="row.type"
          class="rounded-lg border border-border bg-background p-4"
        >
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div class="font-medium">{{ typeLabel(row.type) }}</div>
              <div class="text-xs text-muted-foreground">{{ row.total }} campaign</div>
            </div>
            <div class="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
              <span>Draft {{ row.draft }}</span>
              <span>Running {{ row.running }}</span>
              <span>Paused {{ row.paused }}</span>
              <span>Completed {{ row.completed }}</span>
              <span>Failed {{ row.failed }}</span>
            </div>
          </div>
          <div class="mt-3 flex h-3 overflow-hidden rounded-full bg-muted">
            <div
              class="bg-slate-400"
              :style="{ width: `${row.total ? (row.draft / row.total) * 100 : 0}%` }"
            ></div>
            <div
              class="bg-blue-500"
              :style="{ width: `${row.total ? (row.running / row.total) * 100 : 0}%` }"
            ></div>
            <div
              class="bg-amber-500"
              :style="{ width: `${row.total ? (row.paused / row.total) * 100 : 0}%` }"
            ></div>
            <div
              class="bg-emerald-500"
              :style="{ width: `${row.total ? (row.completed / row.total) * 100 : 0}%` }"
            ></div>
            <div
              class="bg-red-500"
              :style="{ width: `${row.total ? (row.failed / row.total) * 100 : 0}%` }"
            ></div>
          </div>
        </div>
      </div>
      <p v-else class="mt-4 text-xs text-muted-foreground">
        Belum ada campaign yang bisa dianalisis.
      </p>
    </section>

    <div v-if="running.length" class="rounded-lg border border-border bg-background p-4">
      <h3 class="mb-3 text-sm font-medium">Campaign Berjalan</h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          v-for="c in running"
          :key="c.id"
          :href="`/campaigns/${c.id}`"
          class="rounded-md border border-border p-3 hover:bg-muted/40"
        >
          <div class="flex items-center justify-between">
            <span class="truncate text-sm font-medium">{{ c.name }}</span>
            <span class="size-2 animate-pulse rounded-full bg-blue-500"></span>
          </div>
          <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-blue-500"
              :style="{ width: `${c.total ? Math.round((c.done / c.total) * 100) : 0}%` }"
            ></div>
          </div>
          <div class="mt-1 text-xs text-muted-foreground">
            {{ c.done }}/{{ c.total }} group
          </div>
        </Link>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div class="space-y-4 rounded-lg border border-border bg-card p-4">
        <div class="rounded-md border border-border bg-background p-1.5">
          <h3 class="mb-2 text-sm font-medium">Campaign per Status</h3>
          <div v-if="stats.campaigns.total" class="space-y-1.5">
            <div
              v-for="b in breakdown(stats.campaigns.byStatus)"
              :key="b.key"
              class="flex items-center gap-2"
            >
              <span class="w-20 shrink-0 text-xs capitalize text-muted-foreground">{{
                b.key
              }}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  :class="cn('h-full rounded-full', barColor(b.key))"
                  :style="{ width: `${b.pct}%` }"
                ></div>
              </div>
              <span class="w-6 text-right text-xs">{{ b.value }}</span>
            </div>
          </div>
          <p v-else class="text-xs text-muted-foreground">Belum ada campaign.</p>
        </div>

        <div class="rounded-md border border-border bg-background p-1.5">
          <h3 class="mb-2 text-sm font-medium">Akun per Status</h3>
          <div v-if="stats.accounts.total" class="space-y-1.5">
            <div
              v-for="b in breakdown(stats.accounts.byStatus)"
              :key="b.key"
              class="flex items-center gap-2"
            >
              <span class="w-20 shrink-0 text-xs capitalize text-muted-foreground">
                {{ b.key.replace("_", " ") }}
              </span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  :class="cn('h-full rounded-full', barColor(b.key))"
                  :style="{ width: `${b.pct}%` }"
                ></div>
              </div>
              <span class="w-6 text-right text-xs">{{ b.value }}</span>
            </div>
          </div>
          <p v-else class="text-xs text-muted-foreground">Belum ada akun.</p>
        </div>

        <div class="rounded-md border border-border bg-background p-1.5">
          <h3 class="mb-2 text-sm font-medium">Proxy per Status</h3>
          <div v-if="stats.proxies.total" class="space-y-1.5">
            <div
              v-for="b in breakdown(stats.proxies.byStatus)"
              :key="b.key"
              class="flex items-center gap-2"
            >
              <span class="w-20 shrink-0 text-xs capitalize text-muted-foreground">{{
                b.key
              }}</span>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  :class="cn('h-full rounded-full', barColor(b.key))"
                  :style="{ width: `${b.pct}%` }"
                ></div>
              </div>
              <span class="w-6 text-right text-xs">{{ b.value }}</span>
            </div>
          </div>
          <p v-else class="text-xs text-muted-foreground">Belum ada proxy.</p>
        </div>
      </div>

      <div class="rounded-lg border border-border bg-background p-4">
        <h3 class="mb-2 text-sm font-medium">Aktivitas Terbaru</h3>
        <div v-if="recentLogs.length" class="space-y-1">
          <div
            v-for="l in recentLogs"
            :key="l.id"
            class="flex items-center gap-2 border-b border-border py-1.5 text-sm last:border-0"
          >
            <span
              :class="
                cn(
                  'rounded-full px-2 py-0.5 text-[10px] capitalize',
                  statusBadge(l.status)
                )
              "
            >
              {{ l.status }}
            </span>
            <span class="font-mono text-xs">{{ l.action }}</span>
            <Link
              :href="`/campaigns/${l.campaignId}`"
              class="truncate text-xs text-muted-foreground hover:underline"
            >
              {{ l.campaignName }}
            </Link>
            <span class="ml-auto shrink-0 text-xs text-muted-foreground">{{
              fmt(l.createdAt)
            }}</span>
          </div>
        </div>
        <p v-else class="text-xs text-muted-foreground">Belum ada aktivitas.</p>
      </div>
    </div>
  </App>
</template>
