<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  curseforge_search_mods,
  curseforge_get_mod_files,
  curseforge_is_enabled,
  type CurseForgeMod,
  type CurseForgeSearchParams,
  CURSEFORGE_LOADER_TYPES,
  CURSEFORGE_SORT_FIELDS,
} from '@/helpers/curseforge'

const props = defineProps<{
  gameVersion?: string
  modLoader?: string
}>()

const emit = defineEmits<{
  install: [mod: CurseForgeMod]
}>()

const searchQuery = ref('')
const searchResults = ref<CurseForgeMod[]>([])
const isLoading = ref(false)
const isEnabled = ref(false)
const apiKey = ref('')
const currentPage = ref(0)
const pageSize = 20
const totalCount = ref(0)

const sortOptions = [
  { value: CURSEFORGE_SORT_FIELDS.POPULARITY, label: 'Popular' },
  { value: CURSEFORGE_SORT_FIELDS.LAST_UPDATED, label: 'Last Updated' },
  { value: CURSEFORGE_SORT_FIELDS.DOWNLOADS, label: 'Downloads' },
  { value: CURSEFORGE_SORT_FIELDS.RATING, label: 'Rating' },
]

const selectedSort = ref(CURSEFORGE_SORT_FIELDS.POPULARITY)

async function checkEnabled() {
  isEnabled.value = await curseforge_is_enabled()
}

async function performSearch() {
  if (!isEnabled.value || !apiKey.value) return

  isLoading.value = true
  try {
    const params: CurseForgeSearchParams = {
      query: searchQuery.value || undefined,
      game_version: props.gameVersion,
      mod_loader_type: props.modLoader
        ? CURSEFORGE_LOADER_TYPES[props.modLoader.toUpperCase() as keyof typeof CURSEFORGE_LOADER_TYPES]
        : undefined,
      sort_field: selectedSort.value,
      page_size: pageSize,
      index: currentPage.value * pageSize,
    }

    const result = await curseforge_search_mods(apiKey.value, params)
    searchResults.value = result.data
    totalCount.value = result.pagination.total_count
  } catch (error) {
    console.error('CurseForge search failed:', error)
  } finally {
    isLoading.value = false
  }
}

function nextPage() {
  currentPage.value++
  performSearch()
}

function prevPage() {
  if (currentPage.value > 0) {
    currentPage.value--
    performSearch()
  }
}

watch(searchQuery, () => {
  currentPage.value = 0
  performSearch()
})

watch(selectedSort, () => {
  currentPage.value = 0
  performSearch()
})

checkEnabled()
</script>

<template>
  <div class="curseforge-search">
    <div v-if="!isEnabled" class="curseforge-disabled">
      <p>CurseForge integration is not enabled.</p>
      <p>Add your CurseForge API key in Settings to enable it.</p>
    </div>

    <div v-else class="curseforge-content">
      <div class="search-controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search CurseForge mods..."
          class="search-input"
        />
        <select v-model="selectedSort" class="sort-select">
          <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
      </div>

      <div v-if="isLoading" class="loading">
        Loading...
      </div>

      <div v-else-if="searchResults.length === 0" class="no-results">
        No mods found.
      </div>

      <div v-else class="mod-grid">
        <div
          v-for="mod in searchResults"
          :key="mod.id"
          class="mod-card"
        >
          <div class="mod-header">
            <img
              v-if="mod.logo"
              :src="mod.logo.url"
              :alt="mod.name"
              class="mod-icon"
            />
            <div class="mod-info">
              <h3 class="mod-name">{{ mod.name }}</h3>
              <p class="mod-downloads">{{ mod.download_count.toLocaleString() }} downloads</p>
            </div>
          </div>
          <p class="mod-summary">{{ mod.summary }}</p>
          <button
            class="install-button"
            @click="emit('install', mod)"
          >
            Install
          </button>
        </div>
      </div>

      <div v-if="totalCount > pageSize" class="pagination">
        <button :disabled="currentPage === 0" @click="prevPage">Previous</button>
        <span>Page {{ currentPage + 1 }} of {{ Math.ceil(totalCount / pageSize) }}</span>
        <button :disabled="(currentPage + 1) * pageSize >= totalCount" @click="nextPage">Next</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.curseforge-search {
  padding: 1rem;
}

.curseforge-disabled {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.search-controls {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.search-input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
}

.sort-select {
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
}

.loading,
.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-secondary);
}

.mod-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
}

.mod-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 1rem;
  background: var(--color-bg-secondary);
}

.mod-header {
  display: flex;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.mod-icon {
  width: 48px;
  height: 48px;
  border-radius: 4px;
  object-fit: cover;
}

.mod-info {
  flex: 1;
}

.mod-name {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
}

.mod-downloads {
  margin: 0;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
}

.mod-summary {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  margin-bottom: 1rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.install-button {
  width: 100%;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  background: var(--color-brand);
  color: white;
  cursor: pointer;
}

.install-button:hover {
  background: var(--color-brand-hover);
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.pagination button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg);
  color: var(--color-text);
  cursor: pointer;
}

.pagination button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
