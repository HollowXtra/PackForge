use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::api::data::Settings;

const BASE_URL: &str = "https://api.curseforge.com";
const MINECRAFT_GAME_ID: u32 = 432;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseForgePagination {
    pub index: u32,
    pub page_size: u32,
    pub result_count: u32,
    pub total_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseForgeSearchResult {
    pub data: Vec<CurseForgeMod>,
    pub pagination: CurseForgePagination,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseForgeMod {
    pub id: u32,
    pub name: String,
    pub slug: String,
    pub summary: String,
    pub download_count: u64,
    pub logo: Option<CurseForgeModAsset>,
    pub categories: Vec<CurseForgeCategory>,
    pub latest_files: Vec<CurseForgeFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseForgeModAsset {
    pub title: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseForgeCategory {
    pub id: u32,
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurseForgeFile {
    pub id: u32,
    pub display_name: String,
    pub file_name: String,
    pub download_url: Option<String>,
    pub file_length: u64,
    pub game_versions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

pub async fn search_mods(
    api_key: &str,
    params: &CurseForgeSearchParams,
) -> crate::Result<CurseForgeSearchResult> {
    let client = Client::new();

    let mut url = format!("{}/v1/mods/search", BASE_URL);
    url.push_str(&format!("?gameId={}", MINECRAFT_GAME_ID));

    if let Some(ref query) = params.query {
        url.push_str(&format!("&searchFilter={}", urlencoding::encode(query)));
    }

    if let Some(ref gv) = params.game_version {
        url.push_str(&format!("&gameVersion={}", urlencoding::encode(gv)));
    }

    if let Some(lt) = params.mod_loader_type {
        url.push_str(&format!("&modLoaderType={}", lt));
    }

    if let Some(cid) = params.category_id {
        url.push_str(&format!("&classId={}", cid));
    }

    if let Some(sf) = params.sort_field {
        url.push_str(&format!("&sortField={}", sf));
    }

    if let Some(so) = params.sort_order {
        url.push_str(&format!("&sortOrder={}", so));
    }

    if let Some(ps) = params.page_size {
        url.push_str(&format!("&pageSize={}", ps));
    }

    if let Some(idx) = params.index {
        url.push_str(&format!("&index={}", idx));
    }

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .header("x-api-key", api_key)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(crate::ErrorKind::NetworkError(format!(
            "CurseForge API error: {}",
            response.status()
        ))
        .into());
    }

    let result: CurseForgeSearchResult = response.json().await?;
    Ok(result)
}

pub async fn get_mod(
    api_key: &str,
    mod_id: u32,
) -> crate::Result<CurseForgeMod> {
    let client = Client::new();
    let url = format!("{}/v1/mods/{}", BASE_URL, mod_id);

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .header("x-api-key", api_key)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(crate::ErrorKind::NetworkError(format!(
            "CurseForge API error: {}",
            response.status()
        ))
        .into());
    }

    #[derive(Deserialize)]
    struct ModResponse {
        data: CurseForgeMod,
    }

    let result: ModResponse = response.json().await?;
    Ok(result.data)
}

pub async fn get_mod_files(
    api_key: &str,
    mod_id: u32,
    game_version: Option<&str>,
    mod_loader_type: Option<u32>,
) -> crate::Result<Vec<CurseForgeFile>> {
    let client = Client::new();
    let mut url = format!("{}/v1/mods/{}/files", BASE_URL, mod_id);
    url.push_str(&format!("?gameId={}", MINECRAFT_GAME_ID));

    if let Some(gv) = game_version {
        url.push_str(&format!("&gameVersion={}", urlencoding::encode(gv)));
    }

    if let Some(lt) = mod_loader_type {
        url.push_str(&format!("&modLoaderType={}", lt));
    }

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .header("x-api-key", api_key)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(crate::ErrorKind::NetworkError(format!(
            "CurseForge API error: {}",
            response.status()
        ))
        .into());
    }

    #[derive(Deserialize)]
    struct FilesResponse {
        data: Vec<CurseForgeFile>,
    }

    let result: FilesResponse = response.json().await?;
    Ok(result.data)
}

pub async fn get_file_download_url(
    api_key: &str,
    mod_id: u32,
    file_id: u32,
) -> crate::Result<String> {
    let client = Client::new();
    let url = format!(
        "{}/v1/mods/{}/files/{}/download-url",
        BASE_URL, mod_id, file_id
    );

    let response = client
        .get(&url)
        .header("Accept", "application/json")
        .header("x-api-key", api_key)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(crate::ErrorKind::NetworkError(format!(
            "CurseForge API error: {}",
            response.status()
        ))
        .into());
    }

    #[derive(Deserialize)]
    struct DownloadUrlResponse {
        data: String,
    }

    let result: DownloadUrlResponse = response.json().await?;
    Ok(result.data)
}
