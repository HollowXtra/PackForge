use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct CurseForgeConfig {
    pub api_key: Option<String>,
    pub enabled: bool,
}

impl CurseForgeConfig {
    fn config_path() -> crate::Result<PathBuf> {
        let state = crate::State::get().ok_or_else(|| {
            crate::ErrorKind::OtherError("State not initialized".to_string())
        })?;
        Ok(state.directories.config_dir().join("curseforge.json"))
    }

    pub async fn get() -> crate::Result<Self> {
        let path = Self::config_path()?;
        if !path.exists() {
            return Ok(Self::default());
        }
        let content = tokio::fs::read_to_string(&path).await?;
        let config: Self = serde_json::from_str(&content)?;
        Ok(config)
    }

    pub async fn set(&self) -> crate::Result<()> {
        let path = Self::config_path()?;
        let content = serde_json::to_string_pretty(self)?;
        tokio::fs::write(&path, content).await?;
        Ok(())
    }

    pub async fn set_api_key(api_key: Option<String>) -> crate::Result<()> {
        let mut config = Self::get().await?;
        config.api_key = api_key;
        config.enabled = config.api_key.is_some();
        config.set().await
    }

    pub async fn get_api_key() -> crate::Result<Option<String>> {
        let config = Self::get().await?;
        Ok(config.api_key)
    }

    pub async fn is_enabled() -> bool {
        Self::get().await.map(|c| c.enabled).unwrap_or(false)
    }
}
