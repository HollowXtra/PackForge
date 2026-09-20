/**
 * All theseus API calls return serialized values (both return values and errors);
 * So, for example, addDefaultInstance creates a blank instance object, where the Rust struct is serialized,
 *  and deserialized into a usable JS object.
 */
import { type Channel, invoke } from '@tauri-apps/api/core'

import type { AppEvent } from '@/generated/app-events/AppEvent'

export interface LoadingBarType {
	type?: string
	version?: string
	instance_id?: string
	instance_name?: string
	pack_name?: string
	icon?: string | null
}

export interface LoadingBar {
	id?: string | number
	loading_bar_uuid?: string | number
	title?: string
	message?: string
	current?: number
	total?: number
	bar_type?: LoadingBarType
}

export type OpeningCommand = Extract<AppEvent, { type: 'command' }>['payload']

export interface ModrinthAppImportInfo {
	/** Directory the data was imported from */
	source: string
	/** Instances found after importing */
	instances: number
	/** Minecraft accounts found after importing */
	minecraft_accounts: number
	/** Modrinth accounts found after importing */
	modrinth_accounts: number
	/** Game directory now shared with Modrinth App, if any */
	data_dir: string | null
	/** Unix timestamp of the import */
	imported_at: number
	/** Whether the import has been reported to the user yet */
	acknowledged: boolean
}

// Initialize the theseus API state
// This should be called during the initializion/opening of the launcher
export async function initialize_state(events: Channel<ArrayBuffer>) {
	return await invoke<void>('initialize_state', { events })
}

// Get the import of an existing Modrinth App installation, if one happened
// when the app was started for the first time
export async function getModrinthAppImport() {
	return await invoke<ModrinthAppImportInfo | null>('plugin:settings|modrinth_app_import')
}

// Stop reporting the imported Modrinth App data in the UI
export async function acknowledgeModrinthAppImport() {
	return await invoke<void>('plugin:settings|acknowledge_modrinth_app_import')
}

// Gets active progress bars
export async function progress_bars_list() {
	return await invoke<Record<string, LoadingBar>>('plugin:utils|progress_bars_list')
}

// Get opening command
// For example, if a user clicks on an .mrpack to open the app.
// This should be called once and only when the app is done booting up and ready to receive a command
// Returns a Command struct- see events.js
export async function get_opening_command() {
	return await invoke<OpeningCommand | null>('plugin:utils|get_opening_command')
}
