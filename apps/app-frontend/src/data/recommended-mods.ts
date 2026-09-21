export interface CuratedMod {
  projectId: string
  slug: string
  name: string
  reason: string
  category: 'performance' | 'utility' | 'aesthetic' | 'gameplay' | 'food' | 'tech' | 'adventure'
}

export interface ModCollection {
  id: string
  name: string
  description: string
  icon: string
  tags: string[]
  mods: CuratedMod[]
}

export const MOD_COLLECTIONS: ModCollection[] = [
  {
    id: 'performance',
    name: 'Performance Boost',
    description: 'Essential mods to make Minecraft run smoother',
    icon: '⚡',
    tags: ['performance', 'optimization', 'fps', 'lag', 'fast', 'smooth', 'speed'],
    mods: [
      { projectId: 'Aqutsundern', slug: 'sodium', name: 'Sodium', reason: 'Massive FPS improvements', category: 'performance' },
      { projectId: 'XXQNbNGD', slug: 'lithium', name: 'Lithium', reason: 'Game logic optimization', category: 'performance' },
      { projectId: 'RbhV4RXx', slug: 'starlight', name: 'Starlight', reason: 'Lighting engine rewrite', category: 'performance' },
      { projectId: '63PjxJYD', slug: 'phosphor', name: 'Phosphor', reason: 'Lighting engine optimization', category: 'performance' },
      { projectId: 'nZ56bGCM', slug: 'enhanced-block-entities', name: 'Enhanced Block Entities', reason: 'Better block entity rendering', category: 'performance' },
    ],
  },
  {
    id: 'quality-of-life',
    name: 'Quality of Life',
    description: 'Essential quality-of-life improvements',
    icon: '✨',
    tags: ['qol', 'quality', 'life', 'better', 'improve', 'convenience', 'helpful'],
    mods: [
      { projectId: 'ZVJjmLNC', slug: 'jei', name: 'Just Enough Items', reason: 'Essential recipe viewer', category: 'utility' },
      { projectId: 'fRnPWkHq', slug: 'journeymap', name: 'JourneyMap', reason: 'Minimap and world map', category: 'utility' },
      { projectId: '4FFJlwuh', slug: 'wthit', name: 'WTHIT', reason: "See what you're looking at", category: 'utility' },
      { projectId: 'YWIVKjBO', slug: 'inventory-profiles-next', name: 'Inventory Profiles Next', reason: 'Better inventory management', category: 'utility' },
      { projectId: 'mLx6JZEy', slug: 'shulkerboxtooltip', name: 'ShulkerBoxTooltip', reason: 'See shulker box contents', category: 'utility' },
    ],
  },
  {
    id: 'aesthetic',
    name: 'Visual Enhancement',
    description: 'Beautiful shaders, textures, and visual mods',
    icon: '🎨',
    tags: ['visual', 'shader', 'texture', 'beautiful', 'graphics', 'pretty', 'look', 'beauty'],
    mods: [
      { projectId: 'GhbdCmbp', slug: 'iris', name: 'Iris', reason: 'Shader loader', category: 'aesthetic' },
      { projectId: 'tFzvFUWJ', slug: 'lambdynamiclights', name: 'LambDynamicLights', reason: 'Dynamic lighting', category: 'aesthetic' },
      { projectId: 'uGMRVemM', slug: 'continuity', name: 'Continuity', reason: 'Connected textures', category: 'aesthetic' },
      { projectId: 'fb4VbbHb', slug: 'animatica', name: 'Animatica', reason: 'Animated textures', category: 'aesthetic' },
    ],
  },
  {
    id: 'tech',
    name: 'Tech & Automation',
    description: 'Technology, machines, and industrial mods',
    icon: '🔧',
    tags: ['tech', 'technology', 'machine', 'industrial', 'power', 'energy', 'factory', 'automation'],
    mods: [
      { projectId: 'vnEemHux', slug: 'create', name: 'Create', reason: 'Mechanical automation', category: 'tech' },
      { projectId: 'rOYIwqR1', slug: 'mekanism', name: 'Mekanism', reason: 'High-tech machinery', category: 'tech' },
      { projectId: 'O0E5XGkF', slug: 'thermalexpansion', name: 'Thermal Expansion', reason: 'Classic tech mod', category: 'tech' },
    ],
  },
  {
    id: 'adventure',
    name: 'Adventure Pack',
    description: 'Dungeons, structures, and exploration mods',
    icon: '⚔️',
    tags: ['adventure', 'dungeon', 'explore', 'quest', 'boss', 'rpg', 'fight', 'battle'],
    mods: [
      { projectId: 'kElPrzjC', slug: 'twilight-forest', name: 'Twilight Forest', reason: 'Classic adventure dimension', category: 'adventure' },
      { projectId: 'LVgyYmxh', slug: 'iceandfire', name: 'Ice and Fire', reason: 'Mythical creatures', category: 'adventure' },
      { projectId: 'QjizKR5L', slug: 'rogue-like-dungeons', name: 'Rogue-like Dungeons', reason: 'Procedural dungeons', category: 'adventure' },
    ],
  },
  {
    id: 'food',
    name: 'Food & Cooking',
    description: 'Farming, cooking, and food mods',
    icon: '🍳',
    tags: ['food', 'cooking', 'farm', 'garden', 'harvest', 'bakery', 'kitchen', 'eat'],
    mods: [
      { projectId: 'TOpbcBGw', slug: 'farmers-delight', name: "Farmer's Delight", reason: 'Cooking and farming expansion', category: 'food' },
      { projectId: 'yFJQAVXe', slug: 'pamhc', name: 'Pam\'s HarvestCraft', reason: 'Classic food mod', category: 'food' },
    ],
  },
  {
    id: 'skyblock',
    name: 'Skyblock Essentials',
    description: 'Essential mods for skyblock gameplay',
    icon: '🏝️',
    tags: ['skyblock', 'sky', 'island', 'void', 'floating', 'block'],
    mods: [
      { projectId: 'ZVJjmLNC', slug: 'jei', name: 'Just Enough Items', reason: 'Recipe viewer for skyblock', category: 'utility' },
      { projectId: 'YWIVKjBO', slug: 'inventory-profiles-next', name: 'Inventory Profiles Next', reason: 'Better inventory management', category: 'utility' },
    ],
  },
  {
    id: 'pixelmon',
    name: 'Pixelmon Pack',
    description: 'Pokemon-inspired mods and creatures',
    icon: '🎮',
    tags: ['pixelmon', 'pokemon', 'pokémon', 'creature', 'monster', 'catch'],
    mods: [
      // Will be populated with actual project IDs
    ],
  },
  {
    id: 'create',
    name: 'Create Modpack',
    description: 'Mechanical and automation mods',
    icon: '⚙️',
    tags: ['create', 'mechanical', 'automation', 'redstone', 'factory', 'gears'],
    mods: [
      { projectId: 'vnEemHux', slug: 'create', name: 'Create', reason: 'Revolutionary automation mod', category: 'tech' },
    ],
  },
]
