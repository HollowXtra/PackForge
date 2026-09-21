import { invoke } from '@tauri-apps/api/core'

export interface CurseForgeSearchParams {
  query?: string
  game_version?: string
  mod_loader_type?: number
  category_id?: number
  sort_field?: number
  sort_order?: number
  page_size?: number
  index?: number
}

export interface CurseForgePagination {
  index: number
  page_size: number
  result_count: number
  total_count: number
}

export interface CurseForgeModAsset {
  title: string
  url: string
}

export interface CurseForgeCategory {
  id: number
  name: string
  slug: string
}

export interface CurseForgeFile {
  id: number
  display_name: string
  file_name: string
  download_url: string | null
  file_length: number
  game_versions: string[]
}

export interface CurseForgeMod {
  id: number
  name: string
  slug: string
  summary: string
  download_count: number
  logo: CurseForgeModAsset | null
  categories: CurseForgeCategory[]
  latest_files: CurseForgeFile[]
}

export interface CurseForgeSearchResult {
  data: CurseForgeMod[]
  pagination: CurseForgePagination
}

// CurseForge API Key Management

/**
 * Get the stored CurseForge API key
 */
export async function curseforge_get_api_key(): Promise<string | null> {
  return await invoke('plugin:curseforge|curseforge_get_api_key')
}

/**
 * Store the CurseForge API key
 */
export async function curseforge_set_api_key(apiKey: string | null): Promise<void> {
  return await invoke('plugin:curseforge|curseforge_set_api_key', { apiKey })
}

/**
 * Check if CurseForge integration is enabled
 */
export async function curseforge_is_enabled(): Promise<boolean> {
  return await invoke('plugin:curseforge|curseforge_is_enabled')
}

// CurseForge mod loader type IDs
export const CURSEFORGE_LOADER_TYPES = {
  FORGE: 1,
  FABRIC: 4,
  QUILT: 5,
  NEOFORGE: 6,
} as const

// CurseForge sort field IDs
export const CURSEFORGE_SORT_FIELDS = {
  POPULARITY: 2,
  LAST_UPDATED: 3,
  NAME: 1,
  DOWNLOADS: 4,
  RATING: 5,
} as const

/**
 * Search for mods on CurseForge
 */
export async function curseforge_search_mods(
  apiKey: string,
  params: CurseForgeSearchParams,
): Promise<CurseForgeSearchResult> {
  return await invoke('plugin:curseforge|curseforge_search_mods', {
    apiKey,
    params,
  })
}

/**
 * Get a specific mod from CurseForge
 */
export async function curseforge_get_mod(
  apiKey: string,
  modId: number,
): Promise<CurseForgeMod> {
  return await invoke('plugin:curseforge|curseforge_get_mod', {
    apiKey,
    modId,
  })
}

/**
 * Get files for a CurseForge mod
 */
export async function curseforge_get_mod_files(
  apiKey: string,
  modId: number,
  gameVersion?: string,
  modLoaderType?: number,
): Promise<CurseForgeFile[]> {
  return await invoke('plugin:curseforge|curseforge_get_mod_files', {
    apiKey,
    modId,
    gameVersion,
    modLoaderType,
  })
}

/**
 * Get download URL for a CurseForge file
 */
export async function curseforge_get_file_download_url(
  apiKey: string,
  modId: number,
  fileId: number,
): Promise<string> {
  return await invoke('plugin:curseforge|curseforge_get_file_download_url', {
    apiKey,
    modId,
    fileId,
  })
}
