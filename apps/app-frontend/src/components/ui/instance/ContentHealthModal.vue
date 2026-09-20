<template>
	<NewModal ref="modal" max-width="680px" scrollable :header="formatMessage(messages.header)">
		<div class="flex flex-col gap-4">
			<div v-if="checking && !report" class="flex flex-col items-center gap-3 py-12 text-secondary">
				<SpinnerIcon class="size-8 animate-spin" aria-hidden="true" />
				<span>{{ formatMessage(messages.checking) }}</span>
			</div>

			<template v-else-if="report">
				<Admonition
					v-if="!hasProblems"
					type="success"
					:header="formatMessage(messages.allClearHeader)"
				>
					{{ formatMessage(messages.allClearBody) }}
				</Admonition>

				<template v-else>
					<Admonition type="warning" :header="formatMessage(messages.problemsHeader)">
						{{ formatMessage(messages.problemsBody) }}
					</Admonition>

					<div v-if="report.missingDependencies.length > 0" class="flex flex-col gap-2">
						<span class="font-semibold text-contrast">{{
							formatMessage(messages.missingLabel)
						}}</span>
						<div
							v-for="dependency in report.missingDependencies"
							:key="dependency.key"
							class="rounded-xl border border-solid border-surface-4 bg-surface-2 p-4"
						>
							<ContentCardItem
								:project="dependencyCardProject(dependency)"
								:project-link="dependencyProjectLink(dependency)"
								:version="dependency.version ?? undefined"
								inline
							>
								<template #title-badges>
									<span
										class="rounded-full bg-surface-4 px-2 py-0.5 text-xs font-medium text-secondary"
									>
										{{
											formatMessage(messages.requiredBy, {
												count: dependency.requiredBy.length,
											})
										}}
									</span>
									<span
										v-if="dependency.disabled.length > 0"
										class="rounded-full bg-surface-4 px-2 py-0.5 text-xs font-medium text-orange"
									>
										{{ formatMessage(messages.disabledBadge) }}
									</span>
								</template>
								<template #additionalButtonsRight>
									<Button
										v-if="dependency.disabled.length > 0 && canInstall"
										type="colored"
										color="brand"
										size="sm"
										@click="emit('enable', dependency)"
									>
										<CheckIcon aria-hidden="true" />
										{{ formatMessage(messages.enableButton) }}
									</Button>
									<Button
										v-else-if="canInstallDependency(dependency)"
										type="colored"
										color="brand"
										size="sm"
										@click="emit('install', dependency)"
									>
										<DownloadIcon aria-hidden="true" />
										{{ formatMessage(messages.installButton) }}
									</Button>
									<IconButton
										v-else
										v-tooltip="blockedInstallReason"
										type="quiet"
										:label="blockedInstallReason"
										disabled
									>
										<LockIcon v-if="!canInstall" class="size-5" aria-hidden="true" />
										<CircleAlertIcon v-else class="size-5" aria-hidden="true" />
									</IconButton>
								</template>
							</ContentCardItem>
							<p class="m-0 mt-1 text-xs text-secondary">
								{{
									formatMessage(messages.requiredByList, {
										projects: dependency.requiredBy
											.map((entry) => contentHealthEntryLabel(entry))
											.join(', '),
									})
								}}
							</p>
						</div>
					</div>

					<div v-if="report.conflicts.length > 0" class="flex flex-col gap-2">
						<span class="font-semibold text-contrast">{{
							formatMessage(messages.conflictsLabel)
						}}</span>
						<div
							v-for="conflict in report.conflicts"
							:key="conflict.key"
							class="rounded-xl border border-solid border-surface-4 bg-surface-2 p-4"
						>
							<ContentCardItem
								:project="conflictCardProject(conflict)"
								:project-link="entryProjectLink(conflict.target)"
								:version="conflict.target.version ?? undefined"
								inline
							>
								<template #additionalButtonsRight>
									<template v-if="isFixable(conflict.target)">
										<Button type="quiet" size="sm" @click="emit('disable', conflict.target)">
											{{ formatMessage(messages.disableButton) }}
										</Button>
										<Button type="outlined" size="sm" @click="emit('remove', conflict.target)">
											<TrashIcon aria-hidden="true" />
											{{ formatMessage(messages.removeButton) }}
										</Button>
									</template>
									<IconButton
										v-else
										v-tooltip="unfixableTooltip ?? formatMessage(messages.unfixableTooltip)"
										type="quiet"
										:label="unfixableTooltip ?? formatMessage(messages.unfixableTooltip)"
										disabled
									>
										<LockIcon class="size-5" aria-hidden="true" />
									</IconButton>
								</template>
							</ContentCardItem>
							<p class="m-0 mt-1 text-xs text-secondary">
								{{
									formatMessage(messages.conflictDeclaredBy, {
										project: contentHealthEntryLabel(conflict.declarer),
									})
								}}
							</p>
						</div>
					</div>
				</template>

				<p class="m-0 text-xs text-secondary">
					{{
						formatMessage(messages.checkedSummary, {
							count: report.checkedContent,
							unchecked: report.uncheckedContent,
						})
					}}
				</p>
			</template>

			<p v-else class="m-0 py-6 text-center text-secondary">
				{{ formatMessage(messages.notCheckedYet) }}
			</p>
		</div>

		<template #actions>
			<div class="flex justify-end gap-2">
				<Button type="outlined" @click="hide">
					<XIcon aria-hidden="true" />
					{{ formatMessage(commonMessages.closeButton) }}
				</Button>
				<Button type="colored" color="brand" :disabled="checking" @click="emit('check')">
					<RefreshCwIcon :class="checking ? 'animate-spin' : ''" aria-hidden="true" />
					{{ formatMessage(messages.checkAgainButton) }}
				</Button>
			</div>
		</template>
	</NewModal>
</template>

<script setup lang="ts">
import {
	CheckIcon,
	CircleAlertIcon,
	DownloadIcon,
	LockIcon,
	RefreshCwIcon,
	SpinnerIcon,
	TrashIcon,
	XIcon,
} from '@modrinth/assets'
import {
	Admonition,
	Button,
	commonMessages,
	ContentCardItem,
	defineMessages,
	IconButton,
	NewModal,
	useVIntl,
} from '@modrinth/ui'
import { computed, ref } from 'vue'

import {
	type ContentHealthConflict,
	contentHealthEntryLabel,
	type ContentHealthEntryRef,
	type ContentHealthReport,
	hasContentHealthProblems,
} from '@/composables/instances/use-content-health'

const props = withDefaults(
	defineProps<{
		report?: ContentHealthReport | null
		checking?: boolean
		/** Ids of installed files the health check is allowed to change */
		fixableIds?: Set<string>
		/** Why content cannot be changed, shown when a fix is unavailable */
		unfixableTooltip?: string
		/** Whether this instance still accepts new content */
		canInstall?: boolean
	}>(),
	{
		report: null,
		checking: false,
		fixableIds: () => new Set<string>(),
		unfixableTooltip: undefined,
		canInstall: true,
	},
)

const emit = defineEmits<{
	check: []
	install: [dependency: ContentHealthReport['missingDependencies'][number]]
	enable: [dependency: ContentHealthReport['missingDependencies'][number]]
	remove: [entry: ContentHealthEntryRef]
	disable: [entry: ContentHealthEntryRef]
}>()

const { formatMessage } = useVIntl()
const modal = ref<InstanceType<typeof NewModal>>()
const hasProblems = computed(() => hasContentHealthProblems(props.report ?? null))

const messages = defineMessages({
	header: {
		id: 'app.content-health.header',
		defaultMessage: 'Content health check',
	},
	checking: {
		id: 'app.content-health.checking',
		defaultMessage: 'Checking installed content...',
	},
	allClearHeader: {
		id: 'app.content-health.all-clear-header',
		defaultMessage: 'No problems found',
	},
	allClearBody: {
		id: 'app.content-health.all-clear-body',
		defaultMessage:
			'Everything installed has the dependencies it asks for, and nothing installed conflicts with anything else.',
	},
	problemsHeader: {
		id: 'app.content-health.problems-header',
		defaultMessage: 'Problems found',
	},
	problemsBody: {
		id: 'app.content-health.problems-body',
		defaultMessage:
			'Content that is missing a dependency or that conflicts with other content can crash the game or silently fail to load. You can fix these from here.',
	},
	missingLabel: {
		id: 'app.content-health.missing-label',
		defaultMessage: 'Missing required dependencies',
	},
	conflictsLabel: {
		id: 'app.content-health.conflicts-label',
		defaultMessage: 'Conflicting content',
	},
	requiredBy: {
		id: 'app.content-health.required-by',
		defaultMessage: 'Required by {count, plural, one {# project} other {# projects}}',
	},
	requiredByList: {
		id: 'app.content-health.required-by-list',
		defaultMessage: 'Needed by {projects}',
	},
	conflictDeclaredBy: {
		id: 'app.content-health.conflict-declared-by',
		defaultMessage: 'Marked as incompatible by {project}',
	},
	installButton: {
		id: 'app.content-health.install-button',
		defaultMessage: 'Install',
	},
	enableButton: {
		id: 'app.content-health.enable-button',
		defaultMessage: 'Enable',
	},
	disabledBadge: {
		id: 'app.content-health.disabled-badge',
		defaultMessage: 'Installed but disabled',
	},
	removeButton: {
		id: 'app.content-health.remove-button',
		defaultMessage: 'Remove',
	},
	disableButton: {
		id: 'app.content-health.disable-button',
		defaultMessage: 'Disable',
	},
	checkAgainButton: {
		id: 'app.content-health.check-again-button',
		defaultMessage: 'Check again',
	},
	notOnModrinth: {
		id: 'app.content-health.not-on-modrinth',
		defaultMessage:
			'This dependency is not published on Modrinth, so it has to be installed manually.',
	},
	unfixableTooltip: {
		id: 'app.content-health.unfixable-tooltip',
		defaultMessage: 'This content is managed elsewhere and cannot be changed from here.',
	},
	notCheckedYet: {
		id: 'app.content-health.not-checked-yet',
		defaultMessage:
			'This instance has not been checked yet. Run a check to look for missing dependencies and conflicting content.',
	},
	checkedSummary: {
		id: 'app.content-health.checked-summary',
		defaultMessage:
			'Checked {count, plural, one {# project} other {# projects}}. {unchecked, plural, =0 {Nothing else needed checking.} one {# file has no Modrinth metadata and could not be checked.} other {# files have no Modrinth metadata and could not be checked.}}',
	},
	unknownLabel: {
		id: 'app.content-health.unknown-label',
		defaultMessage: 'Unknown project',
	},
})

function isFixable(entry: ContentHealthEntryRef) {
	return props.fixableIds.has(entry.id)
}

function canInstallDependency(dependency: ContentHealthReport['missingDependencies'][number]) {
	return dependency.installable && props.canInstall
}

/** Why a missing dependency cannot be installed from here */
const blockedInstallReason = computed(() =>
	props.canInstall
		? formatMessage(messages.notOnModrinth)
		: (props.unfixableTooltip ?? formatMessage(messages.unfixableTooltip)),
)

function entryProjectLink(entry: ContentHealthEntryRef) {
	return entry.project ? `/project/${entry.project.slug}` : undefined
}

function dependencyProjectLink(dependency: ContentHealthReport['missingDependencies'][number]) {
	return dependency.project ? `/project/${dependency.project.slug}` : undefined
}

function dependencyCardProject(dependency: ContentHealthReport['missingDependencies'][number]) {
	if (dependency.project) return dependency.project

	const id = dependency.projectId ?? dependency.key
	return {
		id,
		slug: id,
		title: dependency.fileName ?? formatMessage(messages.unknownLabel),
		icon_url: undefined,
	}
}

function conflictCardProject(conflict: ContentHealthConflict) {
	if (conflict.target.project) return conflict.target.project

	return {
		id: conflict.target.id,
		slug: conflict.target.projectId ?? conflict.target.id,
		title: contentHealthEntryLabel(conflict.target),
		icon_url: undefined,
	}
}

function show() {
	modal.value?.show()
}

function hide() {
	modal.value?.hide()
}

defineExpose({ show, hide })
</script>
