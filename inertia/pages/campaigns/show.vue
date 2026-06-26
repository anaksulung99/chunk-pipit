<script setup lang="ts">
import { computed } from "vue";
import { Head, router } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import { cn } from "~/lib/utils";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Trash2,
  ExternalLink,
  Activity,
  LayoutList,
  Users,
  FolderKanban,
  Pencil,
} from "@lucide/vue";

type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

type Campaign = {
  id: string;
  name: string;
  type: string;
  status: string;
  config: Record<string, JsonValue>;
  targetGroupType: string | null;
  useProxy: boolean;
  maxConcurrency: number;
  maxAccounts: number;
  maxDelayMs: number;
  maxTargets: number | null;
  headless: boolean;
  advanceMode: boolean;
  minGroupMember: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  fingerprint: { id: string; name: string; osType: string } | null;
  accounts: {
    id: string;
    accountId: string;
    status: string;
    label: string;
    fbUserId: string | null;
    sessionStatus: string | null;
    lastUsedAt: string | null;
    logCount: number;
    successCount: number;
    errorCount: number;
    lastLogAt: string | null;
  }[];
  groups: {
    id: string;
    relationGroupId: string;
    status: string;
    processedAt: string | null;
    groupId: string;
    groupName: string | null;
    groupType: string | null;
    groupUrl: string | null;
    memberCount: number | null;
    sourceType: string | null;
    sourceKeyword: string | null;
    logCount: number;
    successCount: number;
    errorCount: number;
    lastLogAt: string | null;
  }[];
};
type Log = {
  id: string;
  action: string;
  status: string;
  message: string | null;
  accountLabel: string | null;
  groupName: string | null;
  durationMs: number | null;
  screenshotPath: string | null;
  createdAt: string | null;
};
type WorkerStatus = {
  state: "online" | "offline" | "error" | "unknown";
  queue: string | null;
  routingKey: string | null;
  consumers: number;
  messages: number;
  checkedAt: string | null;
  note: string;
};
type CampaignReport = {
  totalLogs: number;
  successLogs: number;
  errorLogs: number;
  pendingLogs: number;
  checkpointLogs: number;
  skippedLogs: number;
  uniqueAccountsTouched: number;
  uniqueGroupsTouched: number;
  averageDurationMs: number | null;
  runtimeMs: number | null;
  logSuccessRate: number;
  accountCompletionRate: number;
  groupCompletionRate: number;
  firstLogAt: string | null;
  lastLogAt: string | null;
};
type RelationSummary = {
  accounts: { total: number; completed: number; failed: number; pending: number };
  groups: { total: number; completed: number; failed: number; pending: number };
};
type CampaignProgress = {
  stage: string;
  stageLabel: string;
  actionLabel: string | null;
  targetLabel: string;
  processed: number;
  total: number | null;
  success: number;
  failed: number;
  skipped: number;
  pending: number;
  running: number;
  discovered: number;
  persisted: number;
  percent: number | null;
  indeterminate: boolean;
  currentBatch: number | null;
  totalBatches: number | null;
  completedBatches: number;
  activeBatches: number;
  batchLabel: string | null;
  etaSeconds: number | null;
  elapsedSeconds: number | null;
  throughputPerMinute: number | null;
  currentAccountLabel: string | null;
  currentGroupName: string | null;
  currentTargetCode: string | null;
  currentLabel: string | null;
  skippedByType: number;
  skippedByMemberCount: number;
  skippedByMissingName: number;
  skippedDuplicates: number;
  updatedAt: string | null;
};
type ActionReportRow = {
  action: string;
  total: number;
  success: number;
  error: number;
  lastActivityAt: string | null;
};

const props = defineProps<{
  campaign: Campaign;
  logs: Log[];
  workerStatus: WorkerStatus;
  campaignReport: CampaignReport;
  relationSummary: RelationSummary;
  actionReport: ActionReportRow[];
  campaignProgress: CampaignProgress;
}>();

// Live progress via SSE while the campaign is running.
const liveLogs = ref<Log[]>([...props.logs]);
const workerStatus = ref<WorkerStatus>(props.workerStatus);
const campaignProgress = ref<CampaignProgress>(props.campaignProgress);
const streaming = ref(false);
const statusSubmitting = ref<string | null>(null);
let es: EventSource | null = null;
let workerPoll: ReturnType<typeof setInterval> | null = null;
let workerPollBusy = false;
let streamRefreshBusy = false;
let streamSessionId = 0;

watch(
  () => props.logs,
  (value) => {
    liveLogs.value = [...value];
  }
);
watch(
  () => props.workerStatus,
  (value) => {
    workerStatus.value = value;
  }
);
watch(
  () => props.campaignProgress,
  (value) => {
    campaignProgress.value = value;
  }
);

function closeStream() {
  es?.close();
  es = null;
  streaming.value = false;
}

function stopWorkerPolling() {
  if (workerPoll) clearInterval(workerPoll);
  workerPoll = null;
  workerPollBusy = false;
}

function startWorkerPolling() {
  stopWorkerPolling();
  workerPoll = setInterval(() => {
    if (props.campaign.status === "running" || workerPollBusy) return;
    workerPollBusy = true;
    router.get(
      `/campaigns/${props.campaign.id}`,
      {},
      {
        only: [
          "workerStatus",
          "campaignReport",
          "relationSummary",
          "actionReport",
          "logs",
          "campaignProgress",
        ],
        preserveState: true,
        preserveScroll: true,
        replace: true,
        onFinish: () => {
          workerPollBusy = false;
        },
      }
    );
  }, 8000);
}

function refreshCampaignSnapshot() {
  if (streamRefreshBusy) return;
  streamRefreshBusy = true;
  router.get(
    `/campaigns/${props.campaign.id}`,
    {},
    {
      only: [
        "campaign",
        "logs",
        "workerStatus",
        "campaignReport",
        "relationSummary",
        "actionReport",
        "campaignProgress",
      ],
      preserveState: true,
      preserveScroll: true,
      replace: true,
      onFinish: () => {
        streamRefreshBusy = false;
      },
    }
  );
}

function startStream() {
  if (es) return;
  stopWorkerPolling();
  const sessionId = ++streamSessionId;
  streaming.value = true;
  const source = new EventSource(`/campaigns/${props.campaign.id}/stream`);
  es = source;
  source.addEventListener("log", (e) => {
    if (sessionId !== streamSessionId) return;
    try {
      liveLogs.value.unshift(JSON.parse((e as MessageEvent).data));
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("status", (e) => {
    if (sessionId !== streamSessionId) return;
    try {
      const data = JSON.parse((e as MessageEvent).data);
      if (data.workerStatus) workerStatus.value = data.workerStatus;
      if (data.progress) campaignProgress.value = data.progress;
      if (data.status !== "running") {
        closeStream();
        refreshCampaignSnapshot();
        startWorkerPolling();
      }
    } catch {
      /* ignore */
    }
  });
  source.addEventListener("done", () => {
    if (sessionId !== streamSessionId) return;
    closeStream();
    refreshCampaignSnapshot();
    startWorkerPolling();
  });
  source.onerror = () => {
    if (sessionId !== streamSessionId) return;
    closeStream();
    startWorkerPolling();
  };
}

watch(
  () => props.campaign.status,
  (status) => {
    if (status === "running") {
      if (!es) startStream();
    }
    else {
      closeStream();
      startWorkerPolling();
    }
  },
  { immediate: true }
);

onBeforeUnmount(() => {
  closeStream();
  stopWorkerPolling();
});

const typeLabel = (t: string) =>
  ({
    scrape_group: "Scrape Group",
    auto_share: "Auto Share",
    auto_join: "Auto Join",
    scrape_profile: "Scrape Profile",
    auto_add_friend: "Auto Add Friend",
    auto_invite: "Auto Invite",
    auto_unfriend: "Auto Unfriend",
    auto_confirm: "Auto Confirm",
  }[t] ?? t);

const statusBadge = (s: string) =>
  ({
    draft: "bg-muted text-muted-foreground",
    running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    skipped: "bg-muted text-muted-foreground",
    checkpoint: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/15 text-red-600 dark:text-red-400",
    pending: "bg-muted text-muted-foreground",
    idle: "bg-muted text-muted-foreground",
    done: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  }[s] ?? "bg-muted text-muted-foreground");

function setStatus(status: string) {
  if (statusSubmitting.value) return;
  statusSubmitting.value = status;
  closeStream();
  stopWorkerPolling();
  router.post(
    `/campaigns/${props.campaign.id}/status`,
    { status },
    {
      preserveScroll: true,
      preserveState: true,
      replace: true,
      onFinish: () => {
        statusSubmitting.value = null;
        if (props.campaign.status !== "running") startWorkerPolling();
      },
    }
  );
}
function destroy() {
  if (!confirm("Hapus campaign ini?")) return;
  router.delete(`/campaigns/${props.campaign.id}`, {
    preserveScroll: true,
    preserveState: false,
    onSuccess: () => router.reload(),
  });
}
function fmt(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}
function fmtDuration(value: number | null) {
  if (value === null || Number.isNaN(value)) return "—";
  if (value < 1000) return `${value}ms`;
  const seconds = value / 1000;
  if (seconds < 60)
    return `${seconds.toLocaleString("id-ID", { maximumFractionDigits: 1 })}d`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}d`;
}
function fmtPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
}
function fmtEta(seconds: number | null) {
  if (seconds === null || seconds <= 0) return "—";
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  if (hours > 0) return `${hours}j ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}d`;
  return `${secs}d`;
}
function fmtRate(value: number | null) {
  if (value === null || Number.isNaN(value) || value <= 0) return "—";
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}/m`;
}
function fmtNumber(value: number | null) {
  return value === null ? "—" : value.toLocaleString("id-ID");
}
const workerBadge = (state: WorkerStatus["state"]) =>
  ({
    online: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    offline: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    error: "bg-red-500/15 text-red-600 dark:text-red-400",
    unknown: "bg-muted text-muted-foreground",
  }[state] ?? "bg-muted text-muted-foreground");
const workerLabel = (state: WorkerStatus["state"]) =>
  ({
    online: "worker aktif",
    offline: "worker belum aktif",
    error: "status worker error",
    unknown: "status worker tidak diketahui",
  }[state] ?? state);

const progressPercentLabel = computed(() =>
  campaignProgress.value.percent === null
    ? "Sedang berjalan..."
    : fmtPercent(campaignProgress.value.percent)
);
const progressWidth = computed(() =>
  campaignProgress.value.percent === null ? "0%" : `${campaignProgress.value.percent}%`
);
const progressTone = computed(
  () =>
    ({
      completed: "bg-emerald-500",
      failed: "bg-red-500",
      paused: "bg-amber-500",
      running: "bg-blue-500",
      draft: "bg-slate-400",
    }[campaignProgress.value.stage] ?? "bg-blue-500")
);
const progressSummary = computed(() => {
  const progress = campaignProgress.value;
  if (progress.total === null) {
    return `Progress total ${progress.targetLabel} belum bisa dihitung otomatis.`;
  }

  return `${progress.processed.toLocaleString("id-ID")} / ${progress.total.toLocaleString(
    "id-ID"
  )} ${progress.targetLabel} diproses`;
});
const progressBatchSummary = computed(() => {
  const progress = campaignProgress.value;
  if (!progress.totalBatches) return null;
  if (progress.batchLabel) return progress.batchLabel;
  if (progress.currentBatch)
    return `Batch ${progress.currentBatch}/${progress.totalBatches}`;
  return `Total batch ${progress.totalBatches}`;
});
const progressSkipReasons = computed(() => {
  const progress = campaignProgress.value;
  return [
    progress.skippedByType > 0
      ? `Skip tipe ${progress.skippedByType.toLocaleString("id-ID")}`
      : null,
    progress.skippedByMemberCount > 0
      ? `Skip minimum ${progress.skippedByMemberCount.toLocaleString("id-ID")}`
      : null,
    progress.skippedByMissingName > 0
      ? `Skip nama kosong ${progress.skippedByMissingName.toLocaleString("id-ID")}`
      : null,
    progress.skippedDuplicates > 0
      ? `Skip duplikat ${progress.skippedDuplicates.toLocaleString("id-ID")}`
      : null,
  ].filter((value): value is string => Boolean(value));
});

const fallbackLogs = computed(() =>
  liveLogs.value.filter((log) => log.action === "scrape_fallback")
);
const fallbackAccounts = computed(() =>
  Array.from(
    new Set(
      fallbackLogs.value
        .map((log) => log.accountLabel)
        .filter((value): value is string => Boolean(value))
    )
  )
);
const lastFallbackLog = computed(() => fallbackLogs.value[0] ?? null);

function actionLabel(action: string) {
  return (
    {
      scrape_fallback: "Fallback Akun",
      scrape_metadata: "Perdalam Metadata",
      scrape_profile: "Scrape Profile",
      scrape_profile_metadata: "Perdalam Metadata Profile",
      session_prepare: "Siapkan Session",
      session_verify: "Verifikasi Session",
      account_error: "Error Akun",
      campaign_start: "Campaign Mulai",
      campaign_end: "Campaign Selesai",
      campaign_error: "Campaign Error",
      scrape: "Scrape Group",
      auto_add_friend: "Auto Add Friend",
      auto_invite: "Auto Invite",
      auto_unfriend: "Auto Unfriend",
      auto_confirm: "Auto Confirm",
    }[action] ?? action
  );
}

const overviewCards = computed(() => [
  {
    label: "Total Log",
    value: props.campaignReport.totalLogs.toLocaleString("id-ID"),
    tone: "text-foreground",
  },
  {
    label: "Success Log",
    value: props.campaignReport.successLogs.toLocaleString("id-ID"),
    tone: "text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Error Log",
    value: props.campaignReport.errorLogs.toLocaleString("id-ID"),
    tone: "text-red-600 dark:text-red-400",
  },
  {
    label: "Akun Tersentuh",
    value: props.campaignReport.uniqueAccountsTouched.toLocaleString("id-ID"),
    tone: "text-foreground",
  },
  {
    label: "Group Tersentuh",
    value: props.campaignReport.uniqueGroupsTouched.toLocaleString("id-ID"),
    tone: "text-foreground",
  },
  {
    label: "Log Success Rate",
    value: fmtPercent(props.campaignReport.logSuccessRate),
    tone: "text-foreground",
  },
]);
</script>

<template>
  <Head :title="campaign.name" />
  <App
    :title="campaign.name"
    :description="`${typeLabel(campaign.type)} · dibuat ${fmt(campaign.createdAt)}`"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Link
          href="/campaigns"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft class="size-4" /> Kembali
        </Link>
        <Link
          v-if="campaign.status !== 'running'"
          :href="`/campaigns/${campaign.id}/edit`"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Pencil class="size-4" /> Edit
        </Link>
        <button
          v-if="campaign.status === 'draft' || campaign.status === 'paused'"
          type="button"
          :disabled="Boolean(statusSubmitting)"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          @click="setStatus('running')"
        >
          <Play class="size-4" />
          {{
            statusSubmitting === "running"
              ? "Memulai..."
              : campaign.status === "paused"
              ? "Resume"
              : "Start"
          }}
        </button>
        <button
          v-if="campaign.status === 'running'"
          type="button"
          :disabled="Boolean(statusSubmitting)"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          @click="setStatus('paused')"
        >
          <Pause class="size-4" /> Pause
        </button>
        <button
          v-if="campaign.status === 'running' || campaign.status === 'paused'"
          type="button"
          :disabled="Boolean(statusSubmitting)"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
          @click="setStatus('completed')"
        >
          <Square class="size-4" /> Stop
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10"
          @click="destroy"
        >
          <Trash2 class="size-4" /> Hapus
        </button>
      </div>
    </template>

    <div class="rounded-lg border border-border bg-card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Status Worker Queue</span>
            <span
              :class="
                cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                  workerBadge(workerStatus.state)
                )
              "
              >{{ workerLabel(workerStatus.state) }}</span
            >
          </div>
          <p class="text-xs text-muted-foreground">{{ workerStatus.note }}</p>
        </div>
        <div class="text-xs text-muted-foreground">
          Dicek: {{ fmt(workerStatus.checkedAt) }}
        </div>
      </div>
      <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt class="text-xs text-muted-foreground">Queue</dt>
          <dd class="font-mono text-xs">{{ workerStatus.queue ?? "—" }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Routing key</dt>
          <dd class="font-mono text-xs">{{ workerStatus.routingKey ?? "—" }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Consumer aktif</dt>
          <dd>{{ workerStatus.consumers }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Job pending</dt>
          <dd>{{ workerStatus.messages }}</dd>
        </div>
      </dl>
    </div>

    <section class="rounded-lg border border-border bg-card p-4">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium">Progress Eksekusi</span>
            <span
              :class="
                cn(
                  'inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium capitalize',
                  statusBadge(campaignProgress.stage)
                )
              "
            >
              {{ campaignProgress.stageLabel }}
            </span>
            <span
              v-if="campaignProgress.actionLabel"
              class="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              {{ campaignProgress.actionLabel }}
            </span>
          </div>
          <p class="text-xs text-muted-foreground">{{ campaignProgress.currentLabel }}</p>
          <div
            class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
          >
            <span v-if="progressBatchSummary">{{ progressBatchSummary }}</span>
            <span v-if="campaignProgress.totalBatches">
              Selesai: {{ campaignProgress.completedBatches.toLocaleString("id-ID") }} /
              {{ campaignProgress.totalBatches.toLocaleString("id-ID") }}
            </span>
            <span v-if="campaignProgress.activeBatches > 0">
              Batch aktif: {{ campaignProgress.activeBatches.toLocaleString("id-ID") }}
            </span>
            <span v-if="campaignProgress.currentAccountLabel">
              Akun: {{ campaignProgress.currentAccountLabel }}
            </span>
            <span v-if="campaignProgress.currentGroupName">
              Target: {{ campaignProgress.currentGroupName }}
            </span>
            <span v-if="campaignProgress.currentTargetCode">
              Kode: {{ campaignProgress.currentTargetCode }}
            </span>
          </div>
          <div
            v-if="progressSkipReasons.length"
            class="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"
          >
            <span
              v-for="reason in progressSkipReasons"
              :key="reason"
              class="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-amber-700 dark:text-amber-300"
            >
              {{ reason }}
            </span>
          </div>
        </div>
        <div class="text-right">
          <div class="text-lg font-semibold">{{ progressPercentLabel }}</div>
          <div class="text-xs text-muted-foreground">{{ progressSummary }}</div>
          <div class="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
            <span>ETA {{ fmtEta(campaignProgress.etaSeconds) }}</span>
            <span>Elapsed {{ fmtEta(campaignProgress.elapsedSeconds) }}</span>
            <span>Laju {{ fmtRate(campaignProgress.throughputPerMinute) }}</span>
            <span>Tick {{ fmt(campaignProgress.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <div class="mt-4 h-3 overflow-hidden rounded-full bg-muted">
        <div
          v-if="campaignProgress.indeterminate"
          class="h-full w-2/5 animate-pulse rounded-full bg-blue-500"
        ></div>
        <div
          v-else
          :class="cn('h-full rounded-full transition-all duration-500', progressTone)"
          :style="{ width: progressWidth }"
        ></div>
      </div>

      <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-5 xl:grid-cols-10">
        <div>
          <dt class="text-xs text-muted-foreground">Processed</dt>
          <dd>{{ campaignProgress.processed.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Discovered</dt>
          <dd>{{ campaignProgress.discovered.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Persisted</dt>
          <dd>{{ campaignProgress.persisted.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Success</dt>
          <dd class="text-emerald-600 dark:text-emerald-400">
            {{ campaignProgress.success.toLocaleString("id-ID") }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Failed</dt>
          <dd class="text-red-600 dark:text-red-400">
            {{ campaignProgress.failed.toLocaleString("id-ID") }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Skipped</dt>
          <dd>{{ campaignProgress.skipped.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Pending / Running</dt>
          <dd>
            {{ campaignProgress.pending.toLocaleString("id-ID") }} /
            {{ campaignProgress.running.toLocaleString("id-ID") }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Batch Done / Active</dt>
          <dd>
            {{ campaignProgress.completedBatches.toLocaleString("id-ID") }} /
            {{ campaignProgress.activeBatches.toLocaleString("id-ID") }}
          </dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Skip Type</dt>
          <dd>{{ campaignProgress.skippedByType.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Skip Minimum</dt>
          <dd>{{ campaignProgress.skippedByMemberCount.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Skip Nama</dt>
          <dd>{{ campaignProgress.skippedByMissingName.toLocaleString("id-ID") }}</dd>
        </div>
        <div>
          <dt class="text-xs text-muted-foreground">Skip Duplikat</dt>
          <dd>{{ campaignProgress.skippedDuplicates.toLocaleString("id-ID") }}</dd>
        </div>
      </dl>
    </section>

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <div
        v-for="card in overviewCards"
        :key="card.label"
        class="rounded-lg border border-border bg-card p-4"
      >
        <div class="text-xs uppercase tracking-wide text-muted-foreground">
          {{ card.label }}
        </div>
        <div class="mt-2 text-lg font-semibold" :class="card.tone">{{ card.value }}</div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_0.95fr]">
      <div class="space-y-3 rounded-lg border border-border bg-card p-4">
        <div class="flex items-center gap-2">
          <span
            :class="
              cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                statusBadge(campaign.status)
              )
            "
            >{{ campaign.status }}</span
          >
          <span class="text-sm text-muted-foreground">{{
            typeLabel(campaign.type)
          }}</span>
        </div>
        <dl class="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <div v-if="campaign.config.url" class="col-span-2 sm:col-span-3">
            <dt class="text-xs text-muted-foreground">URL</dt>
            <dd class="break-all">{{ campaign.config.url }}</dd>
          </div>
          <div v-if="campaign.config.caption" class="col-span-2 sm:col-span-3">
            <dt class="text-xs text-muted-foreground">Caption</dt>
            <dd class="whitespace-pre-wrap">{{ campaign.config.caption }}</dd>
          </div>
          <div v-if="campaign.config.keyword">
            <dt class="text-xs text-muted-foreground">Keyword</dt>
            <dd>{{ campaign.config.keyword }}</dd>
          </div>
          <div v-if="campaign.config.friendProfileUrl" class="col-span-2">
            <dt class="text-xs text-muted-foreground">Friend URL</dt>
            <dd class="break-all">{{ campaign.config.friendProfileUrl }}</dd>
          </div>
          <div v-if="campaign.targetGroupType">
            <dt class="text-xs text-muted-foreground">Target group</dt>
            <dd class="capitalize">{{ campaign.targetGroupType }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Fingerprint</dt>
            <dd>
              <Link
                v-if="campaign.fingerprint"
                :href="`/fingerprints/${campaign.fingerprint.id}`"
                class="inline-flex items-center gap-1 hover:underline"
              >
                {{ campaign.fingerprint.name }}
                <ExternalLink class="size-3.5" />
              </Link>
              <span v-else>—</span>
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Proxy</dt>
            <dd>{{ campaign.useProxy ? "Ya" : "Tidak" }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Concurrency</dt>
            <dd>{{ campaign.maxConcurrency }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Max akun</dt>
            <dd>{{ campaign.maxAccounts }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Delay</dt>
            <dd>{{ campaign.maxDelayMs }}ms</dd>
          </div>
          <div v-if="campaign.maxTargets">
            <dt class="text-xs text-muted-foreground">Max target</dt>
            <dd>{{ campaign.maxTargets }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Dibuat</dt>
            <dd>{{ fmt(campaign.createdAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Mulai</dt>
            <dd>{{ fmt(campaign.startedAt) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">Selesai</dt>
            <dd>{{ fmt(campaign.endedAt) }}</dd>
          </div>
        </dl>
      </div>

      <div class="space-y-4 rounded-lg border border-border bg-card p-4">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-primary" />
          <h3 class="text-sm font-medium">Detail Report</h3>
        </div>
        <dl class="grid gap-3 text-sm">
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Runtime Campaign</dt>
            <dd class="mt-1">{{ fmtDuration(campaignReport.runtimeMs) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Rata-rata Durasi Log</dt>
            <dd class="mt-1">{{ fmtDuration(campaignReport.averageDurationMs) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Log Pertama / Terakhir</dt>
            <dd class="mt-1">{{ fmt(campaignReport.firstLogAt) }}</dd>
            <dd class="text-xs text-muted-foreground">
              {{ fmt(campaignReport.lastLogAt) }}
            </dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">
              Akun Completed / Failed / Pending
            </dt>
            <dd class="mt-1">
              {{ relationSummary.accounts.completed }} /
              {{ relationSummary.accounts.failed }} /
              {{ relationSummary.accounts.pending }}
            </dd>
            <dd class="text-xs text-muted-foreground">
              Completion {{ fmtPercent(campaignReport.accountCompletionRate) }}
            </dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">
              Group Completed / Failed / Pending
            </dt>
            <dd class="mt-1">
              {{ relationSummary.groups.completed }} /
              {{ relationSummary.groups.failed }} /
              {{ relationSummary.groups.pending }}
            </dd>
            <dd class="text-xs text-muted-foreground">
              Completion {{ fmtPercent(campaignReport.groupCompletionRate) }}
            </dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">
              Checkpoint / Skipped / Pending Log
            </dt>
            <dd class="mt-1">
              {{ campaignReport.checkpointLogs }} / {{ campaignReport.skippedLogs }} /
              {{ campaignReport.pendingLogs }}
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="grid gap-4 xl:grid-cols-2">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <Users class="size-4 text-primary" />
            <div>
              <h3 class="text-sm font-medium">Relation Akun</h3>
              <p class="text-xs text-muted-foreground">
                Status akun campaign, sesi Facebook, dan performa log per akun.
              </p>
            </div>
          </div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ campaign.accounts.length }} akun
          </span>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground">
              <tr class="border-b border-border">
                <th class="px-3 py-2.5 text-left font-medium">Akun</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                <th class="px-3 py-2.5 text-right font-medium">Log</th>
                <th class="px-3 py-2.5 text-right font-medium">Success</th>
                <th class="px-3 py-2.5 text-right font-medium">Error</th>
                <th class="px-3 py-2.5 text-left font-medium">Aktivitas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="campaign.accounts.length === 0">
                <td colspan="6" class="px-3 py-10 text-center text-muted-foreground">
                  Tidak ada akun yang terhubung ke campaign ini.
                </td>
              </tr>
              <tr
                v-for="row in campaign.accounts"
                :key="row.id"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-3 py-2.5">
                  <Link
                    :href="`/accounts/${row.accountId}`"
                    class="font-medium text-primary hover:underline"
                  >
                    {{ row.label }}
                  </Link>
                  <div class="text-xs text-muted-foreground">
                    {{ row.fbUserId || "FB user id belum ada" }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    Sesi {{ row.sessionStatus || "—" }}
                  </div>
                </td>
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
                <td class="px-3 py-2.5 text-right">{{ row.logCount }}</td>
                <td class="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                  {{ row.successCount }}
                </td>
                <td class="px-3 py-2.5 text-right text-red-600 dark:text-red-400">
                  {{ row.errorCount }}
                </td>
                <td class="px-3 py-2.5">
                  <div>{{ fmt(row.lastLogAt) }}</div>
                  <div class="text-xs text-muted-foreground">
                    Last used {{ fmt(row.lastUsedAt) }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <FolderKanban class="size-4 text-primary" />
            <div>
              <h3 class="text-sm font-medium">Relation Group</h3>
              <p class="text-xs text-muted-foreground">
                Target group, metadata scrape, dan progres proses per group.
              </p>
            </div>
          </div>
          <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            {{ campaign.groups.length }} group
          </span>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-muted-foreground">
              <tr class="border-b border-border">
                <th class="px-3 py-2.5 text-left font-medium">Group</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                <th class="px-3 py-2.5 text-right font-medium">Member</th>
                <th class="px-3 py-2.5 text-right font-medium">Log</th>
                <th class="px-3 py-2.5 text-right font-medium">Success</th>
                <th class="px-3 py-2.5 text-left font-medium">Aktivitas</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="campaign.groups.length === 0">
                <td colspan="6" class="px-3 py-10 text-center text-muted-foreground">
                  Tidak ada target group di campaign ini.
                </td>
              </tr>
              <tr
                v-for="row in campaign.groups"
                :key="row.id"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-3 py-2.5">
                  <Link
                    :href="`/groups/${row.relationGroupId}`"
                    class="font-medium text-primary hover:underline"
                  >
                    {{ row.groupName || row.groupId }}
                  </Link>
                  <div class="font-mono text-xs text-muted-foreground">
                    {{ row.groupId }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ row.groupType || "—" }} · source {{ row.sourceType || "—" }}
                  </div>
                </td>
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
                <td class="px-3 py-2.5 text-right">{{ fmtNumber(row.memberCount) }}</td>
                <td class="px-3 py-2.5 text-right">{{ row.logCount }}</td>
                <td class="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                  {{ row.successCount }}
                </td>
                <td class="px-3 py-2.5">
                  <div>{{ fmt(row.lastLogAt) }}</div>
                  <div class="text-xs text-muted-foreground">
                    Diproses {{ fmt(row.processedAt) }}
                  </div>
                  <div
                    v-if="row.groupUrl || row.sourceKeyword"
                    class="text-xs text-muted-foreground"
                  >
                    {{ row.sourceKeyword || row.groupUrl }}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="rounded-lg border border-border bg-card p-5">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <LayoutList class="size-4 text-primary" />
          <div>
            <h3 class="text-sm font-medium">Analisa Aksi Log</h3>
            <p class="text-xs text-muted-foreground">
              Distribusi aktivitas automation untuk campaign ini berdasarkan nama aksi.
            </p>
          </div>
        </div>
        <span class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
          {{ actionReport.length }} aksi
        </span>
      </div>
      <div class="mt-4 overflow-x-auto rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-muted-foreground">
            <tr class="border-b border-border">
              <th class="px-3 py-2.5 text-left font-medium">Aksi</th>
              <th class="px-3 py-2.5 text-right font-medium">Total</th>
              <th class="px-3 py-2.5 text-right font-medium">Success</th>
              <th class="px-3 py-2.5 text-right font-medium">Error</th>
              <th class="px-3 py-2.5 text-left font-medium">Aktivitas Terakhir</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="actionReport.length === 0">
              <td colspan="5" class="px-3 py-10 text-center text-muted-foreground">
                Belum ada aksi yang tercatat.
              </td>
            </tr>
            <tr
              v-for="row in actionReport"
              :key="row.action"
              class="border-b border-border last:border-0 hover:bg-muted/40"
            >
              <td class="px-3 py-2.5 font-medium">{{ row.action }}</td>
              <td class="px-3 py-2.5 text-right">{{ row.total }}</td>
              <td class="px-3 py-2.5 text-right text-emerald-600 dark:text-emerald-400">
                {{ row.success }}
              </td>
              <td class="px-3 py-2.5 text-right text-red-600 dark:text-red-400">
                {{ row.error }}
              </td>
              <td class="px-3 py-2.5">{{ fmt(row.lastActivityAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section
      v-if="campaign.type === 'scrape_group'"
      :class="
        cn(
          'rounded-lg border p-5',
          fallbackLogs.length
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-border bg-card'
        )
      "
    >
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-medium text-amber-700 dark:text-amber-300">
            Fallback Akun Scrape
          </h3>
          <p
            :class="
              fallbackLogs.length
                ? 'text-xs text-amber-700/80 dark:text-amber-200/80'
                : 'text-xs text-muted-foreground'
            "
          >
            Menunjukkan kapan worker pindah ke akun berikutnya saat akun sebelumnya
            logout, checkpoint, atau gagal dipakai.
          </p>
        </div>
        <span
          :class="
            cn(
              'rounded-full px-2.5 py-1 text-xs',
              fallbackLogs.length
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                : 'bg-muted text-muted-foreground'
            )
          "
        >
          {{ fallbackLogs.length }} fallback
        </span>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-3">
        <div
          :class="
            cn(
              'rounded-lg border p-4',
              fallbackLogs.length
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-border bg-background/60'
            )
          "
        >
          <div
            :class="
              fallbackLogs.length
                ? 'text-xs text-amber-700/80 dark:text-amber-200/80'
                : 'text-xs text-muted-foreground'
            "
          >
            Total Fallback
          </div>
          <div class="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-300">
            {{ fallbackLogs.length.toLocaleString("id-ID") }}
          </div>
        </div>
        <div
          :class="
            cn(
              'rounded-lg border p-4',
              fallbackLogs.length
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-border bg-background/60'
            )
          "
        >
          <div
            :class="
              fallbackLogs.length
                ? 'text-xs text-amber-700/80 dark:text-amber-200/80'
                : 'text-xs text-muted-foreground'
            "
          >
            Akun Terdampak
          </div>
          <div class="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
            {{
              fallbackAccounts.length
                ? fallbackAccounts.join(", ")
                : "Belum ada fallback akun"
            }}
          </div>
        </div>
        <div
          :class="
            cn(
              'rounded-lg border p-4',
              fallbackLogs.length
                ? 'border-amber-500/30 bg-amber-500/10'
                : 'border-border bg-background/60'
            )
          "
        >
          <div
            :class="
              fallbackLogs.length
                ? 'text-xs text-amber-700/80 dark:text-amber-200/80'
                : 'text-xs text-muted-foreground'
            "
          >
            Fallback Terakhir
          </div>
          <div class="mt-2 text-sm font-medium text-amber-900 dark:text-amber-100">
            {{ lastFallbackLog ? fmt(lastFallbackLog.createdAt) : "Belum ada" }}
          </div>
          <div
            v-if="lastFallbackLog?.message"
            class="mt-1 text-xs text-amber-800/80 dark:text-amber-100/80"
          >
            {{ lastFallbackLog.message }}
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-border bg-card p-5">
      <h3 class="mb-2 flex items-center gap-2 text-sm font-medium">
        Log Terbaru
        <span
          v-if="streaming"
          class="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400"
        >
          <span class="size-1.5 animate-pulse rounded-full bg-blue-500"></span> live
        </span>
      </h3>
      <div class="overflow-x-auto rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-muted-foreground">
            <tr class="border-b border-border">
              <th class="px-3 py-2.5 text-left font-medium">Status</th>
              <th class="px-3 py-2.5 text-left font-medium">Aksi</th>
              <th class="px-3 py-2.5 text-left font-medium">Relasi</th>
              <th class="px-3 py-2.5 text-left font-medium">Pesan</th>
              <th class="px-3 py-2.5 text-right font-medium">Durasi</th>
              <th class="px-3 py-2.5 text-left font-medium">Waktu</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="liveLogs.length === 0">
              <td colspan="6" class="px-3 py-10 text-center text-muted-foreground">
                Belum ada log. Log muncul saat campaign dijalankan.
              </td>
            </tr>
            <tr
              v-for="l in liveLogs"
              :key="l.id"
              :class="[
                'border-b border-border last:border-0 hover:bg-muted/40',
                l.action === 'scrape_fallback' ? 'bg-amber-500/5' : '',
              ]"
            >
              <td class="px-3 py-2.5">
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
              </td>
              <td class="px-3 py-2.5 font-medium">
                <div>{{ actionLabel(l.action) }}</div>
                <div
                  v-if="l.action === 'scrape_fallback'"
                  class="text-[10px] text-amber-600 dark:text-amber-400"
                >
                  Worker pindah otomatis ke akun berikutnya
                </div>
              </td>
              <td class="px-3 py-2.5">
                <div>{{ l.accountLabel || "—" }}</div>
                <div class="text-xs text-muted-foreground">{{ l.groupName || "—" }}</div>
              </td>
              <td class="px-3 py-2.5">
                <div class="max-w-xl whitespace-pre-wrap text-xs text-muted-foreground">
                  {{ l.message || "—" }}
                </div>
                <div v-if="l.screenshotPath" class="text-[10px] text-muted-foreground">
                  Screenshot: {{ l.screenshotPath }}
                </div>
              </td>
              <td class="px-3 py-2.5 text-right">{{ fmtDuration(l.durationMs) }}</td>
              <td class="px-3 py-2.5">{{ fmt(l.createdAt) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </App>
</template>
