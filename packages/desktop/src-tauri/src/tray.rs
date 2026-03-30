use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

pub fn create_tray(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let open_item = MenuItemBuilder::with_id("open", "Lex").build(app)?;
    let new_chat = MenuItemBuilder::with_id("new_chat", "New Chat").build(app)?;
    let upload = MenuItemBuilder::with_id("upload", "Upload File").build(app)?;
    let sync_status = MenuItemBuilder::with_id("sync_status", "Sync: Ready").build(app)?;
    let open_browser = MenuItemBuilder::with_id("open_browser", "Open Lex in Browser").build(app)?;
    let settings = MenuItemBuilder::with_id("settings", "Settings").build(app)?;
    let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&open_item)
        .separator()
        .item(&new_chat)
        .item(&upload)
        .item(&sync_status)
        .separator()
        .item(&open_browser)
        .item(&settings)
        .separator()
        .item(&quit)
        .build()?;

    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))?;

    TrayIconBuilder::new()
        .icon(icon)
        .tooltip("Lex")
        .menu(&menu)
        .on_menu_event(move |app, event| match event.id().as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "new_chat" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval("window.location.hash = '#/chat/new'");
                }
            }
            "upload" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = crate::commands::pick_and_upload(&app_handle).await;
                });
            }
            "open_browser" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(settings) = crate::commands::load_settings_from_disk(&app_handle) {
                        if let Some(url) = settings.server_url {
                            let _ = tauri_plugin_shell::ShellExt::shell(&app_handle)
                                .open(&url, None);
                        }
                    }
                });
            }
            "settings" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.eval("window.location.hash = '#/settings/desktop'");
                }
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

/// Update the tray sync status text
pub fn update_sync_status(app: &AppHandle, status: &str) {
    // Tray menu items are rebuilt on each interaction in Tauri v2
    // For now, we emit an event that the frontend can listen to
    let _ = app.emit("sync-status-changed", status);
}
