<script setup lang="ts">
import { CompassIcon, DownloadIcon, PlusIcon, SpinnerIcon } from '@modrinth/assets'
import { Button, defineMessages, injectNotificationManager, useVIntl } from '@modrinth/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useModRecommendations } from '@/composables/instances/use-recommendations'
import { trackEvent } from '@/helpers/analytics'
import type { GameInstance } from '@/helpers/types'
import { injectContentInstall } from '@/providers/content-install'

const props = defineProps<{
	instance: GameInstance
	installedProjectIds: string[]
}>()

const { formatMessage } = useVIntl()
const { handleError } = injectNotificationManager()
const router = useRouter()
const { install: installVersion } = injectContentInstall()

const messages = defineMessages({
	recommendedMods: {
		id: 'app.instance.recommendations.title',
		defaultMessage: 'Recommended for you',
	},
	recommendedModsDescription: {
		id: 'app.instance.recommendations.description',
		defaultMessage: 'Popular mods compatible with your setup',
	},
	viewAll: {
		id: 'app.instance.recommendations.view-all',
		defaultMessage: 'Browse more',
	},
	installing: {
		id: 'app.instance.recommendations.installing',
		defaultMessage: 'Installing...',
	},
	installed: {
		id: 'app.instance.recommendations.installed',
		defaultMessage: 'Installed',
	},
	install: {
		id: 'app.instance.recommendations.install',
		defaultMessage: 'Install',
	},
	failedToLoad: {
		id: 'app.instance.recommendations.failed-to-load',
		defaultMessage: 'Failed to load recommendations',
	},
})

const installedIdsRef = computed(() => props.installedProjectIds)
const { recommendations, isLoading, topCategories } = useModRecommendations(
	computed(() => props.instance),
	installedIdsRef,
)

const installingProjects = computed(() => new Set<string>())

const isVisible = computed(
	() => recommendations.value.length > 0 && !isLoading.value,
)

function formatDownloads(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
	if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`
	return String(count)
}

function getCategoryLabel(category: string): string {
	return category
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ')
}

async function handleInstall(mod: {
	projectId: string
	name: string
}) {
	try {
		await installVersion(
			mod.projectId,
			null,
			props.instance.id,
			'Recommendations',
			(_versionId, _installedProjectIds) => {
				trackEvent('ProjectInstall', {
					loader: props.instance.loader,
					game_version: props.instance.game_version,
					id: mod.projectId,
					project_type: 'mod',
					title: mod.name,
					source: 'Recommendations',
				})
			},
		)
	} catch (err) {
		handleError(err as Error)
	}
}

function handleBrowseMore() {
	router.push({
		path: `/browse/mod`,
		query: { i: props.instance.id },
	})
}
</script>

<template>
	<div v-if="isVisible" class="recommendations-section">
		<div class="mb-3 flex items-center justify-between">
			<div>
				<h3 class="m-0 text-lg font-semibold text-contrast">
					{{ formatMessage(messages.recommendedMods) }}
				</h3>
				<p class="m-0 mt-0.5 text-sm text-secondary">
					{{ formatMessage(messages.recommendedModsDescription) }}
				</p>
			</div>
			<Button type="quiet" size="sm" @click="handleBrowseMore">
				<CompassIcon class="size-4" />
				{{ formatMessage(messages.viewAll) }}
			</Button>
		</div>

		<div v-if="topCategories.length > 0" class="mb-3 flex flex-wrap gap-1.5">
			<span class="text-xs text-secondary">Based on your:</span>
			<span
				v-for="category in topCategories.slice(0, 3)"
				:key="category"
				class="inline-flex items-center rounded-md bg-brand-highlight px-1.5 py-0.5 text-[10px] font-medium text-brand"
			>
				{{ getCategoryLabel(category) }}
			</span>
		</div>

		<div class="recommendations-grid">
			<div
				v-for="mod in recommendations"
				:key="mod.projectId"
				class="recommendation-card group"
			>
				<div class="flex items-start gap-3">
					<img
						v-if="mod.iconUrl"
						:src="mod.iconUrl"
						:alt="mod.name"
						class="size-10 shrink-0 rounded-lg object-cover"
					/>
					<div v-else class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-3">
						<CompassIcon class="size-5 text-secondary" />
					</div>

					<div class="min-w-0 flex-1">
						<h4 class="m-0 truncate text-sm font-semibold text-contrast">{{ mod.name }}</h4>
						<p class="m-0 mt-0.5 line-clamp-2 text-xs text-secondary">{{ mod.summary }}</p>

						<div class="mt-1.5 flex flex-wrap items-center gap-1.5">
							<span
								v-for="category in mod.categories.slice(0, 2)"
								:key="category"
								class="inline-flex items-center rounded-md bg-surface-3 px-1.5 py-0.5 text-[10px] font-medium text-secondary"
							>
								{{ getCategoryLabel(category) }}
							</span>
							<span class="flex items-center gap-0.5 text-[10px] text-secondary">
								<DownloadIcon class="size-3" />
								{{ formatDownloads(mod.downloads) }}
							</span>
						</div>
					</div>
				</div>

				<div class="mt-3">
					<Button
						type="outlined"
						size="sm"
						color="brand"
						class="w-full"
						@click="handleInstall(mod)"
					>
						<PlusIcon class="size-4" />
						{{ formatMessage(messages.install) }}
					</Button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.recommendations-section {
	padding: 1rem;
	background: var(--color-bg);
	border-radius: 0.75rem;
	border: 1px solid var(--color-surface-5);
}

.recommendations-grid {
	display: grid;
	grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
	gap: 0.75rem;
}

.recommendation-card {
	display: flex;
	flex-direction: column;
	padding: 0.75rem;
	background: var(--color-surface-2);
	border-radius: 0.5rem;
	border: 1px solid var(--color-surface-5);
	transition: all 0.15s ease;
}

.recommendation-card:hover {
	border-color: var(--color-brand-highlight);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.line-clamp-2 {
	display: -webkit-box;
	-webkit-line-clamp: 2;
	-webkit-box-orient: vertical;
	overflow: hidden;
}
</style>
