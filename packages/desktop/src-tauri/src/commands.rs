use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Desktop app settings stored locally
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub server_url: Option<String>,
    pub sync_folder: Option<String>,
    pub sync_enabled: bool,
    pub sync_interval_secs: u64,
    pub ignore_patterns: Vec<String>,
    pub launch_on_startup: bool,
    pub notifications_enabled: bool,
    pub notify_automation_complete: bool,
    pub notify_new_message: bool,
    pub notify_sync_complete: bool,
    pub notify_sync_error: bool,
    pub check_updates_on_launch: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            server_url: None,
            sync_folder: None,
            sync_enabled: false,
            sync_interval_secs: 30,
            ignore_patterns: vec![
                ".git".to_string(),
                "node_modules".to_string(),
                ".DS_Store".to_string(),
                "Thumbs.db".to_string(),
            ],
            launch_on_startup: false,
            notifications_enabled: true,
            notify_automation_complete: true,
            notify_new_message: true,
            notify_sync_complete: false,
            notify_sync_error: true,
            check_updates_on_launch: true,
        }
    }
}

/// Get the settings file path
fn settings_path(app: &AppHandle) -> PathBuf {
    let config_dir = app
        .path()
        .app_config_dir()
        .expect("Failed to get app config dir");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

/// Load settings from disk
pub fn load_settings_from_disk(app: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app);
    if path.exists() {
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    } else {
        Ok(AppSettings::default())
    }
}

/// Save settings to disk
fn save_settings_to_disk(app: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app);
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<AppSettings, String> {
    load_settings_from_disk(&app)
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    // Handle autostart toggle
    if settings.launch_on_startup {
        let _ = app
            .autolaunch()
            .enable();
    } else {
        let _ = app
            .autolaunch()
            .disable();
    }

    save_settings_to_disk(&app, &settings)
}

#[tauri::command]
pub async fn set_server_url(app: AppHandle, url: String) -> Result<(), String> {
    let mut settings = load_settings_from_disk(&app)?;
    settings.server_url = Some(url);
    save_settings_to_disk(&app, &settings)
}

#[tauri::command]
pub async fn get_server_url(app: AppHandle) -> Result<Option<String>, String> {
    let settings = load_settings_from_disk(&app)?;
    Ok(settings.server_url)
}

#[tauri::command]
pub async fn start_file_sync(app: AppHandle) -> Result<(), String> {
    let settings = load_settings_from_disk(&app)?;
    let folder = settings
        .sync_folder
        .ok_or("No sync folder configured")?;
    let server_url = settings
        .server_url
        .ok_or("No server URL configured")?;

    crate::sync::start_sync(app, folder, server_url, settings.sync_interval_secs).await
}

#[tauri::command]
pub async fn stop_file_sync() -> Result<(), String> {
    crate::sync::stop_sync();
    Ok(())
}

#[tauri::command]
pub async fn get_sync_status() -> Result<crate::sync::SyncStatus, String> {
    Ok(crate::sync::get_status())
}

#[tauri::command]
pub async fn pick_sync_folder(app: AppHandle) -> Result<Option<String>, String> {
    let folder = app
        .dialog()
        .file()
        .blocking_pick_folder();

    if let Some(path) = folder {
        let folder_str = path.to_string();
        let mut settings = load_settings_from_disk(&app)?;
        settings.sync_folder = Some(folder_str.clone());
        save_settings_to_disk(&app, &settings)?;
        Ok(Some(folder_str))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub async fn upload_file(app: AppHandle) -> Result<(), String> {
    pick_and_upload(&app).await
}

/// Pick a file and upload it to Lex (used by tray menu and command)
pub async fn pick_and_upload(app: &AppHandle) -> Result<(), String> {
    let file = app
        .dialog()
        .file()
        .blocking_pick_file();

    if let Some(path) = file {
        let settings = load_settings_from_disk(app)?;
        let server_url = settings.server_url.ok_or("No server URL configured")?;

        let file_path = path.to_string();
        let file_name = PathBuf::from(&file_path)
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "upload".to_string());

        let bytes = fs::read(&file_path).map_err(|e| e.to_string())?;
        let client = reqwest::Client::new();
        let url = format!("{}/api/files/{}", server_url.trim_end_matches('/'), file_name);

        client
            .put(&url)
            .body(bytes)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        // Send notification
        if settings.notifications_enabled {
            let _ = app.emit("notification", serde_json::json!({
                "title": "File Uploaded",
                "body": format!("Uploaded {}", file_name)
            }));
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|e| e.to_string())?;
    match updater.check().await {
        Ok(Some(update)) => {
            let _ = app.emit("update-available", serde_json::json!({
                "version": update.version,
            }));
            Ok(true)
        }
        Ok(None) => Ok(false),
        Err(e) => Err(e.to_string()),
    }
}
