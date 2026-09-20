<script setup lang="ts">
import { CheckIcon, SearchIcon } from '@modrinth/assets'
import type { Component } from 'vue'
import { computed, ref, watch } from 'vue'

import Input from '#ui/components/base/inputs/Input.vue'
import { defineMessages, useVIntl } from '#ui/composables/i18n'
import { formatProjectTypeSentence } from '#ui/utils/common-messages'
import type { FilterOption, FilterValue } from '#ui/utils/search'

import { injectBrowseManager } from '../providers/browse-manager'

const MAX_SUGGESTIONS = 8
const CATEGORY_FILTER_TYPE = /^(server_)?category_/

interface CategorySuggestion {
	filterType: string
	optionId: string
	label: string
	icon: FilterOption['icon']
}

interface CategorySuggestionGroup {
	id: string
	label: string
	items: CategorySuggestion[]
}

const ctx = injectBrowseManager()
const { formatMessage } = useVIntl()

const messages = defineMessages({
	searchPlaceholder: {
		id: 'browse.search.placeholder',
		defaultMessage: 'Search {projectType}...',
	},
})

const focused = ref(false)
const highlighted = ref(0)

const placeholder = computed(() =>
	formatMessage(messages.searchPlaceholder, {
		projectType: formatProjectTypeSentence(formatMessage, ctx.projectType.value, 2),
	}),
)

const effectiveFilterTypes = computed(() =>
	ctx.isServerType.value ? ctx.serverFilterTypes.value : ctx.filters.value,
)

const effectiveSelectedFilters = computed(() =>
	ctx.isServerType.value ? ctx.serverCurrentFilters.value : ctx.currentFilters.value,
)

function visibleCategoryTypes() {
	const hidden = ctx.hiddenFilterTypes?.value ?? []
	return effectiveFilterTypes.value.filter(
		(filterType) =>
			CATEGORY_FILTER_TYPE.test(filterType.id) &&
			filterType.display !== 'none' &&
			!hidden.includes(filterType.id),
	)
}

function toSuggestion(filterType: string, option: FilterOption): CategorySuggestion {
	return {
		filterType,
		optionId: option.id,
		label: option.formatted_name ?? option.id,
		icon: option.icon,
	}
}

const categorySuggestions = computed<CategorySuggestionGroup[]>(() => {
	const query = ctx.query.value.trim().toLowerCase()
	if (!query) return []

	const groups: CategorySuggestionGroup[] = []
	let remaining = MAX_SUGGESTIONS

	for (const filterType of visibleCategoryTypes()) {
		const items: CategorySuggestion[] = []
		for (const option of filterType.options) {
			if (items.length >= remaining) break

			const suggestion = toSuggestion(filterType.id, option)
			if (!suggestion.label.toLowerCase().includes(query)) continue

			items.push(suggestion)
		}

		if (items.length === 0) continue

		remaining -= items.length
		groups.push({
			id: filterType.id,
			label: filterType.formatted_name,
			items,
		})

		if (remaining <= 0) break
	}

	return groups
})

const flatSuggestions = computed(() => categorySuggestions.value.flatMap((group) => group.items))

const suggestionsOpen = computed(() => focused.value && flatSuggestions.value.length > 0)

watch(flatSuggestions, () => {
	highlighted.value = 0
})

function isSelected(suggestion: CategorySuggestion) {
	return effectiveSelectedFilters.value.some(
		(filter) =>
			filter.type === suggestion.filterType &&
			filter.option === suggestion.optionId &&
			!filter.negative,
	)
}

function setSelectedFilters(filters: FilterValue[]) {
	if (ctx.isServerType.value) {
		ctx.serverCurrentFilters.value = filters
	} else {
		ctx.currentFilters.value = filters
	}
}

function toggleCategory(suggestion: CategorySuggestion) {
	const current = effectiveSelectedFilters.value

	if (isSelected(suggestion)) {
		setSelectedFilters(
			current.filter(
				(filter) =>
					!(filter.type === suggestion.filterType && filter.option === suggestion.optionId),
			),
		)
	} else {
		setSelectedFilters([...current, { type: suggestion.filterType, option: suggestion.optionId }])
	}

	ctx.query.value = ''
	highlighted.value = 0
	ctx.onFilterChange()
}

function handleKeydown(event: KeyboardEvent) {
	if (!suggestionsOpen.value) return

	const count = flatSuggestions.value.length

	if (event.key === 'ArrowDown') {
		event.preventDefault()
		highlighted.value = (highlighted.value + 1) % count
	} else if (event.key === 'ArrowUp') {
		event.preventDefault()
		highlighted.value = (highlighted.value - 1 + count) % count
	} else if (event.key === 'Enter') {
		event.preventDefault()
		toggleCategory(flatSuggestions.value[highlighted.value])
	} else if (event.key === 'Escape') {
		focused.value = false
	}
}

function suggestionIndex(suggestion: CategorySuggestion) {
	return flatSuggestions.value.indexOf(suggestion)
}

function isHighlighted(suggestion: CategorySuggestion) {
	return suggestionIndex(suggestion) === highlighted.value
}

function isStringIcon(icon: Component | string): icon is string {
	return typeof icon === 'string'
}
</script>

<template>
	<div class="relative">
		<Input
			v-model="ctx.query.value"
			:icon="SearchIcon"
			type="text"
			autocomplete="off"
			:placeholder="placeholder"
			clearable
			wrapper-class="w-full"
			size="large"
			:input-attrs="{
				role: 'combobox',
				'aria-expanded': suggestionsOpen,
				'aria-autocomplete': 'list',
			}"
			@clear="ctx.clearSearch()"
			@focus="focused = true"
			@blur="focused = false"
			@keydown="handleKeydown"
		/>

		<div
			v-if="suggestionsOpen"
			role="listbox"
			class="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 flex flex-col gap-1 rounded-2xl border border-solid border-surface-5 bg-surface-3 p-2 shadow-xl"
		>
			<template v-for="group in categorySuggestions" :key="group.id">
				<div class="px-2 pt-1 pb-0.5 text-sm font-semibold text-secondary">
					{{ group.label }}
				</div>
				<button
					v-for="suggestion in group.items"
					:key="`${suggestion.filterType}:${suggestion.optionId}`"
					role="option"
					type="button"
					:aria-selected="isSelected(suggestion)"
					class="flex w-full cursor-pointer items-center gap-2 truncate rounded-xl border-none bg-transparent px-2 py-1.5 text-left text-sm font-semibold text-secondary transition-colors hover:bg-surface-4 hover:text-contrast focus-visible:bg-surface-4 focus-visible:text-contrast"
					:class="isHighlighted(suggestion) ? 'bg-surface-4 text-contrast' : ''"
					@mousedown.prevent
					@click="toggleCategory(suggestion)"
				>
					<template v-if="suggestion.icon">
						<div
							v-if="isStringIcon(suggestion.icon)"
							class="h-4 w-4 shrink-0"
							v-html="suggestion.icon"
						/>
						<component :is="suggestion.icon" v-else class="h-4 w-4 shrink-0" />
					</template>
					<span class="truncate">{{ suggestion.label }}</span>
					<CheckIcon
						v-if="isSelected(suggestion)"
						class="ml-auto h-4 w-4 shrink-0 text-brand"
						aria-hidden="true"
					/>
				</button>
			</template>
		</div>
	</div>
</template>
