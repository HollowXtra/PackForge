use tauri::{plugin::Builder, Runtime, TauriPlugin};

use crate::api::Result;

pub fn init<R: Runtime>() -> TauriPlugin<R> {
    Builder::new("curseforge")
        .invoke_handler(tauri::generate_handler![
            curseforge_search_mods,
            curseforge_get_mod,
            curseforge_get_mod_files,
            curseforge_get_file_download_url,
            curseforge_get_api_key,
            curseforge_set_api_key,
            curseforge_is_enabled,
        ])
        .build()
}

#[derive(serde::Deserialize)]
pub struct CurseForgeSearchParams {
    pub query: Option<String>,
    pub game_version: Option<String>,
    pub mod_loader_type: Option<u32>,
    pub category_id: Option<u32>,
    pub sort_field: Option<u32>,
    pub sort_order: Option<u32>,
    pub page_size: Option<u32>,
    pub index: Option<u32>,
}

#[tauri::command]
pub async fn curseforge_search_mods(
    api_key: String,
    params: CurseForgeSearchParams,
) -> Result<theseus::prelude::curseforge::CurseForgeSearchResult> {
    Ok(theseus::prelude::curseforge::search_mods(&api_key, &params).await?)
}

#[tauri::command]
pub async fn curseforge_get_mod(
    api_key: String,
    mod_id: u32,
) -> Result<theseus::prelude::curseforge::CurseForgeMod> {
    Ok(theseus::prelude::curseforge::get_mod(&api_key, mod_id).await?)
}

#[tauri::command]
pub async fn curseforge_get_mod_files(
    api_key: String,
    mod_id: u32,
    game_version: Option<String>,
    mod_loader_type: Option<u32>,
) -> Result<Vec<theseus::prelude::curseforge::CurseForgeFile>> {
    Ok(theseus::prelude::curseforge::get_mod_files(
        &api_key,
        mod_id,
        game_version.as_deref(),
        mod_loader_type,
    )
    .await?)
}

#[tauri::command]
pub async fn curseforge_get_file_download_url(
    api_key: String,
    mod_id: u32,
    file_id: u32,
) -> Result<String> {
    Ok(theseus::prelude::curseforge::get_file_download_url(
        &api_key, mod_id, file_id,
    )
    .await?)
}

#[tauri::command]
pub async fn curseforge_get_api_key() -> Result<Option<String>> {
    Ok(theseus::prelude::curseforge_settings::CurseForgeConfig::get_api_key().await?)
}

#[tauri::command]
pub async fn curseforge_set_api_key(api_key: Option<String>) -> Result<()> {
    Ok(theseus::prelude::curseforge_settings::CurseForgeConfig::set_api_key(api_key).await?)
}

#[tauri::command]
pub async fn curseforge_is_enabled() -> Result<bool> {
    Ok(theseus::prelude::curseforge_settings::CurseForgeConfig::is_enabled().await)
}
