<script setup lang="ts">
import { computed, ref } from "vue";
import { Head, useForm, usePage } from "@inertiajs/vue3";
import { router } from "@inertiajs/vue3";
import {
  AlertCircle,
  Bell,
  BellRing,
  CheckCircle2,
  Loader2,
  Mail,
  SaveIcon,
  Send,
  Webhook,
  MessageSquareMore,
} from "@lucide/vue";
import type { Data } from "@generated/data";

type NotificationType = "telegram" | "email" | "slack" | "webhook" | null;
type NotificationEventKey =
  | "campaign_start"
  | "campaign_end"
  | "campaign_failed"
  | "account_issue"
  | "checkpoint"
  | "scrape_success";

type PersonalSetting = {
  enableNotification: boolean;
  typeNotification: NotificationType;
  notificationEvents: NotificationEventKey[];
  telegramConfig: {
    botToken: string | null;
    chatId: string | null;
    threadId: string | null;
  };
  emailConfig: {
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUsername: string | null;
    smtpPassword: string | null;
    smtpSecure: boolean;
    fromAddress: string | null;
    fromName: string | null;
    toAddress: string | null;
  };
  slackConfig: {
    webhookUrl: string | null;
    channel: string | null;
    username: string | null;
  };
  webhookUrl: string | null;
};

const props = defineProps<{
  personalSetting: PersonalSetting;
}>();

const page = usePage<Data.SharedProps>();

const channelOptions = [
  {
    value: "telegram" as const,
    label: "Telegram",
    description: "Gunakan bot token dan chat ID untuk private notification Telegram.",
    icon: Send,
  },
  {
    value: "email" as const,
    label: "Email",
    description: "Kirim notifikasi melalui SMTP personal ke email tujuan.",
    icon: Mail,
  },
  {
    value: "slack" as const,
    label: "Slack",
    description: "Pakai Slack incoming webhook untuk alert campaign worker.",
    icon: MessageSquareMore,
  },
  {
    value: "webhook" as const,
    label: "Custom Webhook",
    description: "Kirim payload ke endpoint webhook Anda sendiri.",
    icon: Webhook,
  },
] as const;

const notificationEventOptions = [
  {
    value: "campaign_start" as const,
    label: "Campaign Start",
    description: "Kirim notifikasi saat worker mulai mengeksekusi campaign.",
  },
  {
    value: "campaign_end" as const,
    label: "Campaign End",
    description: "Kirim notifikasi saat campaign selesai diproses worker.",
  },
  {
    value: "campaign_failed" as const,
    label: "Campaign Failed",
    description: "Kirim notifikasi saat campaign gagal secara keseluruhan.",
  },
  {
    value: "account_issue" as const,
    label: "Account Issue",
    description: "Kirim notifikasi saat ada error account atau launch browser gagal.",
  },
  {
    value: "checkpoint" as const,
    label: "Checkpoint",
    description: "Kirim notifikasi saat akun masuk checkpoint atau tidak aktif.",
  },
  {
    value: "scrape_success" as const,
    label: "Scrape Success",
    description: "Kirim notifikasi saat scrape group berhasil mendapatkan data.",
  },
] as const;

const eventLabelMap = Object.fromEntries(
  notificationEventOptions.map((item) => [item.value, item.label])
) as Record<NotificationEventKey, string>;

const form = useForm({
  enableNotification: props.personalSetting.enableNotification,
  typeNotification: props.personalSetting.typeNotification,
  notificationEvents: [...props.personalSetting.notificationEvents],
  telegramConfig: {
    botToken: props.personalSetting.telegramConfig.botToken ?? "",
    chatId: props.personalSetting.telegramConfig.chatId ?? "",
    threadId: props.personalSetting.telegramConfig.threadId ?? "",
  },
  emailConfig: {
    smtpHost: props.personalSetting.emailConfig.smtpHost ?? "",
    smtpPort: props.personalSetting.emailConfig.smtpPort ?? 587,
    smtpUsername: props.personalSetting.emailConfig.smtpUsername ?? "",
    smtpPassword: props.personalSetting.emailConfig.smtpPassword ?? "",
    smtpSecure: props.personalSetting.emailConfig.smtpSecure ?? false,
    fromAddress: props.personalSetting.emailConfig.fromAddress ?? "",
    fromName: props.personalSetting.emailConfig.fromName ?? "",
    toAddress: props.personalSetting.emailConfig.toAddress ?? "",
  },
  slackConfig: {
    webhookUrl: props.personalSetting.slackConfig.webhookUrl ?? "",
    channel: props.personalSetting.slackConfig.channel ?? "",
    username: props.personalSetting.slackConfig.username ?? "",
  },
  webhookUrl: props.personalSetting.webhookUrl ?? "",
});

const activeAction = ref<"save" | "test" | null>(null);
const selectedChannel = computed(() =>
  form.enableNotification
    ? channelOptions.find((item) => item.value === form.typeNotification)
    : null
);
const activeEventLabels = computed(() =>
  form.notificationEvents.map((item) => eventLabelMap[item] ?? item)
);
const inlineFeedback = computed(() => {
  if (page.props.flash?.error) {
    return {
      type: "error" as const,
      message: page.props.flash.error,
    };
  }

  if (page.props.flash?.success) {
    return {
      type: "success" as const,
      message: page.props.flash.success,
    };
  }

  return null;
});
const previewEvent = computed(() => ({
  action: "campaign_start",
  status: "success",
  message:
    "Ini adalah test notification dari Personal Settings. Jika pesan ini masuk, konfigurasi channel Anda sudah siap dipakai worker.",
  campaignId: "test-campaign",
  campaignName: "Test Notification",
  campaignType: "system_test",
  campaignStatus: "draft",
}));
const previewSubject = computed(() => "[SUCCESS] Test Notification");
const previewMessage = computed(() => {
  const lines = [
    "Chunk Pipit Notification",
    "",
    `Campaign      : ${previewEvent.value.campaignName}`,
    `Type          : ${previewEvent.value.campaignType}`,
    `Action        : ${previewEvent.value.action}`,
    `Event Status  : ${previewEvent.value.status}`,
    `Campaign State: ${previewEvent.value.campaignStatus}`,
    "",
    "Message",
    previewEvent.value.message,
    "",
    "Reference",
    `Campaign ID   : ${previewEvent.value.campaignId}`,
    `Channel       : ${form.typeNotification ?? "-"}`,
    "Time          : akan mengikuti waktu saat test dikirim",
  ];

  return lines.join("\n");
});
const previewPayload = computed(() =>
  JSON.stringify(
    {
      subject: previewSubject.value,
      message: previewMessage.value,
      event: previewEvent.value,
      test: true,
    },
    null,
    2
  )
);
const previewTarget = computed(() => {
  if (!form.enableNotification || !form.typeNotification) {
    return "Aktifkan notifikasi dan pilih channel untuk melihat target test.";
  }

  if (form.typeNotification === "telegram") {
    const thread = form.telegramConfig.threadId
      ? `, Thread ID ${form.telegramConfig.threadId}`
      : "";
    return form.telegramConfig.chatId
      ? `Telegram Chat ID ${form.telegramConfig.chatId}${thread}`
      : "Telegram belum memiliki Chat ID.";
  }

  if (form.typeNotification === "email") {
    return form.emailConfig.toAddress
      ? `Email ke ${form.emailConfig.toAddress}`
      : "Email tujuan belum diisi.";
  }

  if (form.typeNotification === "slack") {
    return form.slackConfig.channel
      ? `Slack channel ${form.slackConfig.channel}`
      : form.slackConfig.webhookUrl
      ? "Slack webhook siap dipakai tanpa channel override."
      : "Slack webhook belum diisi.";
  }

  return form.webhookUrl ? `Webhook ${form.webhookUrl}` : "Webhook URL belum diisi.";
});

function submit() {
  form.put("/settings/personal-setting", {
    preserveScroll: true,
    onStart: () => {
      activeAction.value = "save";
    },
    onFinish: () => {
      activeAction.value = null;
      router.reload();
    },
  });
}

function testNotification() {
  form.post("/settings/personal-setting/test", {
    preserveScroll: true,
    onStart: () => {
      activeAction.value = "test";
    },
    onFinish: () => {
      activeAction.value = null;
      router.reload();
    },
  });
}

function toggleEvent(eventKey: NotificationEventKey) {
  if (form.notificationEvents.includes(eventKey)) {
    form.notificationEvents = form.notificationEvents.filter((item) => item !== eventKey);
    return;
  }

  form.notificationEvents = [...form.notificationEvents, eventKey];
}
</script>

<template>
  <Head title="Personal Settings" />
  <App
    title="Personal Settings"
    description="Atur private notification untuk laporan realtime campaign worker."
  >
    <div class="space-y-4">
      <div class="rounded-lg bg-background p-5 space-y-4">
        <div
          v-if="inlineFeedback"
          :class="
            inlineFeedback.type === 'success'
              ? 'rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-emerald-700 dark:text-emerald-300'
              : 'rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive'
          "
        >
          <div class="flex items-start gap-3">
            <component
              :is="inlineFeedback.type === 'success' ? CheckCircle2 : AlertCircle"
              class="mt-0.5 size-4 shrink-0"
            />
            <div>
              <div class="text-sm font-medium">
                {{ inlineFeedback.type === "success" ? "Aksi berhasil" : "Aksi gagal" }}
              </div>
              <p class="mt-1 text-sm opacity-90">{{ inlineFeedback.message }}</p>
            </div>
          </div>
        </div>

        <div class="flex items-start gap-3">
          <div class="rounded-lg bg-primary/10 p-2 text-primary">
            <Bell class="size-5" />
          </div>
          <div class="space-y-1">
            <h3 class="text-lg font-semibold text-foreground">Private Notification</h3>
            <p class="text-sm text-muted-foreground">
              Konfigurasi ini dipakai untuk notifikasi tambahan di luar aplikasi, seperti
              laporan success, failed, atau event lain dari campaign worker.
            </p>
          </div>
        </div>

        <form class="space-y-5" @submit.prevent="submit">
          <div class="rounded-lg border border-border p-4 space-y-4">
            <div class="flex items-start justify-between gap-4">
              <div class="space-y-1">
                <h4 class="font-medium text-foreground">Aktifkan Notifikasi</h4>
                <p class="text-sm text-muted-foreground">
                  Matikan jika Anda belum ingin menerima private notification eksternal.
                </p>
              </div>
              <label class="inline-flex items-center gap-2 text-sm font-medium">
                <input
                  v-model="form.enableNotification"
                  type="checkbox"
                  class="size-4 rounded border-input accent-primary"
                  :disabled="form.processing"
                />
                <span>{{ form.enableNotification ? "Aktif" : "Nonaktif" }}</span>
              </label>
            </div>

            <div class="grid gap-2">
              <label for="typeNotification" class="text-sm font-medium text-foreground">
                Tipe Notifikasi
              </label>
              <select
                id="typeNotification"
                v-model="form.typeNotification"
                :disabled="!form.enableNotification || form.processing"
                class="bg-input"
              >
                <option :value="null">Pilih channel notifikasi</option>
                <option
                  v-for="item in channelOptions"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </select>
              <p v-if="form.errors.typeNotification" class="text-destructive text-sm">
                {{ form.errors.typeNotification }}
              </p>
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <button
              v-for="item in channelOptions"
              :key="item.value"
              type="button"
              :disabled="!form.enableNotification || form.processing"
              :class="[
                'rounded-lg border p-4 text-left transition-colors',
                form.typeNotification === item.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted/40',
                (!form.enableNotification || form.processing) && 'opacity-60',
              ]"
              @click="form.typeNotification = item.value"
            >
              <component :is="item.icon" class="size-5 text-primary" />
              <div class="mt-3 text-sm font-medium text-foreground">{{ item.label }}</div>
              <p class="mt-1 text-xs text-muted-foreground">{{ item.description }}</p>
            </button>
          </div>

          <div
            v-if="form.enableNotification"
            class="rounded-lg border border-border p-4 space-y-4"
          >
            <div class="space-y-1">
              <h4 class="font-medium text-foreground">Event Notification</h4>
              <p class="text-sm text-muted-foreground">
                Pilih event worker mana saja yang boleh dikirim ke channel private
                notification.
              </p>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <label
                v-for="item in notificationEventOptions"
                :key="item.value"
                class="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-muted/30"
              >
                <input
                  :checked="form.notificationEvents.includes(item.value)"
                  type="checkbox"
                  class="mt-0.5 size-4 rounded border-input accent-primary"
                  :disabled="form.processing"
                  @change="toggleEvent(item.value)"
                />
                <div>
                  <div class="text-sm font-medium text-foreground">{{ item.label }}</div>
                  <p class="mt-1 text-xs text-muted-foreground">{{ item.description }}</p>
                </div>
              </label>
            </div>
          </div>

          <div
            v-if="form.enableNotification && form.typeNotification === 'telegram'"
            class="rounded-lg border border-border p-4 space-y-4"
          >
            <div class="space-y-1">
              <h4 class="font-medium text-foreground">Telegram Metadata Config</h4>
              <p class="text-sm text-muted-foreground">
                Minimal isi bot token dan chat ID. Thread ID opsional untuk topic group.
              </p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2 md:col-span-2">
                <label for="telegramBotToken" class="text-sm font-medium text-foreground">
                  Bot Token
                </label>
                <input
                  id="telegramBotToken"
                  v-model="form.telegramConfig.botToken"
                  type="password"
                  placeholder="123456789:AA..."
                  :disabled="form.processing"
                  class="bg-input"
                />
                <p
                  v-if="form.errors['telegramConfig.botToken']"
                  class="text-destructive text-sm"
                >
                  {{ form.errors["telegramConfig.botToken"] }}
                </p>
              </div>
              <div class="grid gap-2">
                <label for="telegramChatId" class="text-sm font-medium text-foreground">
                  Chat ID
                </label>
                <input
                  id="telegramChatId"
                  v-model="form.telegramConfig.chatId"
                  type="text"
                  placeholder="-1001234567890"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="telegramThreadId" class="text-sm font-medium text-foreground">
                  Thread ID
                </label>
                <input
                  id="telegramThreadId"
                  v-model="form.telegramConfig.threadId"
                  type="text"
                  placeholder="Opsional"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
            </div>
          </div>

          <div
            v-if="form.enableNotification && form.typeNotification === 'email'"
            class="rounded-lg border border-border p-4 space-y-4"
          >
            <div class="space-y-1">
              <h4 class="font-medium text-foreground">Email Config</h4>
              <p class="text-sm text-muted-foreground">
                Simpan konfigurasi SMTP personal untuk private alert via email.
              </p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2">
                <label for="smtpHost" class="text-sm font-medium text-foreground"
                  >SMTP Host</label
                >
                <input
                  id="smtpHost"
                  v-model="form.emailConfig.smtpHost"
                  type="text"
                  placeholder="smtp.gmail.com"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="smtpPort" class="text-sm font-medium text-foreground"
                  >SMTP Port</label
                >
                <input
                  id="smtpPort"
                  v-model.number="form.emailConfig.smtpPort"
                  type="number"
                  min="1"
                  max="65535"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="smtpUsername" class="text-sm font-medium text-foreground">
                  SMTP Username
                </label>
                <input
                  id="smtpUsername"
                  v-model="form.emailConfig.smtpUsername"
                  type="text"
                  placeholder="username"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="smtpPassword" class="text-sm font-medium text-foreground">
                  SMTP Password
                </label>
                <input
                  id="smtpPassword"
                  v-model="form.emailConfig.smtpPassword"
                  type="password"
                  placeholder="password"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="fromAddress" class="text-sm font-medium text-foreground">
                  From Address
                </label>
                <input
                  id="fromAddress"
                  v-model="form.emailConfig.fromAddress"
                  type="email"
                  placeholder="no-reply@example.com"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="toAddress" class="text-sm font-medium text-foreground">
                  To Address
                </label>
                <input
                  id="toAddress"
                  v-model="form.emailConfig.toAddress"
                  type="email"
                  placeholder="your@email.com"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="fromName" class="text-sm font-medium text-foreground"
                  >From Name</label
                >
                <input
                  id="fromName"
                  v-model="form.emailConfig.fromName"
                  type="text"
                  placeholder="Chunk Pipit"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div
                class="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5"
              >
                <input
                  id="smtpSecure"
                  v-model="form.emailConfig.smtpSecure"
                  type="checkbox"
                  class="size-4 rounded border-input accent-primary"
                  :disabled="form.processing"
                />
                <label for="smtpSecure" class="text-sm font-medium text-foreground">
                  Gunakan koneksi secure / TLS
                </label>
              </div>
            </div>
          </div>

          <div
            v-if="form.enableNotification && form.typeNotification === 'slack'"
            class="rounded-lg border border-border p-4 space-y-4"
          >
            <div class="space-y-1">
              <h4 class="font-medium text-foreground">Slack Config</h4>
              <p class="text-sm text-muted-foreground">
                Pakai incoming webhook Slack untuk notifikasi channel privat.
              </p>
            </div>
            <div class="grid gap-4 md:grid-cols-2">
              <div class="grid gap-2 md:col-span-2">
                <label for="slackWebhookUrl" class="text-sm font-medium text-foreground">
                  Slack Webhook URL
                </label>
                <input
                  id="slackWebhookUrl"
                  v-model="form.slackConfig.webhookUrl"
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="slackChannel" class="text-sm font-medium text-foreground">
                  Channel
                </label>
                <input
                  id="slackChannel"
                  v-model="form.slackConfig.channel"
                  type="text"
                  placeholder="#alerts"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
              <div class="grid gap-2">
                <label for="slackUsername" class="text-sm font-medium text-foreground">
                  Username
                </label>
                <input
                  id="slackUsername"
                  v-model="form.slackConfig.username"
                  type="text"
                  placeholder="Chunk Pipit Bot"
                  :disabled="form.processing"
                  class="bg-input"
                />
              </div>
            </div>
          </div>

          <div
            v-if="form.enableNotification && form.typeNotification === 'webhook'"
            class="rounded-lg border border-border p-4 space-y-4"
          >
            <div class="space-y-1">
              <h4 class="font-medium text-foreground">Custom Webhook URL</h4>
              <p class="text-sm text-muted-foreground">
                Endpoint ini nantinya bisa menerima payload event campaign worker secara
                realtime.
              </p>
            </div>
            <div class="grid gap-2">
              <label for="webhookUrl" class="text-sm font-medium text-foreground">
                Webhook URL
              </label>
              <input
                id="webhookUrl"
                v-model="form.webhookUrl"
                type="url"
                placeholder="https://example.com/webhooks/fb-automation"
                :disabled="form.processing"
                class="bg-input"
              />
              <p v-if="form.errors.webhookUrl" class="text-destructive text-sm">
                {{ form.errors.webhookUrl }}
              </p>
            </div>
          </div>

          <div class="rounded-lg border border-dashed border-border p-4 bg-muted/20">
            <div class="text-sm font-medium text-foreground">Ringkasan Channel Aktif</div>
            <p class="mt-1 text-sm text-muted-foreground">
              {{
                form.enableNotification
                  ? selectedChannel
                    ? `${selectedChannel.label} aktif dan siap dipakai untuk private notification campaign worker.`
                    : "Notifikasi aktif, tapi channel belum dipilih."
                  : "Private notification masih nonaktif."
              }}
            </p>
            <p v-if="form.enableNotification" class="mt-2 text-xs text-muted-foreground">
              Event aktif:
              {{ activeEventLabels.length ? activeEventLabels.join(", ") : "belum ada" }}
            </p>
          </div>

          <div class="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              :disabled="
                form.processing || !form.enableNotification || !form.typeNotification
              "
              @click="testNotification"
            >
              <Loader2 v-if="activeAction === 'test'" class="animate-spin size-4" />
              <BellRing v-else class="size-4" />
              {{ activeAction === "test" ? "Testing..." : "Test Notification" }}
            </Button>
            <Button
              type="submit"
              class="bg-emerald-700 dark:bg-emerald-600 text-white px-4 py-2 rounded-md"
              :disabled="form.processing"
            >
              <Loader2 v-if="activeAction === 'save'" class="animate-spin" />
              <SaveIcon v-else />
              {{ activeAction === "save" ? "Saving..." : "Save Notification Settings" }}
            </Button>
          </div>

          <div
            v-if="form.enableNotification"
            class="rounded-lg border border-dashed border-border bg-muted/15 p-4 space-y-3"
          >
            <div class="space-y-1">
              <div class="text-sm font-medium text-foreground">
                Preview Test Notification
              </div>
              <p class="text-xs text-muted-foreground">
                Contoh detail yang akan dikirim saat Anda menekan tombol test. Telegram
                memakai isi message, sedangkan webhook/email/slack juga membawa subject.
              </p>
            </div>
            <div class="grid gap-2 text-xs text-muted-foreground">
              <p>
                Channel tujuan:
                <span class="font-medium text-foreground">{{ previewTarget }}</span>
              </p>
              <p>
                Event contoh:
                <span class="font-medium text-foreground">{{
                  eventLabelMap.campaign_start
                }}</span>
              </p>
              <p>
                Event aktif:
                <span class="font-medium text-foreground">
                  {{
                    activeEventLabels.length ? activeEventLabels.join(", ") : "belum ada"
                  }}
                </span>
              </p>
            </div>
            <div class="grid gap-3 xl:grid-cols-2">
              <div class="space-y-2">
                <div
                  class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Message Preview
                </div>
                <pre
                  class="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground whitespace-pre-wrap"
                ><code>{{ previewMessage }}</code></pre>
              </div>
              <div
                v-if="form.typeNotification && form.typeNotification !== 'telegram'"
                class="space-y-2"
              >
                <div
                  class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Payload Preview
                </div>
                <pre
                  class="overflow-x-auto rounded-lg border border-border bg-background p-3 text-xs text-foreground whitespace-pre-wrap"
                ><code>{{ previewPayload }}</code></pre>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  </App>
</template>
