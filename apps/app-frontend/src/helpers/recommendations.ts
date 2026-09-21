import { MOD_COLLECTIONS, type ModCollection } from '@/data/recommended-mods'

/**
 * Match instance name to recommended mod collections
 */
export function getInstanceRecommendations(instanceName: string): ModCollection[] {
  const normalizedName = instanceName.toLowerCase().trim()

  if (!normalizedName) {
    return getDefaultRecommendations()
  }

  return MOD_COLLECTIONS
    .map((collection) => ({
      collection,
      score: calculateMatchScore(normalizedName, collection),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ collection }) => collection)
}

function calculateMatchScore(name: string, collection: ModCollection): number {
  let score = 0

  for (const tag of collection.tags) {
    // Exact tag match
    if (name === tag) {
      score += 20
    }
    // Tag is contained in name
    if (name.includes(tag)) {
      score += 10
    }
    // Partial match (first 4 chars)
    if (tag.length >= 4 && name.includes(tag.slice(0, 4))) {
      score += 5
    }
    // Name is contained in tag
    if (tag.includes(name) && name.length >= 3) {
      score += 8
    }
  }

  // Exact collection ID match
  if (name.includes(collection.id)) {
    score += 25
  }

  return score
}

/**
 * Get default recommendations when no name is provided
 */
function getDefaultRecommendations(): ModCollection[] {
  return MOD_COLLECTIONS.filter((c) =>
    ['quality-of-life', 'performance', 'aesthetic'].includes(c.id),
  )
}

/**
 * Get all available mod collections
 */
export function getAllModCollections(): ModCollection[] {
  return MOD_COLLECTIONS
}

/**
 * Get a specific mod collection by ID
 */
export function getModCollectionById(id: string): ModCollection | undefined {
  return MOD_COLLECTIONS.find((c) => c.id === id)
}
