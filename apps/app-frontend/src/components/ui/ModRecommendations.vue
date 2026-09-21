<script setup lang="ts">
import { computed } from 'vue'
import { getInstanceRecommendations, type ModCollection } from '@/helpers/recommendations'

const props = defineProps<{
  instanceName: string
  loader?: string
  gameVersion?: string
}>()

const emit = defineEmits<{
  select: [collection: ModCollection]
}>()

const recommendations = computed(() => getInstanceRecommendations(props.instanceName))
</script>

<template>
  <div v-if="recommendations.length > 0" class="mod-recommendations">
    <h3 class="recommendations-title">
      Recommended for "{{ instanceName || 'your instance' }}"
    </h3>
    <div class="recommendations-grid">
      <div
        v-for="collection in recommendations"
        :key="collection.id"
        class="recommendation-card"
        @click="emit('select', collection)"
      >
        <span class="collection-icon">{{ collection.icon }}</span>
        <div class="collection-info">
          <h4 class="collection-name">{{ collection.name }}</h4>
          <p class="collection-description">{{ collection.description }}</p>
          <span class="mod-count">{{ collection.mods.length }} mods</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mod-recommendations {
  padding: 1rem;
  border-top: 1px solid var(--color-border);
}

.recommendations-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 0.75rem;
}

.recommendations-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}

.recommendation-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-bg-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.recommendation-card:hover {
  border-color: var(--color-brand);
  background: var(--color-bg-tertiary);
}

.collection-icon {
  font-size: 1.5rem;
}

.collection-info {
  flex: 1;
}

.collection-name {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.25rem 0;
}

.collection-description {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  margin: 0 0 0.5rem 0;
}

.mod-count {
  font-size: 0.75rem;
  color: var(--color-brand);
  font-weight: 500;
}
</style>
