<script setup lang="ts">
import { computed, ref } from "vue";
import { Head, useForm } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import { cn } from "~/lib/utils";
import TagMultiSelect from "~/components/TagMultiSelect.vue";
import { ArrowLeft } from "@lucide/vue";

type AccountOpt = {
  id: string;
  label: string;
  fbUserId: string | null;
  sessionStatus: string;
};
type FingerprintOpt = { id: string; name: string; osType: string; browserType: string };
type GroupOpt = {
  id: string;
  groupId: string;
  groupName: string | null;
  groupType: string;
  memberCount: number | null;
  tags: string[];
};
type ProfileOpt = {
  id: string;
  profileId: string;
  profileName: string | null;
  profileUrl: string | null;
  friendCount: number | null;
  tags: string[];
};

const props = defineProps<{
  accounts: AccountOpt[];
  fingerprints: FingerprintOpt[];
  groups: GroupOpt[];
  profiles: ProfileOpt[];
  groupTagOptions: string[];
  profileTagOptions: string[];
}>();

const form = useForm({
  name: "",
  type: "auto_share",
  targetGroupType: "public",
  headless: true,
  advanceMode: false,
  fingerprintId: "",
  useProxy: false,
  maxConcurrency: 1,
  maxAccounts: 1,
  maxDelayMs: 3000,
  maxTargets: null as number | null,
  accountIds: [] as string[],
  groupIds: [] as string[],
  profileIds: [] as string[],
  minGroupMember: 10000,
  config: {
    url: "",
    caption: "",
    groupTags: [] as string[],
    sourceType: "keyword",
    keyword: "",
    friendProfileUrl: "",
    pageUrl: "",
    anyFacebookUrl: "",
    manualGroupUrl: "",
    skipPrivateNotJoined: true,
    retryFailed: false,
    dailyJoinLimit: 25,
    minFriendCount: 0,
    profileTags: [] as string[],
    scrapeProfileType: "friend",
    inviteType: "group",
    postType: "group",
    commentType: "post",
    inboxType: "friend",
    deleteType: "post",
    confirmType: "friend",
    createType: "group",
    groupPrivacy: "private",
    addFriendType: "group",
  },
});

const errorMessage = ref<string | null>(null);

const needsGroups = computed(
  () =>
    form.type === "auto_share" ||
    form.type === "auto_post" ||
    form.type === "auto_join" ||
    (form.type === "scrape_profile" &&
      form.config.scrapeProfileType === "group_member") ||
    (form.type === "auto_add_friend" && form.config.addFriendType === "group")
);
const needsProfiles = computed(
  () =>
    (form.type === "auto_add_friend" && form.config.addFriendType === "profile") ||
    form.type === "auto_invite" ||
    form.type === "auto_unfriend"
);
const needsMaxTargets = computed(
  () => form.type === "scrape_group" || form.type === "scrape_profile"
);
const needCaption = computed(
  () =>
    form.type === "auto_comment" ||
    form.type === "auto_post" ||
    form.type === "auto_inbox" ||
    form.type === "auto_share" ||
    form.type === "auto_create"
);

const groupSearch = ref("");
const eligibleGroups = computed(() => {
  return props.groups.filter((g) => {
    if (
      needsGroups.value &&
      form.type === "auto_share" &&
      form.targetGroupType !== "both"
    ) {
      if (g.groupType !== form.targetGroupType) return false;
    }

    if (needsGroups.value && form.minGroupMember > 0) {
      if (g.memberCount === null) return false;
      if (g.memberCount < form.minGroupMember) return false;
    }

    return true;
  });
});
const filteredGroups = computed(() => {
  const q = groupSearch.value.trim().toLowerCase();
  return eligibleGroups.value.filter((g) => {
    if (!q) return true;
    return (
      g.groupId.toLowerCase().includes(q) ||
      (g.groupName ?? "").toLowerCase().includes(q) ||
      g.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
});
const profileSearch = ref("");
const filteredProfile = computed(() => {
  const q = profileSearch.value.trim().toLowerCase();
  return props.profiles.filter((p) => {
    if (!q) return true;
    return (
      p.profileId.toLowerCase().includes(q) ||
      (p.profileName ?? "").toLowerCase().includes(q) ||
      p.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
});

const hiddenGroupCount = computed(() =>
  Math.max(0, props.groups.length - eligibleGroups.value.length)
);
const groupsMatchedBySelectedTags = computed(() => {
  if (!form.config.groupTags.length) return [];
  return eligibleGroups.value.filter((group) =>
    group.tags.some((tag) => form.config.groupTags.includes(tag))
  );
});

const hiddenProfileCount = computed(() =>
  Math.max(0, props.profiles.length - filteredProfile.value.length)
);
const profilesMatchedBySelectedTags = computed(() => {
  if (!form.config.profileTags.length) return [];
  return filteredProfile.value.filter((profile) =>
    profile.tags.some((tag) => form.config.profileTags.includes(tag))
  );
});

function submit() {
  errorMessage.value = null;
  form
    .transform((data) => ({
      ...data,
      fingerprintId: data.fingerprintId || undefined,
      maxTargets: data.maxTargets || undefined,
    }))
    .post("/campaigns", {
      onError: (errors) => {
        console.log("errors:", errors);
        errorMessage.value = Object.values(errors).join("\n");
      },
      onFlash: (flash) => {
        console.log("flash:", flash);
      },
      onFinish: (values) => {
        if (values.errorBag) {
          errorMessage.value = values.errorBag;
        }
      },
    });
  setTimeout(() => {
    errorMessage.value = null;
  }, 3000);
}

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring";

const autoDeleteTargetLabel = computed(() =>
  form.config.deleteType === "comment" ? "Permalink Comment" : "Permalink Post"
);
const autoDeletePlaceholder = computed(() =>
  form.config.deleteType === "comment"
    ? "https://www.facebook.com/groups/123/posts/456/?comment_id=789"
    : "https://www.facebook.com/groups/123/posts/456/"
);
const autoDeleteHelper = computed(() =>
  form.config.deleteType === "comment"
    ? "Gunakan permalink comment lengkap yang masih menyimpan parameter `comment_id` agar worker bisa mengenali target dengan tepat."
    : "Gunakan permalink post final, idealnya format `/groups/.../posts/.../`, bukan URL feed umum atau hasil pencarian."
);

const typeOptions = [
  {
    label: "Scrape Group",
    value: "scrape_group",
    active: true,
  },
  {
    label: "Auto Share",
    value: "auto_share",
    active: true,
  },
  {
    label: "Auto Join",
    value: "auto_join",
    active: true,
  },
  {
    label: "Scrape Profile",
    value: "scrape_profile",
    active: true,
  },
  {
    label: "Auto Add Friend",
    value: "auto_add_friend",
    active: true,
  },
  {
    label: "Auto Like",
    value: "auto_like",
    active: true,
  },
  {
    label: "Auto Comment",
    value: "auto_comment",
    active: true,
  },
  {
    label: "Auto Invite",
    value: "auto_invite",
    active: true,
  },
  {
    label: "Auto Post",
    value: "auto_post",
    active: true,
  },
  {
    label: "Auto Unfriend",
    value: "auto_unfriend",
    active: true,
  },
  {
    label: "Auto Inbox",
    value: "auto_inbox",
    active: true,
  },
  {
    label: "Auto Delete",
    value: "auto_delete",
    active: true,
  },
  {
    label: "Auto Confirm",
    value: "auto_confirm",
    active: true,
  },
  {
    label: "Auto Create",
    value: "auto_create",
    active: true,
  },
];

const groupTypeOptions = [
  {
    label: "Public",
    value: "public",
    active: true,
  },
  {
    label: "Private",
    value: "private",
    active: true,
  },
  {
    label: "Both",
    value: "both",
    active: true,
  },
];
const scrapeProfileTypeOptions = [
  {
    label: "Friend",
    value: "friend",
    active: true,
  },
  {
    label: "Group Member",
    value: "group_member",
    active: true,
  },
  {
    label: "Page Profile Follower",
    value: "page_profile_follower",
    active: true,
  },
  {
    label: "Engagement Post",
    value: "engagement_post",
    active: true,
  },
];
const addFriendTypeOptions = [
  {
    label: "Profile",
    value: "profile",
    active: true,
  },
  {
    label: "Group Member",
    value: "group",
    active: true,
  },
  {
    label: "Any Facebook URL",
    value: "any_facebook_url",
    active: true,
  },
];

const inviteTypeOptions = [
  {
    label: "Group",
    value: "group",
    active: true,
  },
  {
    label: "Page Follower",
    value: "page_follower",
    active: true,
  },
  {
    label: "Event",
    value: "event",
    active: false,
  },
];
const postTypeOptions = [
  {
    label: "Group",
    value: "group",
    active: true,
  },
  {
    label: "Fanspage",
    value: "fanspage",
    active: false,
  },
  {
    label: "Event",
    value: "event",
    active: false,
  },
  {
    label: "Friend",
    value: "friend",
    active: false,
  },
];
const inboxTypeOptions = [
  {
    label: "Friend",
    value: "friend",
    active: true,
  },
  {
    label: "Fanspage",
    value: "fanspage",
    active: false,
  },
];
const commentTypeOptions = [
  {
    label: "Post",
    value: "post",
    active: true,
  },
  {
    label: "Comment",
    value: "comment",
    active: false,
  },
];
const deleteTypeOptions = [
  {
    label: "Post",
    value: "post",
    active: true,
  },
  {
    label: "Comment",
    value: "comment",
    active: true,
  },
];
const confirmTypeOptions = [
  {
    label: "Friend",
    value: "friend",
    active: true,
  },
  {
    label: "Group",
    value: "group",
    active: true,
  },
];
const createTypeOptions = [
  {
    label: "Group",
    value: "group",
    active: true,
  },
  {
    label: "Fanspage",
    value: "fanspage",
    active: false,
  },
  {
    label: "Event",
    value: "event",
    active: false,
  },
];
</script>

<template>
  <Head title="Buat Campaign" />
  <App
    title="Buat Campaign"
    description="Konfigurasi session campaign baru. Tersimpan sebagai draft."
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <Link
          href="/campaigns"
          class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <ArrowLeft class="size-4" /> Kembali
        </Link>
      </div>
    </template>
    <AlertMessage v-if="errorMessage" type="error" :message="errorMessage" />
    <form class="grid grid-cols-1 gap-6 lg:grid-cols-3" @submit.prevent="submit">
      <!-- Left: config -->
      <div class="space-y-4 lg:col-span-2">
        <div class="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <label class="mb-1 block text-sm font-medium">Nama Campaign</label>
            <input
              v-model="form.name"
              :class="fieldClass"
              placeholder="mis. Promo Shopee Sept"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
            />
            <span v-if="form.errors.name" class="text-xs text-red-500">{{
              form.errors.name
            }}</span>
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Tipe</label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="t in typeOptions"
                :key="t.value"
                type="button"
                :class="
                  cn(
                    'rounded-md border px-3 py-2 text-sm',
                    form.type === t.value
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:bg-muted',
                    !t.active
                      ? 'cursor-not-allowed bg-muted text-muted-foreground'
                      : 'cursor-pointer'
                  )
                "
                :disabled="!t.active"
                @click="form.type = t.value"
              >
                {{ t.label }}
              </button>
            </div>
          </div>

          <!-- Auto Share -->
          <template v-if="form.type === 'auto_share'">
            <div>
              <label class="mb-1 block text-sm font-medium">URL Target</label>
              <input
                v-model="form.config.url"
                :class="fieldClass"
                placeholder="https://s.shopee.co.id/… atau URL postingan FB"
              />
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="form.config.skipPrivateNotJoined"
                type="checkbox"
                class="size-4 accent-primary"
              />
              Skip group private yang belum di-join
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input
                v-model="form.config.retryFailed"
                type="checkbox"
                class="size-4 accent-primary"
              />
              Retry jika share gagal
            </label>
          </template>

          <!-- Scrape Group -->
          <template v-else-if="form.type === 'scrape_group'">
            <div>
              <label class="mb-1 block text-sm font-medium">Sumber</label>
              <select v-model="form.config.sourceType" :class="fieldClass">
                <option value="keyword">By Keyword</option>
                <option value="friend_joined_group">By Joined Group Teman</option>
              </select>
            </div>
            <div v-if="form.config.sourceType === 'keyword'">
              <label class="mb-1 block text-sm font-medium">Keyword</label>
              <input
                v-model="form.config.keyword"
                :class="fieldClass"
                placeholder="mis. jualan online"
              />
            </div>
            <div v-else>
              <label class="mb-1 block text-sm font-medium">URL Profil Teman</label>
              <input
                v-model="form.config.friendProfileUrl"
                :class="fieldClass"
                placeholder="https://facebook.com/username"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium"
                >Label Kelompok Hasil Scrape</label
              >
              <TagMultiSelect
                v-model="form.config.groupTags"
                :options="props.groupTagOptions"
                label="Pilih atau buat label kelompok"
                placeholder="Cari label kelompok hasil scrape..."
                helper="Label ini otomatis ditempel ke semua group hasil scrape supaya nanti campaign auto join/share bisa pilih berdasarkan kelompok."
                empty-label="Belum ada label yang cocok. Tambah label baru dari panel kanan."
              />
            </div>
          </template>

          <!-- Auto Join -->
          <template v-if="form.type === 'auto_join'">
            <div>
              <label class="mb-1 block text-sm font-medium"
                >Batas Join / Hari (per akun)</label
              >
              <input
                v-model.number="form.config.dailyJoinLimit"
                type="number"
                :class="fieldClass"
              />
            </div>
          </template>

          <!-- Scrape Profile -->
          <template v-if="form.type === 'scrape_profile'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Scrape Profile</label>
              <select v-model="form.config.scrapeProfileType" :class="fieldClass">
                <option
                  v-for="st in scrapeProfileTypeOptions"
                  :key="st.value"
                  :value="st.value"
                >
                  {{ st.label }}
                </option>
              </select>
            </div>
            <div
              v-if="
                form.config.scrapeProfileType === 'friend' ||
                form.config.scrapeProfileType === 'engagement_post' ||
                form.config.scrapeProfileType === 'page_profile_follower'
              "
            >
              <label class="mb-1 block text-sm font-medium">
                URL Profil Teman, Halaman Atau Postingan
              </label>
              <input
                v-model="form.config.pageUrl"
                type="url"
                :class="fieldClass"
                placeholder="https://facebook.com/username"
              />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Minimum Friend Count</label>
              <input
                v-model.number="form.config.minFriendCount"
                type="number"
                min="0"
                :class="fieldClass"
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Isi `0` agar profile tetap masuk pool meski friend count belum terbaca
                saat scrape awal.
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium"
                >Label Profile Hasil Scrape</label
              >
              <TagMultiSelect
                v-model="form.config.profileTags"
                :options="props.profileTagOptions"
                label="Pilih atau buat label profile"
                placeholder="Cari label profile hasil scrape..."
                helper="Label ini ditempel ke profile hasil scrape agar nanti mudah dipakai di auto add friend."
                empty-label="Belum ada label yang cocok. Tambah label baru dari panel kanan."
              />
            </div>
          </template>

          <template v-if="form.type === 'auto_add_friend'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Add Friend</label>
              <select v-model="form.config.addFriendType" :class="fieldClass">
                <option
                  v-for="st in addFriendTypeOptions"
                  :key="st.value"
                  :value="st.value"
                >
                  {{ st.label }}
                </option>
              </select>
            </div>

            <div v-if="form.config.addFriendType === 'any_facebook_url'">
              <label class="mb-1 block text-sm font-medium"> URL Facebook URL </label>
              <input
                v-model="form.config.anyFacebookUrl"
                type="url"
                :class="fieldClass"
                placeholder="https://facebook.com/username"
              />
            </div>
            <div
              v-if="
                form.config.addFriendType === 'profile' ||
                form.config.addFriendType === 'group'
              "
            >
              <label class="mb-1 block text-sm font-medium">Minimum Friend Count</label>
              <input
                v-model.number="form.config.minFriendCount"
                type="number"
                min="0"
                :class="fieldClass"
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Isi `0` agar target profile tidak otomatis gugur saat metadata friend
                belum lengkap.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_like'">
            <div>
              <label class="mb-1 block text-sm font-medium">URL Target</label>
              <input
                v-model="form.config.url"
                type="url"
                :class="fieldClass"
                placeholder="https://facebook.com/..."
              />
              <p class="mt-1 text-xs text-muted-foreground">
                MVP <code>Auto Like</code> saat ini bekerja dari satu URL target
                Facebook per campaign. Tiap akun yang dipilih akan mencoba memberi
                like pada URL yang sama.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_comment'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Comment</label>
              <select v-model="form.config.commentType" :class="fieldClass">
                <option
                  v-for="option in commentTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="!option.active"
                >
                  {{ option.label }}{{ option.active ? "" : " (Soon)" }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                MVP <code>Auto Comment</code> saat ini fokus ke comment langsung pada
                URL post Facebook. Jalur reply-to-comment disiapkan di phase berikutnya.
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">URL Target</label>
              <input
                v-model="form.config.url"
                type="url"
                :class="fieldClass"
                placeholder="https://facebook.com/..."
              />
            </div>
          </template>

          <template v-if="form.type === 'auto_invite'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Invite</label>
              <select v-model="form.config.inviteType" :class="fieldClass">
                <option
                  v-for="option in inviteTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="!option.active"
                >
                  {{ option.label }}{{ option.active ? "" : " (Soon)" }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                Foundation `Auto Invite` yang aktif saat ini fokus ke target
                <code>group</code> dan <code>page follower</code>. Jalur
                <code>event</code> masih diparkir dulu agar hasil tetap jujur.
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">URL Target Invite</label>
              <input
                v-model="form.config.url"
                type="url"
                :class="fieldClass"
                placeholder="https://facebook.com/..."
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Isi URL group atau halaman yang akan menerima invite dari profile pool
                terpilih.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_unfriend'">
            <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
              Auto Unfriend memakai target dari profile pool yang dipilih di panel bawah.
              Cocok untuk membersihkan teman yang sudah tidak ingin dipertahankan.
            </div>
          </template>

          <template v-if="form.type === 'auto_post'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Post</label>
              <select v-model="form.config.postType" :class="fieldClass">
                <option
                  v-for="option in postTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="!option.active"
                >
                  {{ option.label }}{{ option.active ? "" : " (Soon)" }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                MVP `Auto Post` saat ini fokus ke target group dulu. Fanspage, event,
                dan friend disiapkan di phase berikutnya.
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">URL Group Manual</label>
              <input
                v-model="form.config.manualGroupUrl"
                type="url"
                :class="fieldClass"
                placeholder="https://www.facebook.com/groups/123456789"
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Opsional. Jika diisi, worker akan menambahkan 1 target group manual
                di luar list group database atau label kelompok.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_inbox'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Inbox</label>
              <select v-model="form.config.inboxType" :class="fieldClass">
                <option
                  v-for="option in inboxTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="!option.active"
                >
                  {{ option.label }}{{ option.active ? "" : " (Soon)" }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                MVP `Auto Inbox` saat ini fokus ke target friend dari profile pool
                dulu. Jalur fanspage disiapkan di phase berikutnya.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_delete'">
            <div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-muted-foreground">
              Auto Delete saat ini berjalan untuk 1 permalink per campaign dan paling aman
              dieksekusi oleh akun pemilik konten.
              <span class="block pt-1 text-xs text-amber-700 dark:text-amber-300">
                Pilih akun eksekutor yang benar di panel akun agar menu delete benar-benar
                muncul saat worker berjalan.
              </span>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Delete</label>
              <select v-model="form.config.deleteType" :class="fieldClass">
                <option
                  v-for="option in deleteTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                Pilih <code>Post</code> untuk menghapus postingan utama, atau
                <code>Comment</code> untuk menghapus komentar spesifik dari permalink
                comment.
              </p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">
                {{ autoDeleteTargetLabel }}
              </label>
              <input
                v-model="form.config.url"
                type="url"
                :class="fieldClass"
                :placeholder="autoDeletePlaceholder"
              />
              <p class="mt-1 text-xs text-muted-foreground">
                {{ autoDeleteHelper }}
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                Foundation awal ini bekerja per URL target. Untuk batch banyak target, buat
                campaign terpisah atau lanjutkan ke lane growth berikutnya setelah UX ini rapi.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_confirm'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Confirm</label>
              <select v-model="form.config.confirmType" :class="fieldClass">
                <option
                  v-for="option in confirmTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="!option.active"
                >
                  {{ option.label }}{{ option.active ? "" : " (Soon)" }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                Foundation `Auto Confirm` sekarang mendukung
                <code>friend request</code> dan fondasi awal
                <code>group member request</code>.
              </p>
            </div>
            <div v-if="form.config.confirmType === 'group'">
              <label class="mb-1 block text-sm font-medium">URL Group / Member Requests</label>
              <input
                v-model="form.config.url"
                type="url"
                :class="fieldClass"
                placeholder="https://www.facebook.com/groups/123456789/member_requests"
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Isi URL group target atau, lebih ideal, URL halaman
                <code>member requests</code> agar worker bisa langsung mencari tombol
                approve.
              </p>
            </div>
          </template>

          <template v-if="form.type === 'auto_create'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Create</label>
              <select v-model="form.config.createType" :class="fieldClass">
                <option
                  v-for="option in createTypeOptions"
                  :key="option.value"
                  :value="option.value"
                  :disabled="!option.active"
                >
                  {{ option.label }}{{ option.active ? "" : " (Soon)" }}
                </option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                Foundation <code>Auto Create</code> fase ini baru menghidupkan mode
                <code>group</code>. Jalur <code>fanspage</code> dan <code>event</code>
                masih diparkir agar hasil tetap jujur.
              </p>
            </div>
            <div v-if="form.config.createType === 'group'">
              <label class="mb-1 block text-sm font-medium">Privasi Group</label>
              <select v-model="form.config.groupPrivacy" :class="fieldClass">
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <p class="mt-1 text-xs text-muted-foreground">
                Nama campaign akan dipakai sebagai nama group saat worker membuat group
                baru.
              </p>
            </div>
          </template>

          <div v-if="form.type === 'scrape_group' || form.type === 'auto_share'">
            <label class="mb-1 block text-sm font-medium">Target Tipe Group</label>
            <select v-model="form.targetGroupType" :class="fieldClass">
              <option v-for="gt in groupTypeOptions" :key="gt.value" :value="gt.value">
                {{ gt.label }}
              </option>
              <option value="both">Both</option>
            </select>
          </div>

          <div v-if="needCaption">
            <label class="mb-1 block text-sm font-medium">
              {{
                form.type === "auto_inbox"
                  ? "Template Message"
                  : form.type === "auto_comment"
                    ? "Comment Text"
                    : form.type === "auto_create"
                      ? "Deskripsi Group (opsional)"
                    : "Caption (opsional)"
              }}
            </label>
            <textarea
              v-model="form.config.caption"
              :rows="form.type === 'auto_inbox' ? 5 : 3"
              :class="fieldClass"
              :placeholder="
                form.type === 'auto_inbox'
                  ? 'Halo {firstName}, ini pesan pertama...\\n---\\nHalo {name}, ini template kedua...'
                  : form.type === 'auto_comment'
                    ? 'Mantap sob, menarik produknya.'
                  : 'Teks promosi…'
              "
            />
            <p v-if="form.type === 'auto_inbox'" class="mt-1 text-xs text-muted-foreground">
              Pisahkan beberapa template dengan baris <code>---</code>. Placeholder
              yang didukung: <code>{name}</code>, <code>{firstName}</code>, dan
              <code>{profileId}</code>. Worker akan memilih template secara acak
              per target dan menahan duplicate inbox sukses dalam window aman.
            </p>
            <p v-else-if="form.type === 'auto_comment'" class="mt-1 text-xs text-muted-foreground">
              Satu comment akan dikirim ke URL target oleh tiap akun yang dipilih.
            </p>
            <p v-else-if="form.type === 'auto_create'" class="mt-1 text-xs text-muted-foreground">
              Deskripsi ini akan dicoba diisi ke field deskripsi/about group jika surface
              Facebook menampilkannya.
            </p>
          </div>

          <div v-if="needsMaxTargets">
            <label class="mb-1 block text-sm font-medium">Max ID untuk di-scrape</label>
            <input
              v-model.number="form.maxTargets"
              type="number"
              :class="fieldClass"
              placeholder="100"
            />
          </div>

          <div class="space-y-2">
            <div class="flex flex-wrap gap-4">
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="form.headless"
                  type="checkbox"
                  class="size-4 accent-primary"
                />
                Headless Mode
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  v-model="form.advanceMode"
                  type="checkbox"
                  class="size-4 accent-primary"
                />
                Advance Mode
              </label>
            </div>
            <AlertMessage
              v-if="!form.headless"
              type="warning"
              message="Jika Headless Mode tidak diaktifkan, maka: Virtual browser akan ditampilkan. Pastikan perangkat Anda memiliki RAM
                cukup."
            />
          </div>
        </div>

        <!-- Groups selection -->
        <div
          v-if="needsGroups"
          class="space-y-2 rounded-lg border border-border bg-card p-4"
        >
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium"
              >Target Group ({{ form.groupIds.length }} dipilih)</label
            >
            <input
              v-model="groupSearch"
              placeholder="cari…"
              class="rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <p
            v-if="needsGroups && form.minGroupMember > 0 && hiddenGroupCount > 0"
            class="text-xs text-muted-foreground"
          >
            {{ hiddenGroupCount }} group disembunyikan karena member count di bawah
            minimum atau metadata member belum tersedia.
          </p>
          <p
            v-if="form.type === 'auto_post'"
            class="text-xs text-muted-foreground"
          >
            <code>Auto Post</code> bisa memakai kombinasi group dari list database,
            label kelompok, dan 1 URL group manual tambahan.
          </p>
          <div class="rounded-md border border-dashed border-border px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-medium">Pilih By Label Kelompok</div>
                <p class="text-xs text-muted-foreground">
                  Pilih label untuk menambahkan banyak group sekaligus tanpa centang
                  satu-satu.
                </p>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ groupsMatchedBySelectedTags.length.toLocaleString("id-ID") }} group
                cocok
              </span>
            </div>
            <div class="mt-3">
              <TagMultiSelect
                v-model="form.config.groupTags"
                :options="props.groupTagOptions"
                label="Label kelompok target"
                placeholder="Cari label kelompok target..."
                helper="Group dengan salah satu label terpilih akan ikut terpasang ke campaign, jadi tidak perlu centang satu-satu."
                empty-label="Belum ada label yang cocok. Tambah label baru dari panel kanan."
              />
            </div>
          </div>
          <div
            class="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2"
          >
            <label
              v-for="g in filteredGroups"
              :key="g.id"
              class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <input
                v-model="form.groupIds"
                type="checkbox"
                :value="g.id"
                class="size-4 accent-primary"
              />
              <span class="font-mono text-xs">{{ g.groupId }}</span>
              <span class="text-muted-foreground">{{ g.groupName }}</span>
              <span v-if="g.tags.length" class="text-[10px] text-muted-foreground">
                {{ g.tags.join(", ") }}
              </span>
              <span class="text-[10px] text-muted-foreground">
                {{
                  g.memberCount != null
                    ? `${g.memberCount.toLocaleString("id-ID")} member`
                    : "member ?"
                }}
              </span>
              <span class="ml-auto text-[10px] text-muted-foreground capitalize">{{
                g.groupType
              }}</span>
            </label>
            <p
              v-if="!filteredGroups.length"
              class="px-1.5 py-2 text-xs text-muted-foreground"
            >
              Tidak ada group.
            </p>
          </div>
        </div>

        <!-- Profiles selection -->
        <div
          v-if="needsProfiles"
          class="space-y-2 rounded-lg border border-border bg-card p-4"
        >
          <div class="flex items-center justify-between">
            <label class="text-sm font-medium"
              >Target Profile ({{ form.profileIds.length }} dipilih)</label
            >
            <input
              v-model="profileSearch"
              placeholder="cari…"
              class="rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <p
            v-if="
              needsProfiles && form.config.minFriendCount > 0 && hiddenProfileCount > 0
            "
            class="text-xs text-muted-foreground"
          >
            {{ hiddenProfileCount }} profile disembunyikan karena friend count di bawah
            minimum atau metadata friend belum tersedia.
          </p>
          <div class="rounded-md border border-dashed border-border px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-medium">Pilih By Label Profile</div>
                <p class="text-xs text-muted-foreground">
                  Pilih label untuk menambahkan banyak profile sekaligus tanpa centang
                  satu-satu.
                </p>
              </div>
              <span class="text-xs text-muted-foreground">
                {{ profilesMatchedBySelectedTags.length.toLocaleString("id-ID") }} profile
                cocok
              </span>
            </div>
            <div class="mt-3">
              <TagMultiSelect
                v-model="form.config.profileTags"
                :options="props.profileTagOptions"
                label="Label profile target"
                placeholder="Cari label profile target..."
                helper="Profile dengan salah satu label terpilih akan ikut terpasang ke campaign, jadi tidak perlu centang satu-satu."
                empty-label="Belum ada label yang cocok. Tambah label baru dari panel kanan."
              />
            </div>
          </div>
          <div
            class="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2"
          >
            <label
              v-for="g in filteredProfile"
              :key="g.id"
              class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <input
                v-model="form.profileIds"
                type="checkbox"
                :value="g.id"
                class="size-4 accent-primary"
              />
              <span class="font-mono text-xs">{{ g.profileId }}</span>
              <span class="text-muted-foreground">{{ g.profileName }}</span>
              <span v-if="g.tags.length" class="text-[10px] text-muted-foreground">
                {{ g.tags.join(", ") }}
              </span>
              <span class="text-[10px] text-muted-foreground">
                {{
                  g.friendCount != null
                    ? `${g.friendCount.toLocaleString("id-ID")} friend`
                    : "friend ?"
                }}
              </span>
            </label>
            <p
              v-if="!filteredProfile.length"
              class="px-1.5 py-2 text-xs text-muted-foreground"
            >
              Tidak ada profile.
            </p>
          </div>
        </div>
      </div>

      <!-- Right: accounts + settings -->
      <div class="space-y-4">
        <div class="space-y-2 rounded-lg border border-border bg-card p-4">
          <label class="text-sm font-medium"
            >Akun ({{ form.accountIds.length }} dipilih)</label
          >
          <div
            class="max-h-48 space-y-1 overflow-y-auto rounded-md border border-border p-2"
          >
            <label
              v-for="a in accounts"
              :key="a.id"
              class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <input
                v-model="form.accountIds"
                type="checkbox"
                :value="a.id"
                class="size-4 accent-primary"
              />
              {{ a.label }}
              <span class="ml-auto text-[10px] text-muted-foreground capitalize">{{
                a.sessionStatus
              }}</span>
            </label>
            <p v-if="!accounts.length" class="px-1.5 py-2 text-xs text-muted-foreground">
              Belum ada akun.
            </p>
          </div>
        </div>

        <div class="space-y-3 rounded-lg border border-border bg-card p-4">
          <div>
            <label class="mb-1 block text-sm font-medium">Fingerprint</label>
            <select v-model="form.fingerprintId" :class="fieldClass">
              <option value="">— tanpa fingerprint —</option>
              <option v-for="f in fingerprints" :key="f.id" :value="f.id">
                {{ f.name }} ({{ f.osType }}/{{ f.browserType }})
              </option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input
              v-model="form.useProxy"
              type="checkbox"
              class="size-4 accent-primary"
            />
            Gunakan proxy (rotasi)
          </label>
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">Concurrency</label>
              <input
                v-model.number="form.maxConcurrency"
                type="number"
                min="1"
                max="5"
                :class="fieldClass"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">Delay (ms)</label>
              <input
                v-model.number="form.maxDelayMs"
                type="number"
                min="0"
                :class="fieldClass"
              />
            </div>
            <div>
              <label class="mb-1 block text-xs text-muted-foreground">Max akun</label>
              <input
                v-model.number="form.maxAccounts"
                type="number"
                min="1"
                :class="fieldClass"
              />
            </div>
            <div
              v-if="
                form.type === 'scrape_group' ||
                form.type === 'auto_share' ||
                form.type === 'auto_join'
              "
            >
              <label class="mb-1 block text-xs text-muted-foreground"
                >Minimum Group Member</label
              >
              <input
                v-model.number="form.minGroupMember"
                type="number"
                min="1"
                :class="fieldClass"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          :disabled="form.processing"
          class="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {{ form.processing ? "Menyimpan…" : "Buat Campaign" }}
        </button>
      </div>
    </form>
  </App>
</template>
