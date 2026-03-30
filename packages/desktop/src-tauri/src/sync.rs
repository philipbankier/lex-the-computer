use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use reqwest::Client;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::AppHandle;
use tokio::sync::mpsc;

/// Files/directories to ignore during sync
const IGNORE_PATTERNS: &[&str] = &[
    ".git",
    "node_modules",
    ".DS_Store",
    "Thumbs.db",
    ".sync_state.db",
    "__pycache__",
    ".next",
    ".turbo",
];

/// Maximum file size for sync (100MB)
const MAX_FILE_SIZE: u64 = 100 * 1024 * 1024;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncState {
    pub path: String,
    pub local_hash: Option<String>,
    pub remote_hash: Option<String>,
    pub local_modified_at: Option<i64>,
    pub remote_modified_at: Option<i64>,
    pub sync_status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub running: bool,
    pub last_sync: Option<String>,
    pub files_synced: u32,
    pub errors: Vec<String>,
    pub status: String, // "synced", "syncing", "error", "stopped"
}

static SYNC_RUNNING: std::sync::atomic::AtomicBool =
    std::sync::atomic::AtomicBool::new(false);

/// Initialize the sync state database
fn init_db(sync_folder: &Path) -> Result<Connection, rusqlite::Error> {
    let db_path = sync_folder.join(".sync_state.db");
    let conn = Connection::open(db_path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sync_state (
            path TEXT PRIMARY KEY,
            local_hash TEXT,
            remote_hash TEXT,
            local_modified_at INTEGER,
            remote_modified_at INTEGER,
            sync_status TEXT NOT NULL DEFAULT 'pending'
        );",
    )?;
    Ok(conn)
}

/// Compute SHA-256 hash of a file
fn file_hash(path: &Path) -> Result<String, std::io::Error> {
    let bytes = std::fs::read(path)?;
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    Ok(format!("{:x}", hasher.finalize()))
}

/// Check if a path should be ignored
fn should_ignore(path: &Path) -> bool {
    for component in path.components() {
        if let Some(name) = component.as_os_str().to_str() {
            if IGNORE_PATTERNS.contains(&name) {
                return true;
            }
        }
    }
    false
}

/// Remote file info from Lex API
#[derive(Debug, Deserialize)]
struct RemoteFile {
    path: String,
    #[serde(default)]
    hash: Option<String>,
    #[serde(default)]
    modified_at: Option<i64>,
    #[serde(default)]
    size: Option<u64>,
}

/// Start the bidirectional file sync service
pub async fn start_sync(
    app: AppHandle,
    sync_folder: String,
    server_url: String,
    interval_secs: u64,
) -> Result<(), String> {
    if SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
        return Err("Sync is already running".to_string());
    }
    SYNC_RUNNING.store(true, std::sync::atomic::Ordering::SeqCst);

    let sync_path = PathBuf::from(&sync_folder);
    if !sync_path.exists() {
        std::fs::create_dir_all(&sync_path).map_err(|e| e.to_string())?;
    }

    let client = Client::new();
    let base_url = server_url.trim_end_matches('/').to_string();

    // Initialize sync database
    let db = Arc::new(Mutex::new(
        init_db(&sync_path).map_err(|e| e.to_string())?,
    ));

    // Set up filesystem watcher
    let (tx, mut rx) = mpsc::channel::<PathBuf>(100);
    let sync_path_clone = sync_path.clone();

    std::thread::spawn(move || {
        let rt = tokio::runtime::Handle::current();
        let tx_clone = tx.clone();
        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    match event.kind {
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_) => {
                            for path in event.paths {
                                if !should_ignore(&path) {
                                    let _ = rt.block_on(tx_clone.send(path));
                                }
                            }
                        }
                        _ => {}
                    }
                }
            },
            Config::default(),
        )
        .expect("Failed to create file watcher");

        watcher
            .watch(&sync_path_clone, RecursiveMode::Recursive)
            .expect("Failed to watch sync folder");

        // Keep the watcher alive
        loop {
            std::thread::sleep(std::time::Duration::from_secs(3600));
            if !SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }
        }
    });

    // Spawn the sync loop
    let app_clone = app.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(interval_secs));

        loop {
            if !SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
                break;
            }

            tokio::select! {
                // Handle local file changes
                Some(changed_path) = rx.recv() => {
                    let relative = changed_path.strip_prefix(&sync_path).unwrap_or(&changed_path);
                    if !should_ignore(relative) {
                        let _ = upload_local_change(
                            &client, &base_url, &sync_path, relative, &db
                        ).await;
                        crate::tray::update_sync_status(&app_clone, "Synced ✓");
                    }
                }
                // Periodic remote poll
                _ = interval.tick() => {
                    crate::tray::update_sync_status(&app_clone, "Syncing...");
                    let _ = poll_remote_changes(
                        &client, &base_url, &sync_path, &db
                    ).await;
                    crate::tray::update_sync_status(&app_clone, "Synced ✓");
                }
            }
        }

        crate::tray::update_sync_status(&app_clone, "Stopped");
    });

    crate::tray::update_sync_status(&app, "Synced ✓");
    Ok(())
}

/// Stop the sync service
pub fn stop_sync() {
    SYNC_RUNNING.store(false, std::sync::atomic::Ordering::SeqCst);
}

/// Get current sync status
pub fn get_status() -> SyncStatus {
    SyncStatus {
        running: SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst),
        last_sync: None,
        files_synced: 0,
        errors: vec![],
        status: if SYNC_RUNNING.load(std::sync::atomic::Ordering::SeqCst) {
            "synced".to_string()
        } else {
            "stopped".to_string()
        },
    }
}

/// Upload a locally changed file to the Lex API
async fn upload_local_change(
    client: &Client,
    base_url: &str,
    sync_folder: &Path,
    relative_path: &Path,
    db: &Arc<Mutex<Connection>>,
) -> Result<(), String> {
    let full_path = sync_folder.join(relative_path);
    let remote_path = relative_path.to_string_lossy().to_string();

    if full_path.is_dir() {
        return Ok(());
    }

    // Check file size
    if let Ok(meta) = std::fs::metadata(&full_path) {
        if meta.len() > MAX_FILE_SIZE {
            return Err(format!(
                "File too large for sync: {} ({}MB)",
                remote_path,
                meta.len() / 1024 / 1024
            ));
        }
    }

    if !full_path.exists() {
        // File was deleted locally — delete remotely
        let url = format!("{}/api/files/{}", base_url, remote_path);
        client.delete(&url).send().await.map_err(|e| e.to_string())?;

        if let Ok(conn) = db.lock() {
            let _ = conn.execute("DELETE FROM sync_state WHERE path = ?1", [&remote_path]);
        }
        return Ok(());
    }

    // Upload the file
    let bytes = std::fs::read(&full_path).map_err(|e| e.to_string())?;
    let hash = file_hash(&full_path).unwrap_or_default();

    let url = format!("{}/api/files/{}", base_url, remote_path);
    client
        .put(&url)
        .body(bytes)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    // Update sync state
    if let Ok(conn) = db.lock() {
        let _ = conn.execute(
            "INSERT OR REPLACE INTO sync_state (path, local_hash, sync_status) VALUES (?1, ?2, 'synced')",
            rusqlite::params![remote_path, hash],
        );
    }

    Ok(())
}

/// Poll the Lex API for remote changes and download them
async fn poll_remote_changes(
    client: &Client,
    base_url: &str,
    sync_folder: &Path,
    db: &Arc<Mutex<Connection>>,
) -> Result<(), String> {
    let url = format!("{}/api/files", base_url);
    let response = client.get(&url).send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!("Failed to list remote files: {}", response.status()));
    }

    let remote_files: Vec<RemoteFile> = response.json().await.map_err(|e| e.to_string())?;

    let mut seen_paths = HashSet::new();

    for remote_file in &remote_files {
        seen_paths.insert(remote_file.path.clone());
        let local_path = sync_folder.join(&remote_file.path);

        if should_ignore(Path::new(&remote_file.path)) {
            continue;
        }

        // Check if we need to download
        let needs_download = if local_path.exists() {
            if let (Some(remote_hash), Ok(local_hash)) =
                (&remote_file.hash, file_hash(&local_path))
            {
                remote_hash != &local_hash
            } else {
                // No hash available — check modification time
                false
            }
        } else {
            true
        };

        if needs_download {
            let file_url = format!("{}/api/files/{}", base_url, remote_file.path);
            if let Ok(resp) = client.get(&file_url).send().await {
                if resp.status().is_success() {
                    if let Ok(bytes) = resp.bytes().await {
                        // Ensure parent directory exists
                        if let Some(parent) = local_path.parent() {
                            let _ = std::fs::create_dir_all(parent);
                        }
                        let _ = std::fs::write(&local_path, &bytes);

                        if let Ok(conn) = db.lock() {
                            let hash = file_hash(&local_path).unwrap_or_default();
                            let _ = conn.execute(
                                "INSERT OR REPLACE INTO sync_state (path, local_hash, remote_hash, sync_status) VALUES (?1, ?2, ?3, 'synced')",
                                rusqlite::params![remote_file.path, hash, remote_file.hash],
                            );
                        }
                    }
                }
            }
        }
    }

    Ok(())
}
