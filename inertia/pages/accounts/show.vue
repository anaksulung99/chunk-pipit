<script lang="ts" setup>
import { computed } from "vue";
import { Head } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import {
  ArrowLeft,
  Activity,
  Cookie,
  FolderKanban,
  Globe,
  LayoutList,
  Users,
  ExternalLink,
} from "@lucide/vue";
import { cn } from "~/lib/utils";

type AccountRow = {
  id: string;
  label: string;
  fbUserId: string | null;
  profileUrl: string | null;
  sessionStatus: string;
  notes: string | null;
  cookiesCount: number;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  user?: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
  cookies?: {
    id: string;
    accountId: string;
    key: string;
    value: string;
    domain: string | null;
    path: string | null;
    expires: string | null;
    httpOnly: boolean;
    secure: boolean;
    sameSite: string | null;
    createdAt: string | null;
    updatedAt: string | null;
  }[];
};

type AccountReport = {
  totalLogs: number;
  successLogs: number;
  errorLogs: number;
  pendingLogs: number;
  checkpointLogs: number;
  skippedLogs: number;
  relatedCampaigns: number;
  uniqueCampaignsTouched: number;
  uniqueGroupsTouched: number;
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
  groups: {
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
  name: string;
  type: string;
  status: string;
  fingerprintName: string | null;
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

type GroupRelation = {
  id: string;
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

type CookieReport = {
  total: number;
  secure: number;
  httpOnly: number;
  session: number;
  persistent: number;
  distinctDomains: number;
};

type CookieDomainRow = {
  domain: string;
  total: number;
  secure: number;
  httpOnly: number;
  session: number;
  lastUpdatedAt: string | null;
};

type RecentLogRow = {
  id: string;
  campaignId: string;
  campaignName: string;
  action: string;
  status: string;
  message: string | null;
  groupName: string | null;
  durationMs: number | null;
  screenshotPath: string | null;
  createdAt: string | null;
};

const props = defineProps<{
  data: AccountRow;
  accountReport: AccountReport;
  relationSummary: RelationSummary;
  campaignRelations: CampaignRelation[];
  groupRelations: GroupRelation[];
  actionReport: ActionReportRow[];
  cookieReport: CookieReport;
  cookieDomainReport: CookieDomainRow[];
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
    active: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    inactive: "bg-muted text-muted-foreground",
    expired: "bg-red-500/15 text-red-600 dark:text-red-400",
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

const overviewCards = computed(() => [
  {
    label: "Total Campaign",
    value: props.relationSummary.campaigns.total.toLocaleString("id-ID"),
    tone: "text-foreground",
  },
  {
    label: "Log Success Rate",
    value: fmtPercent(props.accountReport.logSuccessRate),
    tone: "text-foreground",
  },
  {
    label: "Group Tersentuh",
    value: props.accountReport.uniqueGroupsTouched.toLocaleString("id-ID"),
    tone: "text-blue-600 dark:text-blue-400",
  },
  {
    label: "Log Error",
    value: props.accountReport.errorLogs.toLocaleString("id-ID"),
    tone: "text-red-600 dark:text-red-400",
  },
  {
    label: "Cookie Domains",
    value: props.cookieReport.distinctDomains.toLocaleString("id-ID"),
    tone: "text-foreground",
  },
  {
    label: "Terakhir Dipakai",
    value: fmtDate(props.data.lastUsedAt),
    tone: "text-foreground",
  },
]);
</script>

<template>
  <Head :title="`Account · ${data.label}`" />
  <App
    :title="data.label"
    :description="`Detail akun Facebook, relasi campaign, dan report analytics untuk pemantauan session.`"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Link
          href="/accounts"
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
            <Users class="size-5" />
          </div>
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-lg font-semibold">{{ data.label }}</h2>
              <span
                class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                :class="statusBadge(data.sessionStatus)"
              >
                {{ data.sessionStatus }}
              </span>
            </div>
            <p class="text-sm text-muted-foreground">
              FB User ID: {{ data.fbUserId || "—" }} · Cookies:
              {{ data.cookiesCount.toLocaleString("id-ID") }}
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
              Profile URL
            </div>
            <div class="mt-2 flex items-center gap-2 text-sm">
              <span class="truncate text-muted-foreground">{{
                data.profileUrl || "—"
              }}</span>
              <a
                v-if="data.profileUrl"
                :href="data.profileUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 text-primary hover:underline"
              >
                Buka
                <ExternalLink class="size-3.5" />
              </a>
            </div>
          </div>
          <div class="rounded-lg border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Catatan
            </div>
            <p class="mt-2 text-sm text-muted-foreground">
              {{ data.notes || "Belum ada catatan tambahan untuk akun ini." }}
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Activity class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Detail Account</h2>
        </div>
        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm">
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">ID Account</dt>
            <dd class="mt-1 break-all font-mono text-xs">{{ data.id }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Pemilik</dt>
            <dd class="mt-1">
              {{ data.user?.fullName || data.user?.email || "—" }}
            </dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Dibuat</dt>
            <dd class="mt-1">{{ fmtDate(data.createdAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Diperbarui</dt>
            <dd class="mt-1">{{ fmtDate(data.updatedAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Log Pertama</dt>
            <dd class="mt-1">{{ fmtDate(accountReport.firstLogAt) }}</dd>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-2">
            <dt class="text-xs text-muted-foreground">Log Terakhir</dt>
            <dd class="mt-1">{{ fmtDate(accountReport.lastLogAt) }}</dd>
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
            <div class="text-xs text-muted-foreground">Total Logs</div>
            <div class="mt-1 text-lg font-semibold">
              {{ accountReport.totalLogs.toLocaleString("id-ID") }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Success / Error</div>
            <div class="mt-1 text-lg font-semibold">
              {{ accountReport.successLogs }} / {{ accountReport.errorLogs }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Checkpoint / Skipped</div>
            <div class="mt-1 text-lg font-semibold">
              {{ accountReport.checkpointLogs }} / {{ accountReport.skippedLogs }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Avg Duration</div>
            <div class="mt-1 text-lg font-semibold">
              {{ fmtDuration(accountReport.averageDurationMs) }}
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
          </div>
          <div class="rounded-md border border-border bg-background p-4">
            <div class="text-xs uppercase tracking-wide text-muted-foreground">
              Relation Group
            </div>
            <div class="mt-2 grid grid-cols-2 gap-2 text-sm">
              <div>Total: {{ relationSummary.groups.total }}</div>
              <div>Success: {{ relationSummary.groups.successful }}</div>
              <div>Failed: {{ relationSummary.groups.failed }}</div>
              <div>Pending: {{ relationSummary.groups.pending }}</div>
              <div>Campaign Aktif: {{ accountReport.relatedCampaigns }}</div>
              <div>Campaign Tersentuh: {{ accountReport.uniqueCampaignsTouched }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Cookie class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Cookie Overview</h2>
        </div>
        <div class="mt-4 grid gap-3 text-sm">
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Total Cookie</div>
            <div class="mt-1 text-lg font-semibold">{{ cookieReport.total }}</div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Secure / HttpOnly</div>
            <div class="mt-1 text-lg font-semibold">
              {{ cookieReport.secure }} / {{ cookieReport.httpOnly }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Session / Persistent</div>
            <div class="mt-1 text-lg font-semibold">
              {{ cookieReport.session }} / {{ cookieReport.persistent }}
            </div>
          </div>
          <div class="rounded-md border border-border bg-background px-3 py-3">
            <div class="text-xs text-muted-foreground">Distinct Domain</div>
            <div class="mt-1 text-lg font-semibold">
              {{ cookieReport.distinctDomains }}
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
          <thead class="bg-muted/50 text-left">
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
              <td class="px-4 py-3 align-top">{{ fmtDate(row.createdAt) }}</td>
              <td class="px-4 py-3 align-top">
                {{ row.logCount.toLocaleString("id-ID") }}
              </td>
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
                Belum ada relasi campaign untuk akun ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="mt-4 grid gap-4 xl:grid-cols-2">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Globe class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Relation Group</h2>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-teal-600/40 dark:bg-teal-600/20 text-left">
              <tr class="border-b border-border">
                <th class="px-4 py-3 font-medium">Group</th>
                <th class="px-4 py-3 font-medium">Type</th>
                <th class="px-4 py-3 font-medium">Campaign</th>
                <th class="px-4 py-3 font-medium">Logs</th>
                <th class="px-4 py-3 font-medium">Success / Error</th>
                <th class="px-4 py-3 font-medium">Last Activity</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in groupRelations"
                :key="row.id"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-4 py-3 align-top">
                  <Link
                    :href="`/groups/${row.id}`"
                    class="font-medium text-primary hover:underline"
                  >
                    {{ row.groupName || row.groupId }}
                  </Link>
                  <div class="text-xs text-muted-foreground">
                    {{ row.groupId }} · {{ fmtNumber(row.memberCount) }} member
                  </div>
                </td>
                <td class="px-4 py-3 align-top">{{ row.groupType || "—" }}</td>
                <td class="px-4 py-3 align-top">{{ row.campaignCount }}</td>
                <td class="px-4 py-3 align-top">{{ row.logCount }}</td>
                <td class="px-4 py-3 align-top">
                  {{ row.successCount }} / {{ row.errorCount }}
                </td>
                <td class="px-4 py-3 align-top">{{ fmtDate(row.lastLogAt) }}</td>
              </tr>
              <tr v-if="!groupRelations.length">
                <td
                  colspan="6"
                  class="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada group yang tercatat dari aktivitas akun ini.
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
            <thead class="bg-indigo-600/40 dark:bg-indigo-600/20 text-left">
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
                  Belum ada action log untuk akun ini.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div class="mt-4 grid gap-4 xl:grid-cols-2">
      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <Cookie class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Cookie Domain Report</h2>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-sky-600/40 dark:bg-sky-600/20 text-left">
              <tr class="border-b border-border">
                <th class="px-4 py-3 font-medium">Domain</th>
                <th class="px-4 py-3 font-medium">Total</th>
                <th class="px-4 py-3 font-medium">Secure</th>
                <th class="px-4 py-3 font-medium">HttpOnly</th>
                <th class="px-4 py-3 font-medium">Session</th>
                <th class="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in cookieDomainReport"
                :key="row.domain"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-4 py-3 align-top font-medium">{{ row.domain }}</td>
                <td class="px-4 py-3 align-top">{{ row.total }}</td>
                <td class="px-4 py-3 align-top">{{ row.secure }}</td>
                <td class="px-4 py-3 align-top">{{ row.httpOnly }}</td>
                <td class="px-4 py-3 align-top">{{ row.session }}</td>
                <td class="px-4 py-3 align-top">{{ fmtDate(row.lastUpdatedAt) }}</td>
              </tr>
              <tr v-if="!cookieDomainReport.length">
                <td
                  colspan="6"
                  class="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada domain cookie untuk akun ini.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="rounded-lg border border-border bg-card p-5">
        <div class="flex items-center gap-2">
          <LayoutList class="size-4 text-primary" />
          <h2 class="text-base font-semibold">Cookies Tersimpan</h2>
        </div>
        <div class="mt-4 overflow-x-auto rounded-lg border border-border">
          <table class="w-full text-sm">
            <thead class="bg-rose-600/40 dark:bg-rose-600/20 text-left">
              <tr class="border-b border-border">
                <th class="px-4 py-3 font-medium">Key</th>
                <th class="px-4 py-3 font-medium">Domain</th>
                <th class="px-4 py-3 font-medium">Path</th>
                <th class="px-4 py-3 font-medium">Flags</th>
                <th class="px-4 py-3 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="cookie in data.cookies"
                :key="cookie.id"
                class="border-b border-border last:border-0 hover:bg-muted/40"
              >
                <td class="px-4 py-3 align-top">
                  <div class="font-medium">{{ cookie.key }}</div>
                  <div class="font-mono text-xs text-muted-foreground">
                    {{ cookie.value.slice(0, 32)
                    }}{{ cookie.value.length > 32 ? "..." : "" }}
                  </div>
                </td>
                <td class="px-4 py-3 align-top">{{ cookie.domain || "—" }}</td>
                <td class="px-4 py-3 align-top">{{ cookie.path || "—" }}</td>
                <td class="px-4 py-3 align-top">
                  <div class="flex flex-wrap gap-1">
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      :class="
                        cn(
                          cookie.secure
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-muted text-muted-foreground'
                        )
                      "
                    >
                      Secure
                    </span>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      :class="
                        cn(
                          cookie.httpOnly
                            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
                            : 'bg-muted text-muted-foreground'
                        )
                      "
                    >
                      HttpOnly
                    </span>
                    <span
                      class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      :class="statusBadge(cookie.sameSite || 'inactive')"
                    >
                      {{ cookie.sameSite || "SameSite?" }}
                    </span>
                  </div>
                </td>
                <td class="px-4 py-3 align-top">{{ cookie.expires || "Session" }}</td>
              </tr>
              <tr v-if="!data.cookies?.length">
                <td
                  colspan="5"
                  class="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Belum ada cookie tersimpan untuk akun ini.
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
          <thead class="bg-fuchsia-600/40 dark:bg-fuchsia-600/20 text-left">
            <tr class="border-b border-border">
              <th class="px-4 py-3 font-medium">Waktu</th>
              <th class="px-4 py-3 font-medium">Campaign</th>
              <th class="px-4 py-3 font-medium">Action</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Group</th>
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
              <td class="px-4 py-3 align-top">{{ row.action }}</td>
              <td class="px-4 py-3 align-top">
                <span
                  class="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium"
                  :class="statusBadge(row.status)"
                >
                  {{ row.status }}
                </span>
              </td>
              <td class="px-4 py-3 align-top">
                <Link
                  v-if="row.groupName"
                  :href="`/groups?search=${encodeURIComponent(row.groupName)}`"
                  class="text-primary hover:underline"
                >
                  {{ row.groupName }}
                </Link>
                <span v-else>—</span>
              </td>
              <td class="px-4 py-3 align-top">{{ fmtDuration(row.durationMs) }}</td>
              <td class="px-4 py-3 align-top">
                <div class="max-w-xl text-muted-foreground">
                  {{ row.message || "—" }}
                </div>
              </td>
            </tr>
            <tr v-if="!logs.length">
              <td colspan="7" class="px-4 py-8 text-center text-sm text-muted-foreground">
                Belum ada activity log untuk akun ini.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </App>
</template>

<style scoped></style>
