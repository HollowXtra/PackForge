import type { Labrinth } from '@modrinth/api-client'
import { ref } from 'vue'

import { get_project_many, get_version_many } from '@/helpers/cache.js'

/**
 * What a project needs and what it conflicts with is only published in the
 * dependency metadata of its versions, so the health check reads it from the
 * versions of the installed files instead of guessing from categories or names.
 */

/** An installed content item, as far as the health check needs to see it. */
export interface ContentHealthSourceItem {
	id: string
	file_name: string
	file_path?: string
	enabled?: boolean
	project?: {
		id?: string | null
		slug?: string | null
		title?: string | null
		icon_url?: string | null
	} | null
	version?: {
		id?: string | null
		version_number?: string | null
	} | null
	project_type?: string
	external?: boolean
	/** Files still being downloaded are not installed yet */
	installing?: boolean
}

/** The project and version of an installed file, shaped for content cards. */
export interface ContentHealthEntryRef {
	id: string
	fileName: string
	projectId: string | null
	versionId: string | null
	project: {
		id: string
		slug: string
		title: string
		icon_url: string | undefined
	} | null
	version: {
		id: string
		version_number: string
		file_name: string
	} | null
}

export interface MissingContentDependency {
	/** Stable key for lists and de-duplication */
	key: string
	/** Project that provides the dependency, when it can be determined */
	projectId: string | null
	/**
	 * Installed copies that are disabled. Enabling one of these is the right fix,
	 * since installing the dependency again would only duplicate it.
	 */
	disabled: ContentHealthEntryRef[]
	/** Version the dependent asked for, when it pinned one */
	versionId: string | null
	/** File the dependent named, when it did not name a project */
	fileName: string | null
	project: ContentHealthEntryRef['project']
	version: ContentHealthEntryRef['version']
	/** Whether it is published on Modrinth, and so can be installed for you */
	installable: boolean
	/** Installed content that needs it */
	requiredBy: ContentHealthEntryRef[]
}

export interface ContentHealthConflict {
	key: string
	/** Installed content that declares the incompatibility */
	declarer: ContentHealthEntryRef
	/** Installed content it is incompatible with */
	target: ContentHealthEntryRef
}

export interface ContentHealthReport {
	missingDependencies: MissingContentDependency[]
	conflicts: ContentHealthConflict[]
	/** Installed content whose dependencies were checked */
	checkedContent: number
	/** Installed files without Modrinth metadata, which cannot be checked */
	uncheckedContent: number
}

export function hasContentHealthProblems(report: ContentHealthReport | null) {
	return !!report && (report.missingDependencies.length > 0 || report.conflicts.length > 0)
}

export function contentHealthEntryLabel(entry: ContentHealthEntryRef) {
	return entry.project?.title ?? entry.fileName.replace(/\.disabled$/, '')
}

function normalizeFileName(fileName: string | null | undefined) {
	return (fileName ?? '')
		.replace(/\.disabled$/, '')
		.trim()
		.toLowerCase()
}

function dependencyProjectId(dependency: Labrinth.Versions.v2.Dependency) {
	return dependency.project_id ?? null
}

function dependencyVersionId(dependency: Labrinth.Versions.v2.Dependency) {
	return 'version_id' in dependency ? (dependency.version_id ?? null) : null
}

function entryRef(item: ContentHealthSourceItem): ContentHealthEntryRef {
	const projectId = item.project?.id ?? null
	const versionId = item.version?.id ?? null
	const title = (item.project?.title ?? item.file_name).replace(/\.disabled$/, '')

	return {
		id: item.id,
		fileName: item.file_name,
		projectId,
		versionId,
		project:
			projectId && item.project
				? {
						id: projectId,
						slug: item.project.slug ?? projectId,
						title,
						icon_url: item.project.icon_url ?? undefined,
					}
				: null,
		version:
			versionId && item.version
				? {
						id: versionId,
						version_number: item.version.version_number ?? '',
						file_name: item.file_name,
					}
				: null,
	}
}

function dependencyMatchesItem(
	dependency: Labrinth.Versions.v2.Dependency,
	item: ContentHealthSourceItem,
) {
	const projectId = dependencyProjectId(dependency)
	if (projectId) return projectId === item.project?.id

	const versionId = dependencyVersionId(dependency)
	if (versionId) return versionId === item.version?.id

	if (dependency.file_name) {
		const fileName = normalizeFileName(dependency.file_name)
		return (
			fileName === normalizeFileName(item.file_name) ||
			fileName === normalizeFileName(item.file_path)
		)
	}

	return false
}

/**
 * Whether something installed already satisfies a dependency.
 *
 * Disabled files do not count: they are not loaded by the game, so whatever
 * needs them is still missing them.
 */
function dependencyIsSatisfied(
	dependency: Labrinth.Versions.v2.Dependency,
	installedProjectIds: Set<string>,
	installedVersionIds: Set<string>,
	installedFileNames: Set<string>,
) {
	const projectId = dependencyProjectId(dependency)
	if (projectId) return installedProjectIds.has(projectId)

	const versionId = dependencyVersionId(dependency)
	if (versionId) return installedVersionIds.has(versionId)

	if (dependency.file_name) {
		return installedFileNames.has(normalizeFileName(dependency.file_name))
	}

	return true
}

function dependencyKey(dependency: Labrinth.Versions.v2.Dependency) {
	const projectId = dependencyProjectId(dependency)
	if (projectId) return `project:${projectId}`

	const versionId = dependencyVersionId(dependency)
	if (versionId) return `version:${versionId}`

	return `file:${normalizeFileName(dependency.file_name)}`
}

/**
 * Finds missing required dependencies and incompatible content in an instance.
 *
 * Only enabled content is checked, and only content published on Modrinth can
 * be: files without version metadata are counted and reported as unchecked.
 */
export async function scanContentHealth(
	items: ContentHealthSourceItem[],
): Promise<ContentHealthReport> {
	const installed = items.filter((item) => !item.installing)
	const enabled = installed.filter((item) => item.enabled !== false)
	const disabled = installed.filter((item) => item.enabled === false)

	const installedProjectIds = new Set(
		enabled.map((item) => item.project?.id).filter((id): id is string => !!id),
	)
	const installedVersionIds = new Set(
		enabled.map((item) => item.version?.id).filter((id): id is string => !!id),
	)
	const installedFileNames = new Set(
		enabled.flatMap((item) => [
			normalizeFileName(item.file_name),
			normalizeFileName(item.file_path),
		]),
	)

	const versionIds = [...installedVersionIds]
	const versions = versionIds.length
		? (((await get_version_many(versionIds)) as Labrinth.Versions.v2.Version[] | null) ?? [])
		: []
	const versionsById = new Map(versions.map((version) => [version.id, version]))

	const missing = new Map<string, MissingContentDependency>()
	const conflicts = new Map<string, ContentHealthConflict>()
	let checkedContent = 0
	let uncheckedContent = 0

	for (const item of enabled) {
		const version = item.version?.id ? versionsById.get(item.version.id) : undefined
		if (!version) {
			uncheckedContent++
			continue
		}
		checkedContent++

		const entry = entryRef(item)

		for (const dependency of version.dependencies ?? []) {
			if (dependency.dependency_type === 'required') {
				if (
					dependencyIsSatisfied(
						dependency,
						installedProjectIds,
						installedVersionIds,
						installedFileNames,
					)
				) {
					continue
				}

				const key = dependencyKey(dependency)
				const existing = missing.get(key)

				if (existing) {
					existing.requiredBy.push(entry)
					continue
				}

				missing.set(key, {
					key,
					projectId: dependencyProjectId(dependency),
					versionId: dependencyVersionId(dependency),
					fileName: dependency.file_name ?? null,
					disabled: disabled
						.filter((candidate) => dependencyMatchesItem(dependency, candidate))
						.map(entryRef),
					project: null,
					version: null,
					installable: false,
					requiredBy: [entry],
				})
			} else if (dependency.dependency_type === 'incompatible') {
				const target = enabled.find(
					(candidate) => candidate.id !== item.id && dependencyMatchesItem(dependency, candidate),
				)
				if (!target) continue

				const key = [item.id, target.id].sort().join('::')
				if (conflicts.has(key)) continue

				conflicts.set(key, { key, declarer: entry, target: entryRef(target) })
			}
		}
	}

	await resolveMissingDependencies(missing)

	return {
		missingDependencies: [...missing.values()].sort(
			(a, b) =>
				Number(b.disabled.length > 0) - Number(a.disabled.length > 0) ||
				b.requiredBy.length - a.requiredBy.length ||
				displayName(a).localeCompare(displayName(b)),
		),
		conflicts: [...conflicts.values()].sort(
			(a, b) =>
				contentHealthEntryLabel(a.declarer).localeCompare(contentHealthEntryLabel(b.declarer)) ||
				contentHealthEntryLabel(a.target).localeCompare(contentHealthEntryLabel(b.target)),
		),
		checkedContent,
		uncheckedContent,
	}
}

function displayName(dependency: MissingContentDependency) {
	return (
		dependency.project?.title ??
		dependency.fileName ??
		dependency.versionId ??
		dependency.projectId ??
		''
	)
}

/**
 * Names the projects behind the missing dependencies, so they can be shown and
 * installed. Dependencies that only name a file cannot be resolved to a project
 * and stay uninstallable.
 */
async function resolveMissingDependencies(missing: Map<string, MissingContentDependency>) {
	const dependencies = [...missing.values()]

	const pinnedVersionIds = [
		...new Set(
			dependencies
				.filter((dependency) => dependency.versionId && !dependency.projectId)
				.map((dependency) => dependency.versionId as string),
		),
	]
	if (pinnedVersionIds.length > 0) {
		const pinnedVersions =
			((await get_version_many(pinnedVersionIds)) as Labrinth.Versions.v2.Version[] | null) ?? []
		const pinnedVersionsById = new Map(pinnedVersions.map((version) => [version.id, version]))

		for (const dependency of dependencies) {
			if (!dependency.versionId) continue

			const version = pinnedVersionsById.get(dependency.versionId)
			if (!version) continue

			dependency.projectId ??= version.project_id ?? null
			dependency.version = {
				id: version.id,
				version_number: version.version_number ?? '',
				file_name: version.files?.find((file) => file.primary)?.filename ?? '',
			}
		}
	}

	const projectIds = [
		...new Set(
			dependencies.map((dependency) => dependency.projectId).filter((id): id is string => !!id),
		),
	]
	if (projectIds.length === 0) return

	const projects =
		((await get_project_many(projectIds)) as Labrinth.Projects.v2.Project[] | null) ?? []
	const projectsById = new Map(projects.map((project) => [project.id, project]))

	for (const dependency of dependencies) {
		if (!dependency.projectId) continue

		const project = projectsById.get(dependency.projectId)
		if (!project) continue

		dependency.project = {
			id: project.id,
			slug: project.slug ?? project.id,
			title: project.title,
			icon_url: project.icon_url ?? undefined,
		}
		dependency.installable = true
	}
}

/** Content health check state for the instance content page. */
export function useContentHealth() {
	const report = ref<ContentHealthReport | null>(null)
	const checking = ref(false)

	async function check(items: ContentHealthSourceItem[]) {
		checking.value = true
		try {
			report.value = await scanContentHealth(items)
		} finally {
			checking.value = false
		}
	}

	return { report, checking, check }
}
