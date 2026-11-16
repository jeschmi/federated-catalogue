<script setup lang="ts">
import { onMounted, ref } from "vue";
import HelpTip from "@/components/HelpTip.vue";
import { EXAMPLE_GROUPS, POST_EXAMPLES, type PostExample } from "@/postExamples";
import { api, apiPost } from "@/services/api";
import {
  ApiError,
  type PostedAsset,
  type PostedAssetContent,
  type PostedAssetPage,
  type PostedCredentialResult
} from "@/types";

const loading = ref(true);
const error = ref("");
const assets = ref<PostedAsset[]>([]);
const total = ref(0);
const selected = ref<PostedAssetContent | null>(null);
const contentError = ref("");
const contentLoading = ref(false);
const credential = ref("");
const example = ref<PostExample | null>(null);
const posting = ref(false);
const postError = ref("");
const postMessage = ref("");
const postWarnings = ref<string[]>([]);

const headers = [
  { title: "Id", key: "id", hint: "Catalogue identifier of the stored asset, usually the credential subject." },
  { title: "Status", key: "status", hint: "Lifecycle of the asset, such as active or revoked." },
  { title: "Issuer", key: "issuer", hint: "Who signed or published the asset." },
  { title: "Type", key: "contentType", hint: "Media type of the stored body, such as a verifiable credential." },
  { title: "Uploaded", key: "uploadDatetime", hint: "When the catalogue accepted the file." }
];

onMounted(() => {
  void loadAssets();
});

async function loadAssets() {
  loading.value = true;
  error.value = "";
  try {
    const page = await api<PostedAssetPage>("/admin/posted-assets?offset=0&limit=100");
    assets.value = page.items ?? [];
    total.value = page.totalCount ?? assets.value.length;
  } catch (cause) {
    error.value = cause instanceof ApiError ? cause.message : "Could not load posted assets.";
  } finally {
    loading.value = false;
  }
}

function loadExample(next: PostExample) {
  example.value = next;
  credential.value = JSON.stringify(next.credential, null, 2);
  postError.value = "";
  postMessage.value = "";
  postWarnings.value = [];
}

async function postCredential() {
  const body = credential.value.trim();
  if (!body) {
    postError.value = "Paste a verifiable credential or presentation.";
    postMessage.value = "";
    return;
  }
  posting.value = true;
  postError.value = "";
  postMessage.value = "";
  postWarnings.value = [];
  try {
    const stored = await apiPost<PostedCredentialResult>("/admin/posted-assets", body, "text/plain");
    const id = stored.asset?.id || "the credential";
    postMessage.value = `Stored ${id}.`;
    postWarnings.value = stored.warnings ?? [];
    credential.value = "";
    example.value = null;
    await loadAssets();
  } catch (cause) {
    postError.value = cause instanceof ApiError ? cause.message : "Could not store the credential.";
  } finally {
    posting.value = false;
  }
}

async function openAsset(asset: PostedAsset) {
  if (!asset.id) return;
  contentLoading.value = true;
  contentError.value = "";
  selected.value = null;
  try {
    selected.value = await api<PostedAssetContent>(
      `/admin/posted-assets/content?id=${encodeURIComponent(asset.id)}`
    );
  } catch (cause) {
    contentError.value = cause instanceof ApiError ? cause.message : "Could not load the asset.";
  } finally {
    contentLoading.value = false;
  }
}
</script>

<template>
  <div>
    <div class="d-flex align-center mb-4">
      <h1 class="text-h5 d-inline-flex align-center">
        Posted data
        <HelpTip text="The database copy of each posted asset. The graph is a separate index of the claims inside active assets." />
      </h1>
      <v-spacer />
      <span class="text-body-2 text-medium-emphasis">{{ total }}</span>
    </div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      Assets stored in the catalogue database. Select a row to read its body.
      Machine participants publish through DCP. An administrator stores a credential with the form below.
      Each set shares identifiers inside itself. The port demo draws a company and its services.
      The Construct-X set draws a member and the data assets it publishes.
    </p>

    <v-card border class="mb-6">
      <v-card-item>
        <v-card-title class="d-inline-flex align-center">
          Store a credential
          <HelpTip
            text="Choose an example to load it, or paste a credential, then store it. A signed JWT is still checked. A DCP presentation response is refused. Open Explore the graph after the set is stored."
          />
        </v-card-title>
      </v-card-item>
      <v-card-text>
        <div class="text-body-2 mb-2 d-inline-flex align-center">
          Examples
          <HelpTip
            text="Clicking an example loads it into the box. Nothing is stored until you press Store credential. Hover a chip to read how that credential shows up in the graph."
          />
        </div>
        <div v-for="group in EXAMPLE_GROUPS" :key="group" class="mb-2">
          <div class="text-caption text-medium-emphasis mb-1">{{ group }}</div>
          <div class="d-flex flex-wrap">
            <v-tooltip
              v-for="item in POST_EXAMPLES.filter((entry) => entry.group === group)"
              :key="item.id"
              location="bottom"
              max-width="320"
            >
              <template #activator="{ props }">
                <v-chip
                  v-bind="props"
                  class="mr-2 mb-2"
                  :color="example?.id === item.id ? 'primary' : undefined"
                  :variant="example?.id === item.id ? 'flat' : 'outlined'"
                  :disabled="posting"
                  @click="loadExample(item)"
                >
                  {{ item.title }}
                </v-chip>
              </template>
              <span class="text-body-2">{{ item.hint }}</span>
            </v-tooltip>
          </div>
        </div>
        <p v-if="example" class="text-body-2 text-medium-emphasis mb-3">{{ example.hint }}</p>
        <v-textarea
          v-model="credential"
          label="Verifiable credential or presentation"
          placeholder="Paste a signed JWT, or a W3C enveloped credential"
          rows="8"
          auto-grow
          max-rows="16"
          variant="outlined"
          hide-details
        />
        <div class="d-flex align-center mt-3">
          <v-btn color="primary" :loading="posting" :disabled="posting" @click="postCredential">
            Store credential
          </v-btn>
        </div>
        <v-alert v-if="postError" type="warning" variant="tonal" class="mt-4" :text="postError" />
        <v-alert v-if="postMessage" type="success" variant="tonal" class="mt-4" :text="postMessage" />
        <v-alert
          v-for="warning in postWarnings"
          :key="warning"
          type="info"
          variant="tonal"
          class="mt-2"
          :text="warning"
        />
      </v-card-text>
    </v-card>

    <v-alert v-if="error" type="warning" variant="tonal" class="mb-4" :text="error" />
    <v-data-table
      :headers="headers"
      :items="assets"
      :loading="loading"
      item-value="id"
      @click:row="(_event: unknown, row: { item: PostedAsset }) => openAsset(row.item)"
    >
      <template v-for="header in headers" :key="header.key" #[`header.${header.key}`]="{ column, getSortIcon }">
        <div class="v-data-table-header__content">
          <span class="d-inline-flex align-center">
            {{ column.title }}
            <HelpTip :text="header.hint" />
          </span>
          <v-icon v-if="column.sortable !== false" :icon="getSortIcon(column)" class="v-data-table-header__sort-icon" />
        </div>
      </template>
      <template #no-data>
        <div class="pa-4 text-body-2">
          <template v-if="error">Could not list assets.</template>
          <template v-else>
            No assets stored yet. Choose an example above and store it, or wait for a participant to publish one.
            After the set is stored, Explore the graph shows how the claims connect.
          </template>
        </div>
      </template>
    </v-data-table>

    <v-card v-if="contentLoading || selected || contentError" border class="mt-4">
      <v-card-item>
        <v-card-title>Stored body</v-card-title>
        <v-card-subtitle v-if="selected">{{ selected.contentType || "unknown type" }}</v-card-subtitle>
      </v-card-item>
      <v-card-text>
        <v-progress-linear v-if="contentLoading" indeterminate color="primary" class="mb-2" />
        <v-alert v-if="contentError" type="warning" variant="tonal" :text="contentError" />
        <p v-else-if="selected?.binary" class="text-medium-emphasis">
          This asset is not text. The catalogue kept the file, and this view does not render it.
        </p>
        <pre v-else class="text-body-2" style="white-space: pre-wrap; max-height: 28rem; overflow: auto">{{
          selected?.content || "This asset has no stored text."
        }}</pre>
      </v-card-text>
    </v-card>
  </div>
</template>
