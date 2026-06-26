<script setup lang="ts">
import { computed } from "vue";
import { Head } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  FolderKanban,
  LayoutList,
  Users,
} from "@lucide/vue";

type GroupRow = {
  id: string;
  groupId: string;
  groupName: string | null;
  groupUrl: string | null;
  groupType: string;
  memberCount: number | null;
  sourceType: string;
  sourceKeyword: string | null;
  sourceFriendUrl: string | null;
  tags: string[];
  createdAt: string | null;
  updatedAt: string | null;
};

type GroupReport = {
  totalLogs: number;
  successLogs: number;
  errorLogs: number;
  pendingLogs: number;
  checkpointLogs: number;
  skippedLogs: number;
  relatedCampaigns: number;
  uniqueCampaignsTouched: number;
  uniqueAccountsTouched: number;
  averageDurationMs: number | null;
  logSuccessRate: number;
  firstLogAt: string | null;
  lastLogAt: string | null;
};

type RelationSummary = {
  campaigns: {
    total: number;
    running: number;
    paused: number;
    completed: number;
    failed: number;
    draft: number;
  };
  accounts: {
    total: number;
    successful: number;
    failed: number;
    pending: number;
  };
};

type CampaignRelation = {
  id: string;
  campaignId: string;
  relationStatus: string;
  linkedAt: string | null;
  processedAt: string | null;
  name: string;
  type: string;
  status: string;
  accountsAssigned: number;
  groupsAssigned: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  logCount: number;
  successCount: number;
  errorCount: number;
  lastLogAt: string | null;
};

type AccountRelation = {
  id: string;
  accountId: string;
  label: string;
  fbUserId: string | null;
  sessionStatus: string | null;
  lastUsedAt: string | null;
  logCount: number;
  successCount: number;
  errorCount: number;
  campaignCount: number;
  lastLogAt: string | null;
};

type ActionReportRow = {
  action: string;
  total: number;
  success: number;
  error: number;
  lastActivityAt: string | null;
};

type RecentLogRow = {
  id: string;
  campaignId: string;
  campaignName: string;
  accountId: string | null;
  accountLabel: string | null;
  action: string;
  status: string;
  message: string | null;
  durationMs: number | null;
  screenshotPath: string | null;
  createdAt: string | null;
};

const props = defineProps<{
  data: GroupRow;
  groupReport: GroupReport;
  relationSummary: RelationSummary;
  campaignRelations: CampaignRelation[];
  accountRelations: AccountRelation[];
  actionReport: ActionReportRow[];
  logs: RecentLogRow[];
}>();

const statusBadge = (status: string) =>
  ({
    draft: "bg-muted text-muted-foreground",
    running: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    paused: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    success: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    failed: "bg-red-500/15 text-red-600 dark:text-red-400",
    error: "bg-red-500/15 text-red-600 dark:text-red-400",
    checkpoint: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    skipped: "bg-muted text-muted-foreground",
    public: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    private: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    inactive: "bg-muted text-muted-foreground",
  }[status] ?? "bg-muted text-muted-foreground");

const typeLabel = (type: string) =>
  ({ scrape_group: "Scrape Group", auto_share: "Auto Share", auto_join: "Auto Join" }[
    type
  ] ?? type);

function fmtDate(value: string | null) {
  return value ? new Date(value).toLocaleString("id-ID") : "—";
}

function fmtNumber(value: number | null) {
  return value === null ? "—" : value.toLocaleString("id-ID");
}

function fmtPercent(value: number) {
  return `${value.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
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

const heroMeta = computed(() => [
  {
    label: props.data.groupType,
    tone: statusBadge(props.data.groupType),
  },
  {
    label: `${fmtNumber(props.data.memberCount)} member`,
    tone: "bg-primary/10 text-primary",
  },
  {
    label: `Sumber ${props.data.sourceType.replace("_", " ")}`,
    tone: "bg-muted text-muted-foreground",
  },
  {
    label: props.data.groupId,
    tone: "bg-muted text-muted-foreground font-mono",
  },
]);

const overviewCards = computed(() => [
  {
    label: "Total Campaign",
    value: props.relationSummary.campaigns.total.toLocaleString("id-ID"),
    tone: "text-foreground",
    shell: "rounded-lg border border-border bg-background p-4",
  },
  {
    label: "Account Tersentuh",
    value: props.groupReport.uniqueAccountsTouched.toLocaleString("id-ID"),
    tone: "text-foreground",
    shell: "rounded-lg border border-border bg-background p-4",
  },
  {
    label: "Total Logs",
    value: props.groupReport.totalLogs.toLocaleString("id-ID"),
    tone: "text-foreground",
    shell: "rounded-lg border border-border bg-background p-4",
  },
  {
    label: "Success Rate",
    value: fmtPercent(props.groupReport.logSuccessRate),
    tone: "text-emerald-600 dark:text-emerald-400",
    shell:
      "rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm",
  },
  {
    label: "Error Logs",
    value: props.groupReport.errorLogs.toLocaleString("id-ID"),
    tone: "text-red-600 dark:text-red-400",
    shell: "rounded-lg border border-red-500/30 bg-red-500/10 p-4 shadow-sm",
  },
  {
    label: "Member Count",
    value: fmtNumber(props.data.memberCount),
    tone: "text-primary",
    shell: "rounded-lg border border-primary/30 bg-primary/10 p-4 shadow-sm",
  },
]);

const featuredCampaignLinks = computed(() => props.campaignRelations.slice(0, 3));
const featuredAccountLinks = computed(() => props.accountRelations.slice(0, 3));
const primaryCampaignLink = computed(() => props.campaignRelations[0] ?? null);
const primaryAccountLink = computed(() => props.accountRelations[0] ?? null);
</script>

<template>
  <Head :title="`Group · ${data.groupName || data.groupId}`" />
  <App
    :title="data.groupName || data.groupId"
    description="Detail group Facebook, relasi campaign, account activity, dan report analytics."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Link
          href="/groups"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft class="size-4" /> Kembali
        </Link>
        <a
          v-if="data.groupUrl"
          :href="data.groupUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <ExternalLink class="size-4" /> Buka Group
        </a>
      </div>
    </template>

    <div class="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-start gap-3">
          <div
            class="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
          >
            <FolderKanban class="size-5" />
          </div>
          <div class="min-w-0 space-y-3">
            <div class="space-y-1">
              <div class="text-xs uppercase tracking-wide text-muted-foreground">
                Group Overview
              </div>
              <h2 class="text-lg font-semibold">{{ data.groupName || data.groupId }}</h2>
            </div>
            <div class="flex flex-wrap gap-2">
              <span
                v-for="item in heroMeta"
                :key="item.label"
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs"
                :class="item.tone"
              >
                {{ item.label }}
              </span>
            </div>
            <p class="text-sm text-muted-foreground">
              Detail group Facebook, ringkasan performa campaign, dan aktivitas account
              yang pernah menyentuh group ini.
            </p>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div
            v-for="card in overviewCards"
            :key="card.label"
            :class="card.shell"
          >
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              {{ card.label }}
            </div>
            <div class="mt-2 text-2xl font-semibold leading-none" :class="card.tone">
              {{ card.value }}
            </div>
          </div>
        </div>

        <div class="mt-5 grid gap-3 sm:grid-cols-2">
          <div class="rounded-lg border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Source Keyword
            </div>
            <div class="mt-2 text-sm text-muted-foreground">
              {{ data.sourceKeyword || "—" }}
            </div>
          </div>
          <div class="rounded-lg border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Source Friend URL
            </div>
            <div class="mt-2 break-all text-sm text-muted-foreground">
              {{ data.sourceFriendUrl || "—" }}
            </div>
          </div>
        </div>

        <div class="mt-5 rounded-lg border border-border bg-background p-4">
          <div class="text-xs uppercase tracking-wide text-muted-foreground">Tags</div>
          <div class="mt-2 flex flex-wrap gap-2">
            <span
              v-for="tag in data.tags"
              :key="tag"
              class="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
            >
              {{ tag }}
            </span>
            <span v-if="!data.tags.length" class="text-sm text-muted-foreground">—</span>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Detail Group</h2>
        </div>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm">
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">ID Group</dt>
            <dd class="mt-1 break-all font-mono text-xs">{{ data.id }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Created</dt>
            <dd class="mt-1">{{ fmtDate(data.createdAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Updated</dt>
            <dd class="mt-1">{{ fmtDate(data.updatedAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Log Pertama</dt>
            <dd class="mt-1">{{ fmtDate(groupReport.firstLogAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Log Terakhir</dt>
            <dd class="mt-1">{{ fmtDate(groupReport.lastLogAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Campaign Utama</dt>
            <dd class="mt-1 space-y-1">
              <Link
                v-if="primaryCampaignLink"
                :href="`/campaigns/${primaryCampaignLink.campaignId}`"
                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
              >
                Buka {{ primaryCampaignLink.name }}
              </Link>
              <span v-else class="text-sm text-muted-foreground">—</span>
              <div
                v-if="primaryCampaignLink"
                class="text-xs text-muted-foreground"
              >
                {{ typeLabel(primaryCampaignLink.type) }} · {{ primaryCampaignLink.logCount }} log
              </div>
            </dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Account Utama</dt>
            <dd class="mt-1 space-y-1">
              <Link
                v-if="primaryAccountLink"
                :href="`/accounts/${primaryAccountLink.accountId}`"
                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
              >
                Buka {{ primaryAccountLink.label }}
              </Link>
              <span v-else class="text-sm text-muted-foreground">—</span>
              <div v-if="primaryAccountLink" class="text-xs text-muted-foreground">
                {{ primaryAccountLink.logCount }} log · session
                {{ primaryAccountLink.sessionStatus || "—" }}
              </div>
            </dd>
          </div>
        </dl>
      </section>
    </div>

    <div class="mt-4 grid gap-4 xl:grid-cols-3">
      <section class="rounded-lg border border-border bg-card p-5 xl:col-span-2">
        <div class="flex items-center gap-2">
          <LayoutList class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Ringkasan Analytics</h2>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Success / Error</div>
            <div class="mt-1 text-lg font-semibold">
              {{ groupReport.successLogs }} / {{ groupReport.errorLogs }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Checkpoint / Skipped</div>
            <div class="mt-1 text-lg font-semibold">
              {{ groupReport.checkpointLogs }} / {{ groupReport.skippedLogs }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Pending Logs</div>
            <div class="mt-1 text-lg font-semibold">{{ groupReport.pendingLogs }}</div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Avg Duration</div>
            <div class="mt-1 text-lg font-semibold">
              {{ fmtDuration(groupReport.averageDurationMs) }}
            </div>
          </div>
        </div>

        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <div class="rounded-md border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Relation Campaign
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>Total: {{ relationSummary.campaigns.total }}</div>
              <div>Running: {{ relationSummary.campaigns.running }}</div>
              <div>Paused: {{ relationSummary.campaigns.paused }}</div>
              <div>Completed: {{ relationSummary.campaigns.completed }}</div>
              <div>Failed: {{ relationSummary.campaigns.failed }}</div>
              <div>Draft: {{ relationSummary.campaigns.draft }}</div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <Link
                v-for="row in featuredCampaignLinks"
                :key="row.id"
                :href="`/campaigns/${row.campaignId}`"
                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
              >
                Campaign: {{ row.name }}
              </Link>
              <span
                v-if="!featuredCampaignLinks.length"
                class="text-xs text-muted-foreground"
              >
                Belum ada campaign terkait.
              </span>
            </div>
          </div>
          <div class="rounded-md border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Relation Account
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>Total: {{ relationSummary.accounts.total }}</div>
              <div>Success: {{ relationSummary.accounts.successful }}</div>
              <div>Failed: {{ relationSummary.accounts.failed }}</div>
              <div>Pending: {{ relationSummary.accounts.pending }}</div>
              <div>Campaign Tersentuh: {{ groupReport.uniqueCampaignsTouched }}</div>
              <div>Account Tersentuh: {{ groupReport.uniqueAccountsTouched }}</div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <Link
                v-for="row in featuredAccountLinks"
                :key="row.id"
                :href="`/accounts/${row.accountId}`"
                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
              >
                Account: {{ row.label }}
              </Link>
              <span
                v-if="!featuredAccountLinks.length"
                class="text-xs text-muted-foreground"
              >
                Belum ada account terkait.
              </span>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Activity Window</h2>
        </div>
        <div class="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Campaign Relasi</div>
            <div class="mt-1 text-lg font-semibold">
              {{ groupReport.relatedCampaigns }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Campaign Tersentuh</div>
            <div class="mt-1 text-lg font-semibold">
              {{ groupReport.uniqueCampaignsTouched }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Account Tersentuh</div>
            <div class="mt-1 text-lg font-semibold">
              {{ groupReport.uniqueAccountsTouched }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Quick Link Campaign</div>
            <div class="mt-2 flex items-center gap-2">
              <Link
                v-if="primaryCampaignLink"
                :href="`/campaigns/${primaryCampaignLink.campaignId}`"
                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
              >
                Detail Campaign
              </Link>
              <span v-else class="text-sm text-muted-foreground">—</span>
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Quick Link Account</div>
            <div class="mt-2 flex items-center gap-2">
              <Link
                v-if="primaryAccountLink"
                :href="`/accounts/${primaryAccountLink.accountId}`"
                class="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs text-primary hover:bg-muted"
              >
                Detail Account
              </Link>
              <span v-else class="text-sm text-muted-foreground">—</span>
            </div>
          </div>
        </div>
      </section>
    </div>

    <section class="mt-4 rounded-lg border border-border bg-card p-5">
      <div class="flex items-center gap-2">
        <FolderKanban class="size-4 text-primary" />
        <h2 class="text-base font-semibold">Relation Campaign</h2>
      </div>
      <div class="mt-4 overflow-x-auto rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/60 text-left">
            <tr class="border-b border-border">
              <th class="px-4 py-3 font-medium">Campaign</th>
              <th class="px-4 py-3 font-medium">Type</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Relation</th>
              <th class="px-4 py-3 font-medium">Logs</th>
              <th class="px-4 py-3 font-medium">Success / Error</th>
              <th class="px-4 py-3 font-medium">Akun / Group</th>
              <th class="px-4 py-3 font-medium">Last Activity</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in campaignRelations"
              :key="row.id"
              class="border-b border-border last:border-0 hover:bg-muted/40"
            >
              <td class="px-4 py-3 align-top">
                <Link
                  :href="`/campaigns/${row.campaignId}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.name }}
                </Link>
                <div class="mt-1">
                  <Link
                    :href="`/campaigns/${row.campaignId}`"
                    class="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-primary hover:bg-muted"
                  >
                    Detail Campaign
                  </Link>
                </div>
                <div class="text-xs text-muted-foreground">
                  linked {{ fmtDate(row.linkedAt) }}
                </div>
              </td>
              <td class="px-4 py-3 align-top">{{ typeLabel(row.type) }}</td>
              <td class="px-4 py-3 align-top">
                <div class="flex flex-col gap-1">
                  <span
                    class="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="statusBadge(row.status)"
                  >
                    {{ row.status }}
                  </span>
                  <span class="text-xs text-muted-foreground">{{
                    row.relationStatus
                  }}</span>
                </div>
              </td>
              <td class="px-4 py-3 align-top">
                {{ fmtDate(row.processedAt || row.createdAt) }}
              </td>
              <td class="px-4 py-3 align-top">{{ row.logCount }}</td>
              <td class="px-4 py-3 align-top">
                {{ row.successCount }} / {{ row.errorCount }}
              </td>
              <td class="px-4 py-3 align-top">
                {{ row.accountsAssigned }} / {{ row.groupsAssigned }}
              </td>
              <td class="px-4 py-3 align-top">{{ fmtDate(row.lastLogAt) }}</td>
            </tr>
            <tr v-if="!campaignRelations.length">
              <td colspan="8" class="px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada relasi campaign untuk group ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="mt-4 grid gap-4 xl:grid-cols-2">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Users class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Relation Account</h2>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
          <thead class="bg-muted/60 text-left">
              <tr class="border-b border-border">
                <th class="px-4 py-3 font-medium">Account</th>
                <th class="px-4 py-3 font-medium">Session</th>
                <th class="px-4 py-3 font-medium">Campaign</th>
                <th class="px-4 py-3 font-medium">Logs</th>
                <th class="px-4 py-3 font-medium">Success / Error</th>
                <th class="px-4 py-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in accountRelations"
                :key="row.id"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-4 py-3 align-top">
                  <Link
                    :href="`/accounts/${row.accountId}`"
                    class="font-medium text-primary hover:underline"
                  >
                    {{ row.label }}
                  </Link>
                  <div class="mt-1">
                    <Link
                      :href="`/accounts/${row.accountId}`"
                      class="inline-flex items-center rounded-full border border-border px-2 py-0.5 text-[10px] text-primary hover:bg-muted"
                    >
                      Detail Account
                    </Link>
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ row.fbUserId || "FB user id belum ada" }}
                  </div>
                </td>
                <td class="px-4 py-3 align-top">
                  <span
                    class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                    :class="statusBadge(row.sessionStatus || 'inactive')"
                  >
                    {{ row.sessionStatus || "—" }}
                  </span>
                </td>
                <td class="px-4 py-3 align-top">{{ row.campaignCount }}</td>
                <td class="px-4 py-3 align-top">{{ row.logCount }}</td>
                <td class="px-4 py-3 align-top">
                  {{ row.successCount }} / {{ row.errorCount }}
                </td>
                <td class="px-4 py-3 align-top">
                  <div>{{ fmtDate(row.lastLogAt) }}</div>
                  <div class="text-xs text-muted-foreground">
                    Last used {{ fmtDate(row.lastUsedAt) }}
                  </div>
                </td>
              </tr>
              <tr v-if="!accountRelations.length">
                <td
                  colspan="6"
                  class="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada account relation yang tercatat untuk group ini.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Action Report</h2>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
          <thead class="bg-muted/60 text-left">
              <tr class="border-b border-border">
                <th class="px-4 py-3 font-medium">Action</th>
                <th class="px-4 py-3 font-medium">Total</th>
                <th class="px-4 py-3 font-medium">Success</th>
                <th class="px-4 py-3 font-medium">Error</th>
                <th class="px-4 py-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in actionReport"
                :key="row.action"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-4 py-3 align-top font-medium">{{ row.action }}</td>
                <td class="px-4 py-3 align-top">{{ row.total }}</td>
                <td class="px-4 py-3 align-top">{{ row.success }}</td>
                <td class="px-4 py-3 align-top">{{ row.error }}</td>
                <td class="px-4 py-3 align-top">{{ fmtDate(row.lastActivityAt) }}</td>
              </tr>
              <tr v-if="!actionReport.length">
                <td
                  colspan="5"
                  class="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada action log untuk group ini.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <section class="mt-4 rounded-lg border border-border bg-card p-5">
      <div class="flex items-center gap-2">
        <Activity class="size-4 text-primary" />
        <h2 class="text-base font-semibold">Recent Activity Logs</h2>
      </div>
      <div class="mt-4 overflow-x-auto rounded-lg border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/60 text-left">
            <tr class="border-b border-border">
              <th class="px-4 py-3 font-medium">Waktu</th>
              <th class="px-4 py-3 font-medium">Campaign</th>
              <th class="px-4 py-3 font-medium">Account</th>
              <th class="px-4 py-3 font-medium">Action</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Durasi</th>
              <th class="px-4 py-3 font-medium">Pesan</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in logs"
              :key="row.id"
              class="border-b border-border last:border-0 hover:bg-muted/40"
            >
              <td class="px-4 py-3 align-top">{{ fmtDate(row.createdAt) }}</td>
              <td class="px-4 py-3 align-top">
                <Link
                  :href="`/campaigns/${row.campaignId}`"
                  class="font-medium text-primary hover:underline"
                >
                  {{ row.campaignName }}
                </Link>
                <div class="text-xs text-muted-foreground">{{ row.campaignId }}</div>
              </td>
              <td class="px-4 py-3 align-top">
                <Link
                  v-if="row.accountId && row.accountLabel"
                  :href="`/accounts/${row.accountId}`"
                  class="text-primary hover:underline"
                >
                  {{ row.accountLabel }}
                </Link>
                <span v-else>{{ row.accountLabel || "—" }}</span>
              </td>
              <td class="px-4 py-3 align-top">{{ row.action }}</td>
              <td class="px-4 py-3 align-top">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="statusBadge(row.status)"
                >
                  {{ row.status }}
                </span>
              </td>
              <td class="w-28 px-4 py-3 align-top">{{ fmtDuration(row.durationMs) }}</td>
              <td class="px-4 py-3 align-top">
                <div class="max-w-xl line-clamp-2 text-muted-foreground">
                  {{ row.message || "—" }}
                </div>
              </td>
            </tr>
            <tr v-if="!logs.length">
              <td colspan="7" class="px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada activity log untuk group ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </App>
</template>

<style scoped></style>
