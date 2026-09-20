//! First-run import of an existing Modrinth App installation.
//!
//! PackForge uses a different app identifier than Modrinth App, so the two look
//! for their app database in different directories. A fresh PackForge install
//! would therefore start with no instances, accounts or settings, even when
//! Modrinth App is already set up on the same machine.
//!
//! When PackForge starts for the first time it takes a snapshot of the Modrinth
//! App database into its own app directory, and points itself at Modrinth App's
//! game directory when that installation used the default one. Instances,
//! accounts and settings carry over without re-downloading or copying anything,
//! and the Modrinth App installation itself is never modified. An import only
//! happens while PackForge has no instances or accounts of its own.
use super::db::MIGRATOR;
use super::{DirectoryInfo, Settings};
use serde::{Deserialize, Serialize};
use sqlx::sqlite::{SqliteConnectOptions, SqliteConnection};
use sqlx::{ConnectOptions, SqlitePool};
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::fs;

/// App identifier of the official Modrinth App, which stores its app database
/// in a directory named after it.
pub const MODRINTH_APP_IDENTIFIER: &str = "com.modrinth.ModrinthApp";

/// Directories that hold the user's game files, used to decide whether an
/// imported installation has anything to point PackForge at.
const GAME_DATA_DIRECTORIES: [&str; 3] = ["profiles", "meta", "store"];

/// Key the import is remembered under in the `app_metadata` table.
const IMPORT_KEY: &str = "modrinth_app_import";

/// An import of an existing Modrinth App installation, as reported to the UI.
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ModrinthAppImport {
    /// Directory the data was imported from
    pub source: String,
    /// Instances found after importing
    pub instances: u64,
    /// Minecraft accounts found after importing
    pub minecraft_accounts: u64,
    /// Modrinth accounts found after importing
    pub modrinth_accounts: u64,
    /// Game directory now shared with Modrinth App, if any
    pub data_dir: Option<String>,
    /// Unix timestamp of the import
    pub imported_at: i64,
    /// Whether the import has been reported to the user yet
    pub acknowledged: bool,
}

/// Imports an existing Modrinth App installation if there is one and this
/// installation has no data of its own yet.
///
/// Returns the directory the data was imported from, or `None` when there was
/// nothing to import.
#[tracing::instrument]
pub async fn import_from_modrinth_app(
    app_identifier: &str,
) -> crate::Result<Option<PathBuf>> {
    let Some(source_dir) = existing_modrinth_app_dir(app_identifier) else {
        tracing::debug!(
            "No existing Modrinth App installation to import from"
        );
        return Ok(None);
    };
    let Some(settings_dir) =
        DirectoryInfo::initial_settings_dir_path(app_identifier)
    else {
        return Ok(None);
    };

    let target = settings_dir.join("app.db");
    if !is_fresh_install(&target).await {
        tracing::debug!(
            "Skipping the Modrinth App import because this installation already has data"
        );
        return Ok(None);
    }

    let source_db = source_dir.join("app.db");
    let Some(mut source) = open_import_source(&source_db).await else {
        return Ok(None);
    };

    crate::util::io::create_dir_all(&settings_dir).await?;
    remove_database(&target).await?;
    if let Err(error) = snapshot_database(&mut source, &target).await {
        // Without the snapshot PackForge starts empty instead of failing to
        // start; the Modrinth App installation still holds the original data.
        tracing::error!(
            "Failed to import the Modrinth App app database from {}: {error}",
            source_db.display()
        );
        remove_database(&target).await?;
        return Ok(None);
    }

    tracing::info!(
        "Imported the app database of the existing Modrinth App installation at {}",
        source_db.display()
    );

    Ok(Some(source_dir))
}

/// Opens the Modrinth App database if it can be used as an import source.
async fn open_import_source(source_db: &Path) -> Option<SqliteConnection> {
    let mut source = match open_read_only_db(source_db).await {
        Ok(source) => source,
        Err(error) => {
            tracing::warn!(
                "Skipping the Modrinth App import because {} could not be read: {error}",
                source_db.display()
            );
            return None;
        }
    };

    match migrations_are_known(&mut source).await {
        Ok(true) => Some(source),
        Ok(false) => {
            tracing::warn!(
                "Skipping the Modrinth App import because {} was written by a newer version of Modrinth App",
                source_db.display()
            );
            None
        }
        Err(error) => {
            tracing::warn!(
                "Skipping the Modrinth App import because {} could not be inspected: {error}",
                source_db.display()
            );
            None
        }
    }
}

/// Points PackForge at the imported installation's game directory when that
/// installation used the default one.
///
/// The instances, metadata, caches and the shared content store stay where they
/// are and are used in place, so nothing has to be copied or re-downloaded.
pub async fn adopt_game_directory(
    settings: &mut Settings,
    source: &Path,
) -> crate::Result<bool> {
    if settings.custom_dir.is_some() || settings.prev_custom_dir.is_some() {
        return Ok(false);
    }

    let mut has_game_data = false;
    for directory in GAME_DATA_DIRECTORIES {
        if fs::try_exists(source.join(directory)).await? {
            has_game_data = true;
            break;
        }
    }
    if !has_game_data {
        return Ok(false);
    }

    let source = source.to_string_lossy().into_owned();
    settings.custom_dir = Some(source.clone());
    settings.prev_custom_dir = Some(source);

    Ok(true)
}

/// Records the import so the UI can tell the user where their instances,
/// accounts and settings came from.
pub async fn record_import(
    source: &Path,
    data_dir: Option<&Path>,
    pool: &SqlitePool,
) -> crate::Result<()> {
    let record = ModrinthAppImport {
        source: source.to_string_lossy().into_owned(),
        instances: count_rows(pool, "instances").await? as u64,
        minecraft_accounts: count_rows(pool, "minecraft_users").await? as u64,
        modrinth_accounts: count_rows(pool, "modrinth_users").await? as u64,
        data_dir: data_dir.map(|dir| dir.to_string_lossy().into_owned()),
        imported_at: chrono::Utc::now().timestamp(),
        acknowledged: false,
    };

    tracing::info!(
        instances = record.instances,
        accounts = record.minecraft_accounts + record.modrinth_accounts,
        "Imported instances, accounts and settings from Modrinth App"
    );

    save(pool, &record).await
}

/// The last import of a Modrinth App installation, if one happened.
pub async fn get(
    pool: &SqlitePool,
) -> crate::Result<Option<ModrinthAppImport>> {
    let stored = sqlx::query_scalar::<_, String>(
        "SELECT value FROM app_metadata WHERE key = ?",
    )
    .bind(IMPORT_KEY)
    .fetch_optional(pool)
    .await?;

    match stored {
        Some(value) => match serde_json::from_str(&value) {
            Ok(record) => Ok(Some(record)),
            Err(error) => {
                tracing::warn!("Ignoring unreadable Modrinth App import record: {error}");
                Ok(None)
            }
        },
        None => Ok(None),
    }
}

/// Marks the import as reported so it is only shown to the user once.
pub async fn acknowledge(pool: &SqlitePool) -> crate::Result<()> {
    let Some(mut record) = get(pool).await? else {
        return Ok(());
    };
    if record.acknowledged {
        return Ok(());
    }

    record.acknowledged = true;
    save(pool, &record).await
}

/// Removes an imported app database so PackForge can start without it.
///
/// Only used when the imported database cannot be opened: the Modrinth App
/// installation it was copied from still holds the original data.
pub async fn discard_imported_database(
    app_identifier: &str,
) -> crate::Result<()> {
    let Some(settings_dir) =
        DirectoryInfo::initial_settings_dir_path(app_identifier)
    else {
        return Ok(());
    };

    remove_database(&settings_dir.join("app.db")).await
}

/// The Modrinth App directory to import from, if that installation exists and
/// is not the directory PackForge itself uses.
fn existing_modrinth_app_dir(app_identifier: &str) -> Option<PathBuf> {
    let source = dirs::data_dir()?.join(MODRINTH_APP_IDENTIFIER);
    let target = DirectoryInfo::initial_settings_dir_path(app_identifier)?;

    // `THESEUS_CONFIG_DIR` points both apps at the same directory, in which
    // case there is nothing to import and the database is already in use.
    if normalize_directory(&source) == normalize_directory(&target) {
        return None;
    }

    source.join("app.db").is_file().then_some(source)
}

/// Whether this installation has nothing of its own yet.
///
/// A missing database always counts as fresh; an existing one only counts while
/// it holds no instances, no accounts and no previous import, so an import can
/// never overwrite what the user has in PackForge. Anything that cannot be read
/// counts as used, because the import is only a convenience.
async fn is_fresh_install(db_path: &Path) -> bool {
    match inspect_fresh_install(db_path).await {
        Ok(fresh) => fresh,
        Err(error) => {
            tracing::warn!(
                "Assuming {} already has data because it could not be read: {error}",
                db_path.display()
            );
            false
        }
    }
}

async fn inspect_fresh_install(db_path: &Path) -> crate::Result<bool> {
    if !fs::try_exists(db_path).await? {
        return Ok(true);
    }

    let mut conn = open_read_only_db(db_path).await?;
    if has_metadata(&mut conn, IMPORT_KEY).await? {
        return Ok(false);
    }

    let instances = count_connection_rows(&mut conn, "instances").await?;
    let accounts = count_connection_rows(&mut conn, "minecraft_users").await?
        + count_connection_rows(&mut conn, "modrinth_users").await?;

    Ok(instances == 0 && accounts == 0)
}

/// Whether `key` has been written to the `app_metadata` table of `conn`.
async fn has_metadata(
    conn: &mut SqliteConnection,
    key: &str,
) -> crate::Result<bool> {
    let has_metadata_table = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'app_metadata'",
    )
    .fetch_one(&mut *conn)
    .await?;
    if has_metadata_table == 0 {
        return Ok(false);
    }

    let count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM app_metadata WHERE key = ?",
    )
    .bind(key)
    .fetch_one(&mut *conn)
    .await?;

    Ok(count > 0)
}

/// Whether every migration applied to `conn` exists in this build.
///
/// A Modrinth App installation can be newer than the PackForge build in use,
/// and running our migrations against such a database would fail, so that case
/// is left alone instead.
async fn migrations_are_known(
    conn: &mut SqliteConnection,
) -> crate::Result<bool> {
    let has_migrations_table = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = '_sqlx_migrations'",
    )
    .fetch_one(&mut *conn)
    .await?;
    if has_migrations_table == 0 {
        return Ok(true);
    }

    let applied =
        sqlx::query_scalar::<_, i64>("SELECT version FROM _sqlx_migrations")
            .fetch_all(&mut *conn)
            .await?;

    Ok(applied
        .into_iter()
        .all(|version| MIGRATOR.version_exists(version)))
}

async fn open_read_only_db(db_path: &Path) -> crate::Result<SqliteConnection> {
    let conn_options = SqliteConnectOptions::new()
        .filename(db_path)
        .busy_timeout(Duration::from_secs(30))
        .read_only(true)
        .create_if_missing(false);

    Ok(conn_options.connect().await?)
}

/// Copies the source database into `target`.
///
/// `VACUUM INTO` writes a consistent snapshot of the database, so this is safe
/// even while Modrinth App is running.
async fn snapshot_database(
    source: &mut SqliteConnection,
    target: &Path,
) -> crate::Result<()> {
    let target = target
        .to_str()
        .ok_or_else(|| crate::ErrorKind::UTFError(target.to_path_buf()))?;

    sqlx::query("VACUUM INTO ?")
        .bind(target)
        .execute(&mut *source)
        .await?;

    Ok(())
}

async fn remove_database(db_path: &Path) -> crate::Result<()> {
    for path in database_files(db_path) {
        match fs::remove_file(&path).await {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }

    Ok(())
}

/// The database file together with its write-ahead log and shared memory files.
fn database_files(db_path: &Path) -> [PathBuf; 3] {
    let name = db_path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_default();
    let parent = db_path.parent().unwrap_or_else(|| Path::new("."));

    ["", "-wal", "-shm"].map(|suffix| parent.join(format!("{name}{suffix}")))
}

async fn count_rows(pool: &SqlitePool, table: &str) -> crate::Result<i64> {
    let mut conn = pool.acquire().await?;

    count_connection_rows(&mut conn, table).await
}

async fn count_connection_rows(
    conn: &mut SqliteConnection,
    table: &str,
) -> crate::Result<i64> {
    let table_exists = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
    )
    .bind(table)
    .fetch_one(&mut *conn)
    .await?;
    if table_exists == 0 {
        return Ok(0);
    }

    let count =
        sqlx::query_scalar::<_, i64>(&format!("SELECT COUNT(*) FROM {table}"))
            .fetch_one(&mut *conn)
            .await?;

    Ok(count)
}

async fn save(
    pool: &SqlitePool,
    record: &ModrinthAppImport,
) -> crate::Result<()> {
    let value = serde_json::to_string(record)?;

    sqlx::query(
        "
        INSERT INTO app_metadata (key, value, updated_at)
        VALUES (?, ?, unixepoch())
        ON CONFLICT(key) DO UPDATE SET
            value = excluded.value,
            updated_at = excluded.updated_at
        ",
    )
    .bind(IMPORT_KEY)
    .bind(value)
    .execute(pool)
    .await?;

    Ok(())
}

/// Comparable form of a directory path, so the same directory spelled two ways
/// (relative, symlinked or with different casing) still matches.
fn normalize_directory(path: &Path) -> String {
    let path =
        std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let path = dunce::simplified(&path).to_string_lossy().replace('\\', "/");
    let path = path.trim_end_matches('/').to_string();

    #[cfg(windows)]
    let path = path.to_lowercase();

    path
}
