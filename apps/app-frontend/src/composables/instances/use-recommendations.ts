import type { Labrinth } from '@modrinth/api-client'
import { useQuery } from '@tanstack/vue-query'
import { computed, type Ref, ref, watch } from 'vue'

import { get_project_many, get_search_results_v3 } from '@/helpers/cache.js'
import type { GameInstance } from '@/helpers/types'

export interface RecommendedMod {
	projectId: string
	name: string
	summary: string
	iconUrl: string | null
	downloads: number
	follows: number
	categories: string[]
	slug: string | null
	dateModified: string
}

function formatSearchFilterValue(value: string): string {
	if (value === 'true' || value === 'false') {
		return value
	}
	return `\`${value}\``
}

function parseSearchResults(
	data: { result: Labrinth.Search.v3.SearchResults } | null,
): RecommendedMod[] {
	if (!data?.result?.hits) return []

	return data.result.hits.map((hit) => ({
		projectId: hit.project_id,
		name: hit.name,
		summary: hit.summary,
		iconUrl: hit.icon_url,
		downloads: hit.downloads,
		follows: hit.follows,
		categories: hit.categories,
		slug: hit.slug,
		dateModified: hit.date_modified,
	}))
}

function countCategories(projects: Array<{ categories?: string[] }>): Map<string, number> {
	const counts = new Map<string, number>()
	for (const project of projects) {
		if (!project.categories) continue
		for (const category of project.categories) {
			counts.set(category, (counts.get(category) ?? 0) + 1)
		}
	}
	return counts
}

function getTopCategories(
	categoryCounts: Map<string, number>,
	excludeCategories: Set<string> = new Set(),
): string[] {
	const sorted = [...categoryCounts.entries()]
		.filter(([cat]) => !excludeCategories.has(cat))
		.sort((a, b) => b[1] - a[1])
	return sorted.slice(0, 5).map(([cat]) => cat)
}

const LOADER_FILTER_MAP: Record<string, string> = {
	fabric: 'fabric',
	forge: 'forge',
	quilt: 'quilt',
	neoforge: 'neoforge',
}

export function useModRecommendations(
	instance: Ref<GameInstance | undefined>,
	installedProjectIds: Ref<string[]>,
) {
	const installedProjects = ref<Array<{ categories?: string[] }>>([])
	const categoryCounts = ref<Map<string, number>>(new Map())
	const isLoadingProjects = ref(false)

	watch(
		installedProjectIds,
		async (ids) => {
			if (ids.length === 0) {
				installedProjects.value = []
				categoryCounts.value = new Map()
				return
			}

			isLoadingProjects.value = true
			try {
				const projects = await get_project_many(ids.slice(0, 50))
				if (Array.isArray(projects)) {
					installedProjects.value = projects.filter(
						(p): p is { categories?: string[] } => p !== null && typeof p === 'object',
					)
					categoryCounts.value = countCategories(installedProjects.value)
				}
			} catch {
				installedProjects.value = []
				categoryCounts.value = new Map()
			} finally {
				isLoadingProjects.value = false
			}
		},
		{ immediate: true },
	)

	const searchParams = computed(() => {
		const inst = instance.value
		if (!inst || inst.loader === 'vanilla') return null
		if (installedProjectIds.value.length === 0) return null
		if (isLoadingProjects.value) return null

		const parts: string[] = []
		parts.push(`project_types = ${formatSearchFilterValue('mod')}`)
		parts.push(`versions = ${formatSearchFilterValue(inst.game_version)}`)

		const loader = LOADER_FILTER_MAP[inst.loader]
		if (loader) {
			parts.push(`categories = ${formatSearchFilterValue(loader)}`)
		}

		const topCategories = getTopCategories(categoryCounts.value, new Set([loader]))
		if (topCategories.length > 0) {
			const categoryFilter = topCategories.map(formatSearchFilterValue).join(', ')
			parts.push(`display_categories IN [${categoryFilter}]`)
		}

		if (installedProjectIds.value.length > 0) {
			const excludeIds = installedProjectIds.value.slice(0, 50)
			const quoted = excludeIds.map(formatSearchFilterValue).join(', ')
			parts.push(`project_id NOT IN [${quoted}]`)
		}

		const newFilters = parts.join(' AND ')

		const params = [
			'limit=8',
			'index=downloads',
			`new_filters=${encodeURIComponent(newFilters)}`,
		]

		return `?${params.join('&')}`
	})

	const recommendationsQuery = useQuery({
		queryKey: computed(() => {
			const params = searchParams.value
			if (!params) return ['recommendations', 'disabled']
			return ['recommendations', params]
		}),
		queryFn: async () => {
			const params = searchParams.value
			if (!params) return []

			const raw = await get_search_results_v3(params)
			return parseSearchResults(raw)
		},
		enabled: computed(() => searchParams.value !== null && !isLoadingProjects.value),
		staleTime: 5 * 60_000,
		gcTime: 30 * 60_000,
		retry: false,
		refetchOnWindowFocus: false,
	})

	const recommendations = computed(() => recommendationsQuery.data.value ?? [])
	const isLoading = computed(
		() =>
			(recommendationsQuery.isLoading.value && searchParams.value !== null) ||
			isLoadingProjects.value,
	)

	return {
		recommendations,
		isLoading,
		topCategories: computed(() => getTopCategories(categoryCounts.value)),
	}
}
