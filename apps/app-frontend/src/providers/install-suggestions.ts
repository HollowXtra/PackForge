import { readonly, ref } from 'vue'

/**
 * Remembers what was just installed so the app can offer a few projects that
 * go with it. Suggestions are derived from Modrinth's search, which is the only
 * related-projects signal available for an arbitrary installed project.
 */
export interface InstalledProjectContext {
	projectId: string
	title: string
	projectType: string
	instanceId: string | null
	instanceName: string | null
	gameVersion: string | null
	loader: string | null
}

/** Project types that are worth suggesting more of */
const SUGGESTABLE_TYPES = new Set(['mod', 'plugin', 'datapack', 'resourcepack', 'shader'])

const current = ref<InstalledProjectContext | null>(null)

export const installSuggestionState = {
	current: readonly(current),
}

export function noteInstalledProject(context: InstalledProjectContext) {
	if (!SUGGESTABLE_TYPES.has(context.projectType) || !context.instanceId) return

	current.value = context
}

export function dismissInstallSuggestions() {
	current.value = null
}
