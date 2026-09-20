import type { Labrinth } from '@modrinth/api-client'

import { get_search_results } from '@/helpers/cache.js'
import type { InstalledProjectContext } from '@/providers/install-suggestions'

/**
 * Projects worth suggesting after an install.
 *
 * Modrinth publishes no "pairs with" data, so suggestions come from a search
 * seeded with the installed project's name, narrowed to the instance's game
 * version and loader, and ranked by the relevance order the search returns.
 */
export interface RelatedProjectSuggestion {
	projectId: string
	slug: string
	title: string
	iconUrl: string | null
	description: string
	projectType: string
	downloads: number
	follows: number
	/** Why the project is being suggested */
	reason: 'mentions-installed' | 'popular'
}

const SUGGESTION_LIMIT = 5
const SEARCH_LIMIT = 16

/** Project types whose versions carry loader metadata worth filtering on */
const LOADER_FILTER_TYPES = new Set(['mod', 'plugin', 'datapack'])

/** Below this, a project is more likely to be an abandoned clone than a companion */
const MIN_DOWNLOADS = 1000

function buildSearchQuery(context: InstalledProjectContext) {
	const facets: string[][] = [[`project_type:${context.projectType}`]]

	if (context.gameVersion) {
		facets.push([`versions:${context.gameVersion}`])
	}
	if (context.loader && LOADER_FILTER_TYPES.has(context.projectType)) {
		facets.push([`categories:${context.loader}`])
	}

	const params = [
		`query=${encodeURIComponent(context.title)}`,
		`facets=${encodeURIComponent(JSON.stringify(facets))}`,
		`limit=${SEARCH_LIMIT}`,
		'index=relevance',
	]

	return `?${params.join('&')}`
}

function normalise(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export async function findRelatedProjects(
	context: InstalledProjectContext,
	installedProjectIds: Set<string>,
): Promise<RelatedProjectSuggestion[]> {
	if (!context.title.trim() || context.title.trim().length < 3) return []

	const raw = await get_search_results(buildSearchQuery(context))
	const hits = (raw?.result?.hits ?? []) as Labrinth.Search.v2.ResultSearchProject[]

	const seedName = normalise(context.title)

	return hits
		.filter((hit) => {
			if (!hit.project_id || hit.project_id === context.projectId) return false
			if (installedProjectIds.has(hit.project_id)) return false
			if ((hit.downloads ?? 0) < MIN_DOWNLOADS) return false
			return true
		})
		.map((hit) => {
			const mentioned =
				normalise(hit.title ?? '').includes(seedName) ||
				normalise(hit.description ?? '').includes(seedName)

			return {
				projectId: hit.project_id,
				slug: hit.slug ?? hit.project_id,
				title: hit.title ?? hit.slug ?? hit.project_id,
				iconUrl: hit.icon_url ?? null,
				description: hit.description ?? '',
				projectType: hit.project_type ?? context.projectType,
				downloads: hit.downloads ?? 0,
				follows: hit.follows ?? 0,
				reason: mentioned ? ('mentions-installed' as const) : ('popular' as const),
			}
		})
		.slice(0, SUGGESTION_LIMIT)
}

/** Opens CurseForge's search for projects Modrinth does not have */
export function curseforgeSearchUrl(query: string) {
	return `https://www.curseforge.com/minecraft/search?page=1&pageSize=20&sortBy=relevancy&class=mc-mods&search=${encodeURIComponent(query)}`
}
