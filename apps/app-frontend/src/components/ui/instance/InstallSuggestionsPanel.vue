<template>
	<Transition
		enter-active-class="transition duration-300 ease-out"
		enter-from-class="translate-y-4 opacity-0"
		enter-to-class="translate-y-0 opacity-100"
		leave-active-class="transition duration-200 ease-in"
		leave-from-class="translate-y-0 opacity-100"
		leave-to-class="translate-y-4 opacity-0"
	>
		<div
			v-if="context"
			class="fixed bottom-4 right-4 z-40 w-[26rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-solid border-surface-4 bg-bg-raised shadow-2xl"
		>
			<div
				class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-brand-highlight to-transparent"
			/>

			<div class="relative flex items-start gap-3 p-4">
				<span
					class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-highlight text-brand"
				>
					<SparklesIcon class="size-5" aria-hidden="true" />
				</span>
				<div class="min-w-0 flex-1">
					<p class="m-0 font-semibold leading-6 text-contrast">
						{{ formatMessage(messages.header, { project: context.title }) }}
					</p>
					<p class="m-0 text-sm leading-5 text-secondary">
						{{ instanceSummary }}
					</p>
				</div>
				<IconButton
					type="quiet"
					:label="formatMessage(commonMessages.closeButton)"
					@click="dismissInstallSuggestions()"
				>
					<XIcon class="size-4" aria-hidden="true" />
				</IconButton>
			</div>

			<div class="relative px-4 pb-2">
				<div v-if="loading" class="flex flex-col gap-2 pb-2">
					<div
						v-for="index in 3"
						:key="index"
						class="suggestion-skeleton h-[68px] rounded-xl bg-surface-2"
						:style="{ animationDelay: `${index * 90}ms` }"
					/>
				</div>

				<p v-else-if="suggestions.length === 0" class="m-0 py-2 text-sm text-secondary">
					{{ formatMessage(messages.empty) }}
				</p>

				<div v-else class="flex flex-col gap-2 pb-2">
					<div
						v-for="(suggestion, index) in suggestions"
						:key="suggestion.projectId"
						class="suggestion-row flex items-center gap-3 rounded-xl border border-solid border-surface-4 bg-surface-2 p-2.5 transition-colors duration-200 hover:border-brand"
						:style="{ animationDelay: `${index * 55}ms` }"
					>
						<img
							v-if="suggestion.iconUrl"
							:src="suggestion.iconUrl"
							:alt="suggestion.title"
							class="size-11 shrink-0 rounded-lg object-cover"
						/>
						<span v-else class="size-11 shrink-0 rounded-lg bg-surface-4" />

						<div class="min-w-0 flex-1">
							<p class="m-0 truncate font-medium leading-5 text-contrast">
								{{ suggestion.title }}
							</p>
							<p class="m-0 truncate text-xs leading-4 text-secondary">
								{{ suggestionReason(suggestion) }}
							</p>
						</div>

						<Button
							v-if="installingId === suggestion.projectId"
							type="quiet"
							size="sm"
							disabled
							class="shrink-0"
						>
							<SpinnerIcon class="size-4 animate-spin" aria-hidden="true" />
							{{ formatMessage(messages.adding) }}
						</Button>
						<Button
							v-else-if="addedIds.has(suggestion.projectId)"
							type="quiet"
							color="green"
							size="sm"
							disabled
							class="shrink-0"
						>
							<CheckIcon class="size-4" aria-hidden="true" />
							{{ formatMessage(messages.added) }}
						</Button>
						<Button
							v-else
							type="colored"
							color="brand"
							size="sm"
							class="shrink-0"
							:disabled="busy"
							@click="addSuggestion(suggestion)"
						>
							<PlusIcon class="size-4" aria-hidden="true" />
							{{ formatMessage(messages.addButton) }}
						</Button>
					</div>
				</div>
			</div>

			<div
				class="relative flex items-center justify-between gap-2 border-t border-solid border-surface-4 px-4 py-2.5"
			>
				<span class="truncate text-xs text-secondary">
					{{ formatMessage(messages.sourceNote) }}
				</span>
				<Button type="quiet" size="sm" class="shrink-0" @click="openCurseForge()">
					<ExternalIcon class="size-4" aria-hidden="true" />
					{{ formatMessage(messages.curseforgeLink) }}
				</Button>
			</div>
		</div>
	</Transition>
</template>

<script setup lang="ts">
import {
	CheckIcon,
	ExternalIcon,
	PlusIcon,
	SparklesIcon,
	SpinnerIcon,
	XIcon,
} from '@modrinth/assets'
import { Button, commonMessages, defineMessages, IconButton, useVIntl } from '@modrinth/ui'
import { openUrl } from '@tauri-apps/plugin-opener'
import { computed, ref, watch } from 'vue'

import {
	curseforgeSearchUrl,
	findRelatedProjects,
	type RelatedProjectSuggestion,
} from '@/composables/instances/use-related-mods'
import { trackEvent } from '@/helpers/analytics'
import { get_installed_project_ids } from '@/helpers/instance'
import { injectContentInstall } from '@/providers/content-install'
import { dismissInstallSuggestions, installSuggestionState } from '@/providers/install-suggestions'

const { formatMessage } = useVIntl()
const { install } = injectContentInstall()

const messages = defineMessages({
	header: {
		id: 'app.install-suggestions.header',
		defaultMessage: 'Mods that go with {project}?',
	},
	instanceSummary: {
		id: 'app.install-suggestions.instance-summary',
		defaultMessage: 'For {instance} · {gameVersion} {loader}',
	},
	empty: {
		id: 'app.install-suggestions.empty',
		defaultMessage:
			'Found nothing on Modrinth that matches this instance version and loader for that project.',
	},
	addButton: {
		id: 'app.install-suggestions.add-button',
		defaultMessage: 'Add',
	},
	adding: {
		id: 'app.install-suggestions.adding',
		defaultMessage: 'Adding',
	},
	added: {
		id: 'app.install-suggestions.added',
		defaultMessage: 'Added',
	},
	reasonRelated: {
		id: 'app.install-suggestions.reason-related',
		defaultMessage: 'Related to {project}',
	},
	reasonPopular: {
		id: 'app.install-suggestions.reason-popular',
		defaultMessage: '{downloads} downloads · often used in modpacks',
	},
	sourceNote: {
		id: 'app.install-suggestions.source-note',
		defaultMessage: 'From Modrinth search, matched to this instance',
	},
	curseforgeLink: {
		id: 'app.install-suggestions.curseforge-link',
		defaultMessage: 'Search CurseForge',
	},
})

const context = installSuggestionState.current
const loading = ref(false)
const busy = ref(false)
const suggestions = ref<RelatedProjectSuggestion[]>([])
const addedIds = ref(new Set<string>())
const installingId = ref<string | null>(null)

const instanceSummary = computed(() => {
	if (!context.value) return ''
	return formatMessage(messages.instanceSummary, {
		instance: context.value.instanceName ?? context.value.instanceId ?? '',
		gameVersion: context.value.gameVersion ?? '',
		loader: context.value.loader ?? '',
	})
})

function formatDownloads(count: number) {
	return count >= 1_000_000
		? `${(count / 1_000_000).toFixed(1)}M`
		: count >= 1_000
			? `${Math.round(count / 1_000)}K`
			: `${count}`
}

function suggestionReason(suggestion: RelatedProjectSuggestion) {
	if (suggestion.reason === 'mentions-installed' && context.value) {
		return formatMessage(messages.reasonRelated, { project: context.value.title })
	}

	return formatMessage(messages.reasonPopular, {
		downloads: formatDownloads(suggestion.downloads),
	})
}

async function loadSuggestions() {
	const installed = context.value
	if (!installed) return

	loading.value = true
	suggestions.value = []

	try {
		const installedIds = installed.instanceId
			? new Set(await get_installed_project_ids(installed.instanceId).catch(() => []))
			: new Set<string>()
		installedIds.add(installed.projectId)

		const related = await findRelatedProjects(installed, installedIds)
		// Ignore the result if another install replaced this context meanwhile
		if (context.value?.projectId === installed.projectId) {
			suggestions.value = related
		}
	} catch (error) {
		console.error('Failed to load install suggestions', error)
		suggestions.value = []
	} finally {
		loading.value = false
	}
}

async function addSuggestion(suggestion: RelatedProjectSuggestion) {
	const installed = context.value
	if (!installed?.instanceId) return

	busy.value = true
	installingId.value = suggestion.projectId

	try {
		await install(suggestion.projectId, null, installed.instanceId, 'InstallSuggestions')
		addedIds.value = new Set([...addedIds.value, suggestion.projectId])
		trackEvent('InstallSuggestionAccepted', {
			id: suggestion.projectId,
			title: suggestion.title,
			seed: installed.title,
			project_type: suggestion.projectType,
			loader: installed.loader ?? '',
			game_version: installed.gameVersion ?? '',
		})
	} finally {
		installingId.value = null
		busy.value = false
	}
}

function openCurseForge() {
	if (!context.value) return
	trackEvent('InstallSuggestionCurseForgeSearch', { seed: context.value.title })
	void openUrl(curseforgeSearchUrl(context.value.title))
}

watch(
	() => context.value?.projectId,
	(newProjectId, oldProjectId) => {
		if (!newProjectId) {
			suggestions.value = []
			addedIds.value = new Set()
			return
		}
		if (newProjectId !== oldProjectId) {
			addedIds.value = new Set()
		}
		void loadSuggestions()
	},
	{ immediate: true },
)
</script>

<style scoped>
.suggestion-row {
	animation: suggestion-row-in 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.suggestion-skeleton {
	animation: suggestion-skeleton-pulse 1.4s ease-in-out infinite;
}

@keyframes suggestion-row-in {
	from {
		opacity: 0;
		transform: translateY(8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes suggestion-skeleton-pulse {
	0%,
	100% {
		opacity: 0.45;
	}
	50% {
		opacity: 0.85;
	}
}
</style>
