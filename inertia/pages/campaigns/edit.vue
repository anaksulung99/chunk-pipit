<script setup lang="ts">
import { Head, useForm } from "@inertiajs/vue3";
import { Link } from "@adonisjs/inertia/vue";
import { cn } from "~/lib/utils";
import TagMultiSelect from "~/components/TagMultiSelect.vue";

type CampaignDto = {
  id: string;
  name: string;
  type: string;
  status: string;
  config: {
    url?: string;
    caption?: string;
    groupTags?: string[];
    profileTags?: string[];
    sourceType?: "keyword" | "friend_joined_group";
    keyword?: string;
    friendProfileUrl?: string;
    pageUrl?: string;
    anyFacebookUrl?: string;
    skipPrivateNotJoined?: boolean;
    retryFailed?: boolean;
    dailyJoinLimit?: number;
    minFriendCount?: number;
    scrapeProfileType?: CampaignProfileType | null | undefined;
    inviteType?: CampaignInviteType | null;
    postType?: CampaignPostType | null;
    commentType?: CampaignCommentType | null;
    inboxType?: CampaignInboxType | null;
    deleteType?: CampaignDeleteType | null;
    confirmType?: CampaignConfirmType | null;
    createType?: CampaignCreateType | null;
    addFriendType?: CampaignAddFriendType | null;
  };
  targetGroupType: CampaignGroupType | null;
  headless: boolean;
  advanceMode: boolean;
  fingerprintId: string | null;
  useProxy: boolean;
  maxConcurrency: number;
  maxAccounts: number;
  maxDelayMs: number;
  maxTargets: number | null;
  accountIds: string[];
  groupIds: string[];
  profileIds: string[];
  minGroupMember: number;
};

type AccountOpt = {
  id: string;
  label: string;
  fbUserId: string | null;
  sessionStatus: string;
};

type FingerprintOpt = {
  id: string;
  name: string;
  osType: string;
  browserType: string;
};

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
  campaign: CampaignDto;
  accounts: AccountOpt[];
  fingerprints: FingerprintOpt[];
  groups: GroupOpt[];
  profiles: ProfileOpt[];
  groupTagOptions: string[];
  profileTagOptions: string[];
}>();

const errorMessage = ref<string | null>(null);

const form = useForm({
  name: props.campaign.name,
  type: props.campaign.type,
  targetGroupType: props.campaign.targetGroupType ?? ("public" as CampaignGroupType),
  headless: props.campaign.headless,
  advanceMode: props.campaign.advanceMode,
  fingerprintId: props.campaign.fingerprintId ?? "",
  useProxy: props.campaign.useProxy,
  maxConcurrency: props.campaign.maxConcurrency,
  maxAccounts: props.campaign.maxAccounts,
  maxDelayMs: props.campaign.maxDelayMs,
  maxTargets: props.campaign.maxTargets,
  accountIds: [...props.campaign.accountIds],
  groupIds: [...props.campaign.groupIds],
  profileIds: [...props.campaign.profileIds],
  minGroupMember: props.campaign.minGroupMember,
  config: {
    url: props.campaign.config.url ?? "",
    caption: props.campaign.config.caption ?? "",
    groupTags: [...(props.campaign.config.groupTags ?? [])],
    profileTags: [...(props.campaign.config.profileTags ?? [])],
    sourceType: props.campaign.config.sourceType ?? ("keyword" as const),
    keyword: props.campaign.config.keyword ?? "",
    friendProfileUrl: props.campaign.config.friendProfileUrl ?? "",
    pageUrl: props.campaign.config.pageUrl ?? "",
    anyFacebookUrl: props.campaign.config.anyFacebookUrl ?? "",
    skipPrivateNotJoined: props.campaign.config.skipPrivateNotJoined ?? true,
    retryFailed: props.campaign.config.retryFailed ?? false,
    dailyJoinLimit: props.campaign.config.dailyJoinLimit ?? 25,
    minFriendCount: props.campaign.config.minFriendCount ?? 0,
    scrapeProfileType: props.campaign.config.scrapeProfileType ?? "friend",
    inviteType: props.campaign.config.inviteType,
    postType: props.campaign.config.postType,
    commentType: props.campaign.config.commentType,
    inboxType: props.campaign.config.inboxType,
    deleteType: props.campaign.config.deleteType,
    confirmType: props.campaign.config.confirmType,
    createType: props.campaign.config.createType,
    addFriendType: props.campaign.config.addFriendType ?? "group",
  },
});

const needsGroups = computed(
  () =>
    form.type === "auto_share" ||
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
    form.type === "auto_share"
);

const groupSearch = ref("");
const eligibleGroups = computed(() => {
  return props.groups.filter((group) => {
    if (
      form.type === "auto_share" &&
      form.targetGroupType !== "both" &&
      group.groupType !== form.targetGroupType
    ) {
      return false;
    }

    if (needsGroups.value && form.minGroupMember > 0) {
      if (group.memberCount === null) return false;
      if (group.memberCount < form.minGroupMember) return false;
    }

    return true;
  });
});
const filteredGroups = computed(() => {
  const search = groupSearch.value.trim().toLowerCase();
  return eligibleGroups.value.filter((group) => {
    return (
      !search ||
      group.groupId.toLowerCase().includes(search) ||
      (group.groupName ?? "").toLowerCase().includes(search) ||
      group.tags.some((tag) => tag.toLowerCase().includes(search))
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
const profileSearch = ref("");
const filteredProfiles = computed(() => {
  const search = profileSearch.value.trim().toLowerCase();
  return props.profiles.filter((profile) => {
    if (needsProfiles.value && form.config.minFriendCount > 0) {
      if (profile.friendCount === null) return false;
      if (profile.friendCount < form.config.minFriendCount) return false;
    }

    return (
      !search ||
      profile.profileId.toLowerCase().includes(search) ||
      (profile.profileName ?? "").toLowerCase().includes(search) ||
      profile.tags.some((tag) => tag.toLowerCase().includes(search))
    );
  });
});
const hiddenProfileCount = computed(() =>
  Math.max(0, props.profiles.length - filteredProfiles.value.length)
);
const profilesMatchedBySelectedTags = computed(() => {
  if (!form.config.profileTags.length) return [];
  return filteredProfiles.value.filter((profile) =>
    profile.tags.some((tag) => form.config.profileTags.includes(tag))
  );
});

const fieldClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring";

function submit() {
  errorMessage.value = null;
  form
    .transform((data) => ({
      ...data,
      fingerprintId: data.fingerprintId || undefined,
      maxTargets: data.maxTargets || undefined,
    }))
    .patch(`/campaigns/${props.campaign.id}`, {
      preserveScroll: true,
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
    active: true,
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
    active: true,
  },
  {
    label: "Event",
    value: "event",
    active: true,
  },
  {
    label: "Friend",
    value: "friend",
    active: true,
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
    active: true,
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
    active: true,
  },
  {
    label: "Event",
    value: "event",
    active: true,
  },
];
</script>

<template>
  <Head :title="`Edit ${campaign.name}`" />
  <App title="Edit Campaign" :description="`Perbarui konfigurasi ${campaign.name}.`">
    <AlertMessage v-if="errorMessage" type="error" :message="errorMessage" />
    <div
      v-if="campaign.status === 'running'"
      class="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300"
    >
      Campaign sedang berjalan. Jeda campaign terlebih dahulu sebelum menyimpan perubahan.
    </div>

    <form class="grid grid-cols-1 gap-6 lg:grid-cols-3" @submit.prevent="submit">
      <div class="space-y-4 lg:col-span-2">
        <section class="space-y-4 rounded-lg border border-border bg-card p-4">
          <div>
            <label class="mb-1 block text-sm font-medium">Nama Campaign</label>
            <input
              v-model="form.name"
              :class="fieldClass"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
            />
            <p v-if="form.errors.name" class="mt-1 text-xs text-destructive">
              {{ form.errors.name }}
            </p>
          </div>

          <div>
            <label class="mb-1 block text-sm font-medium">Tipe</label>
            <div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
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

          <template v-if="form.type === 'auto_share'">
            <div>
              <label class="mb-1 block text-sm font-medium">URL Target</label>
              <input v-model="form.config.url" :class="fieldClass" />
            </div>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.config.skipPrivateNotJoined" type="checkbox" />
              Skip group private yang belum di-join
            </label>
            <label class="flex items-center gap-2 text-sm">
              <input v-model="form.config.retryFailed" type="checkbox" />
              Retry jika share gagal
            </label>
          </template>

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
              <input v-model="form.config.keyword" :class="fieldClass" />
            </div>
            <div v-else>
              <label class="mb-1 block text-sm font-medium">URL Profil Teman</label>
              <input v-model="form.config.friendProfileUrl" :class="fieldClass" />
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
                helper="Label ini ditempel ke hasil scrape baru agar mudah dipakai lagi di campaign auto join/share."
                empty-label="Belum ada label yang cocok. Tambah label baru dari panel kanan."
              />
            </div>
          </template>

          <template v-else-if="form.type === 'auto_join'">
            <label class="mb-1 block text-sm font-medium">Batas Join / Hari</label>
            <input
              v-model.number="form.config.dailyJoinLimit"
              type="number"
              min="1"
              max="200"
              :class="fieldClass"
            />
          </template>

          <template v-else-if="form.type === 'scrape_profile'">
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

          <template v-else-if="form.type === 'auto_add_friend'">
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
            </div>
          </template>

          <template v-if="form.type === 'auto_comment'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Comment</label>
              <select v-model="form.config.commentType" :class="fieldClass">
                <option
                  v-for="option in deleteTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
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

          <template v-else-if="form.type === 'auto_invite'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Invite</label>
              <select v-model="form.config.inviteType" :class="fieldClass">
                <option
                  v-for="option in inviteTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">URL Target Invite</label>
              <input
                v-model="form.config.url"
                :class="fieldClass"
                placeholder="https://facebook.com/..."
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Isi URL group, halaman, atau event yang akan menerima invite dari profile
                pool terpilih.
              </p>
            </div>
          </template>

          <template v-else-if="form.type === 'auto_unfriend'">
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
                >
                  {{ option.label }}
                </option>
              </select>
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
                >
                  {{ option.label }}
                </option>
              </select>
            </div>
          </template>

          <template v-if="form.type === 'auto_delete'">
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
            </div>
          </template>

          <template v-else-if="form.type === 'auto_confirm'">
            <div>
              <label class="mb-1 block text-sm font-medium">Tipe Confirm</label>
              <select v-model="form.config.confirmType" :class="fieldClass">
                <option
                  v-for="option in confirmTypeOptions"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </option>
              </select>
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
                >
                  {{ option.label }}
                </option>
              </select>
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
            <label class="mb-1 block text-sm font-medium">Caption (opsional)</label>
            <textarea
              v-model="form.config.caption"
              rows="3"
              :class="fieldClass"
              placeholder="Teks promosi…"
            />
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
                <input v-model="form.headless" type="checkbox" /> Headless Mode
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input v-model="form.advanceMode" type="checkbox" /> Advance Mode
              </label>
            </div>
            <AlertMessage
              v-if="!form.headless"
              type="warning"
              message="Jika Headless Mode tidak diaktifkan, maka: Virtual browser akan ditampilkan. Pastikan perangkat Anda memiliki RAM
                cukup."
            />
          </div>
        </section>

        <section
          v-if="needsGroups"
          class="space-y-2 rounded-lg border border-border bg-card p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <label class="text-sm font-medium"
              >Target Group ({{ form.groupIds.length }})</label
            >
            <input
              v-model="groupSearch"
              placeholder="Cari group..."
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
          <div class="rounded-md border border-dashed border-border px-3 py-3">
            <div class="flex items-center justify-between gap-3">
              <div>
                <div class="text-sm font-medium">Pilih By Label Kelompok</div>
                <p class="text-xs text-muted-foreground">
                  Label kelompok menambahkan target group secara massal tanpa centang
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
            class="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2"
          >
            <label
              v-for="group in filteredGroups"
              :key="group.id"
              class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <input
                v-model="form.groupIds"
                type="checkbox"
                :value="group.id"
                class="size-4 accent-primary"
              />
              <span class="font-mono text-xs">{{ group.groupId }}</span>
              <span class="truncate text-muted-foreground">{{ group.groupName }}</span>
              <span v-if="group.tags.length" class="text-[10px] text-muted-foreground">
                {{ group.tags.join(", ") }}
              </span>
              <span class="text-[10px] text-muted-foreground">
                {{
                  group.memberCount != null
                    ? `${group.memberCount.toLocaleString("id-ID")} member`
                    : "member ?"
                }}
              </span>
              <span class="ml-auto text-[10px] capitalize text-muted-foreground">
                {{ group.groupType }}
              </span>
            </label>
            <p v-if="!filteredGroups.length" class="p-2 text-xs text-muted-foreground">
              Tidak ada group.
            </p>
          </div>
        </section>

        <section
          v-if="needsProfiles"
          class="space-y-2 rounded-lg border border-border bg-card p-4"
        >
          <div class="flex items-center justify-between gap-3">
            <label class="text-sm font-medium"
              >Target Profile ({{ form.profileIds.length }})</label
            >
            <input
              v-model="profileSearch"
              placeholder="Cari profile..."
              class="rounded-md border border-input bg-background px-2 py-1 text-xs"
            />
          </div>
          <p
            v-if="form.config.minFriendCount > 0 && hiddenProfileCount > 0"
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
                  Label profile menambahkan target profile secara massal tanpa centang
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
                helper="Profile dengan salah satu label terpilih akan ikut terpasang ke campaign."
                empty-label="Belum ada label yang cocok. Tambah label baru dari panel kanan."
              />
            </div>
          </div>
          <div
            class="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2"
          >
            <label
              v-for="profile in filteredProfiles"
              :key="profile.id"
              class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <input v-model="form.profileIds" type="checkbox" :value="profile.id" />
              <span class="font-mono text-xs">{{ profile.profileId }}</span>
              <span class="truncate text-muted-foreground">{{
                profile.profileName
              }}</span>
              <span v-if="profile.tags.length" class="text-[10px] text-muted-foreground">
                {{ profile.tags.join(", ") }}
              </span>
              <span class="text-[10px] text-muted-foreground">
                {{
                  profile.friendCount != null
                    ? `${profile.friendCount.toLocaleString("id-ID")} friend`
                    : "friend ?"
                }}
              </span>
            </label>
            <p v-if="!filteredProfiles.length" class="p-2 text-xs text-muted-foreground">
              Tidak ada profile.
            </p>
          </div>
        </section>
      </div>

      <div class="space-y-4">
        <section class="space-y-2 rounded-lg border border-border bg-card p-4">
          <label class="text-sm font-medium">Akun ({{ form.accountIds.length }})</label>
          <div
            class="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2"
          >
            <label
              v-for="account in accounts"
              :key="account.id"
              class="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
            >
              <input v-model="form.accountIds" type="checkbox" :value="account.id" />
              <span>{{ account.label }}</span>
              <span class="ml-auto text-[10px] capitalize text-muted-foreground">
                {{ account.sessionStatus }}
              </span>
            </label>
            <p v-if="!accounts.length" class="p-2 text-xs text-muted-foreground">
              Belum ada akun.
            </p>
          </div>
        </section>

        <section class="space-y-3 rounded-lg border border-border bg-card p-4">
          <div>
            <label class="mb-1 block text-sm font-medium">Fingerprint</label>
            <select v-model="form.fingerprintId" :class="fieldClass">
              <option value="">— tanpa fingerprint —</option>
              <option
                v-for="fingerprint in fingerprints"
                :key="fingerprint.id"
                :value="fingerprint.id"
              >
                {{ fingerprint.name }} ({{ fingerprint.osType }}/{{
                  fingerprint.browserType
                }})
              </option>
            </select>
          </div>
          <label class="flex items-center gap-2 text-sm">
            <input v-model="form.useProxy" type="checkbox" /> Gunakan proxy (Optional)
          </label>
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
              max="50"
              :class="fieldClass"
            />
          </div>
          <div>
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
        </section>

        <div class="flex gap-2">
          <Link
            :href="`/campaigns/${campaign.id}`"
            class="flex-1 rounded-md border border-border px-4 py-2.5 text-center text-sm hover:bg-muted"
          >
            Batal
          </Link>
          <button
            type="submit"
            :disabled="form.processing || campaign.status === 'running'"
            class="flex-1 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {{ form.processing ? "Menyimpan..." : "Simpan" }}
          </button>
        </div>
      </div>
    </form>
  </App>
</template>
