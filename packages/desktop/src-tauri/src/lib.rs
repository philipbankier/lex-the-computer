mod commands;
mod sync;
mod tray;

use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            // Initialize system tray
            tray::create_tray(app.handle())?;

            // Load settings and start sync if configured
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Ok(settings) = commands::load_settings_from_disk(&app_handle) {
                    if settings.sync_enabled {
                        if let Some(ref folder) = settings.sync_folder {
                            if let Some(ref server_url) = settings.server_url {
                                let _ = sync::start_sync(
                                    app_handle.clone(),
                                    folder.clone(),
                                    server_url.clone(),
                                    settings.sync_interval_secs,
                                )
                                .await;
                            }
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_settings,
            commands::save_settings,
            commands::set_server_url,
            commands::get_server_url,
            commands::start_file_sync,
            commands::stop_file_sync,
            commands::get_sync_status,
            commands::pick_sync_folder,
            commands::upload_file,
            commands::check_for_updates,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lex desktop app");
}
