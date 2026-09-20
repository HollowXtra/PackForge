<template>
	<div class="inline-flex select-none items-center gap-[0.42em] leading-none">
		<svg class="size-[1.12em] shrink-0 text-brand" viewBox="0 0 64 64" aria-hidden="true">
			<g fill="currentColor">
				<path d="M6 14h34l14 4-14 4H6z" />
				<path d="M23 22h12l-3 18h-6z" />
				<path d="M14 40h30l4 10H10z" />
				<path d="M50 3l1.9 4.1L56 9l-4.1 1.9L50 15l-1.9-4.1L44 9l4.1-1.9z" />
			</g>
		</svg>
		<span v-if="wordmark" class="font-bold whitespace-nowrap tracking-[-0.02em]">PackForge</span>
	</div>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		wordmark?: boolean
	}>(),
	{
		wordmark: true,
	},
)
</script>
