# Codex Task: Lex the Computer — Phase 12: Desktop App

## Overview
Build a native **desktop app** using **Tauri v2** that wraps the Lex web UI, adds bidirectional **file sync** between a local folder and the Lex workspace, and provides a **system tray** with quick actions. Builds for Mac, Windows, and Linux.

## Reference Docs
- `PLAN.md` — Phase 12 section
- `AUDIT-2026-03-29.md` — confirm Tauri v2 is correct for 2026
- Zo's desktop app docs: https://docs.zocomputer.com/desktop.md
- Tauri v2 docs: https://v2.tauri.app

## What Already Exists (Phases 0-11 + all remediations complete)
- Full web app at `packages/web` (Next.js 16)
- All features: chat, files, automations, sites, space, skills, integrations, channels, etc.
- The desktop app wraps this existing web UI

## Phase 12 Requirements

### 1. Tauri v2 App Setup

Create `packages/desktop/` in the monorepo:

```
packages/desktop/
├── src-tauri/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── src/
│   │   ├── main.rs              # Tauri entry point
│   │   ├── lib.rs               # Plugin registration
│   │   ├── tray.rs              # System tray setup
│   │   ├── sync.rs              # File sync logic
│   │   └── commands.rs          # Tauri commands (IPC)
│   ├── icons/                   # App icons for all platforms
│   └── capabilities/
│       └── default.json
├── package.json
└── README.md
```

**tauri.conf.json** key settings:
- App name: "Lex"
- Identifier: "com.lexthecomputer.app"
- Window: 1200x800 default, resizable, titlebar
- URL: points to local dev server or production URL
- Permissions: filesystem, shell, notification, system-tray, clipboard

### 2. Web UI Wrapper

The app loads the Lex web UI in a webview:
- **Development**: points to `http://localhost:3000` (Next.js dev server)
- **Production**: can point to the user's deployed Lex instance URL
- **First launch**: configuration screen asking for Lex server URL
  - Input: "Enter your Lex server URL" (e.g., `https://mylex.example.com` or `http://localhost:3000`)
  - "Remember this server" checkbox
  - Store in app config (Tauri's app data directory)

### 3. File Sync

Bidirectional sync between a local folder and the Lex workspace.

**Setup flow:**
1. User clicks "Set up file sync" in app settings or system tray
2. Folder picker dialog → select local folder
3. App begins syncing: local folder ↔ Lex workspace `/files/`

**Sync implementation:**
- Use Tauri's filesystem API to watch local folder for changes
- Use Lex's file API (`GET/POST/PUT/DELETE /api/files`) for remote operations
- Conflict resolution: last-write-wins with optional conflict markers
- Sync status indicator in system tray (synced ✓, syncing ↻, error ✗)

**Rust-side sync service (`sync.rs`):**
```rust
// Watch local directory for changes
// On local change: upload to Lex API
// Poll Lex API for remote changes (or use WebSocket if available)
// On remote change: download to local folder
// Track sync state in local SQLite database
```

**Sync state database** (local SQLite via `rusqlite`):
```sql
CREATE TABLE sync_state (
  path TEXT PRIMARY KEY,
  local_hash TEXT,
  remote_hash TEXT,
  local_modified_at INTEGER,
  remote_modified_at INTEGER,
  sync_status TEXT  -- 'synced', 'local_changed', 'remote_changed', 'conflict'
);
```

**Sync behavior:**
- Initial sync: download all remote files to local folder
- Watch for local changes via filesystem events (notify crate)
- Poll remote for changes every 30 seconds (configurable)
- Ignore patterns: `.git/`, `node_modules/`, `.DS_Store`, etc.
- Max file size for sync: 100MB (configurable)

### 4. SyncThing Integration (Alternative)

As an alternative to built-in sync, support SyncThing:
- Detect if SyncThing is installed locally
- Provide configuration guide: pair local SyncThing with Lex server's SyncThing
- Settings page shows SyncThing status if configured
- This is a fallback — built-in sync is the primary method

### 5. System Tray

**Tray icon** with menu:
- **Lex** (app name, bold) — opens main window
- ---
- **New Chat** — opens app to new chat
- **Upload File** — opens file picker, uploads to Lex
- **Sync Status**: Synced ✓ / Syncing... / Error
- ---
- **Open Lex in Browser** — opens server URL in default browser
- **Settings** — opens app settings
- **Quit** — exits the app

**Tray icon states:**
- Normal: Lex icon
- Syncing: Lex icon with sync indicator
- Error: Lex icon with warning badge
- Notification: Lex icon with dot badge

### 6. Notifications

- Desktop notifications for:
  - Automation completed
  - New message received (from channels)
  - File sync completed
  - Sync errors
- Use Tauri's notification plugin
- Configurable: enable/disable per notification type in app settings

### 7. App Settings (native)

Separate from Lex web settings — these are desktop-app-specific:
- **Server URL**: the Lex instance to connect to
- **File Sync**:
  - Local folder path
  - Enable/disable sync
  - Sync interval (seconds)
  - Ignore patterns
- **Startup**: Launch on system startup (toggle)
- **Notifications**: Enable/disable per type
- **SyncThing**: Status and configuration link

Store settings in Tauri's app data directory (`~/.config/lex/` on Linux, `~/Library/Application Support/lex/` on macOS, `%APPDATA%/lex/` on Windows).

### 8. Auto-Update

- Use Tauri's updater plugin
- Check for updates on launch (configurable)
- Update endpoint: GitHub Releases API (or custom URL)
- Show "Update available" notification with install button
- Silent background download, prompt to restart

### 9. App Icons & Branding

Create icons for all platforms:
- `icon.png` (1024x1024 for macOS)
- `icon.ico` (Windows)
- `32x32.png`, `128x128.png`, `128x128@2x.png`
- `icon.icns` (macOS)

Use a simple, clean icon: computer/terminal motif with "L" lettermark.
Generate all sizes from a single SVG source.

### 10. Build Configuration

**Cargo.toml** dependencies:
```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon", "image-png"] }
tauri-plugin-notification = "2"
tauri-plugin-fs = "2"
tauri-plugin-shell = "2"
tauri-plugin-clipboard-manager = "2"
tauri-plugin-dialog = "2"
tauri-plugin-updater = "2"
tauri-plugin-autostart = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
notify = "8"          # filesystem watcher
rusqlite = "0.32"     # local sync state
reqwest = { version = "0.12", features = ["json"] }  # HTTP client for Lex API
tokio = { version = "1", features = ["full"] }
```

**Build targets:**
- macOS: `.dmg` (universal binary: aarch64 + x86_64)
- Windows: `.msi` installer
- Linux: `.deb` + `.AppImage`

**GitHub Actions CI** (`packages/desktop/.github/workflows/build.yml`):
- Trigger on tag push (v*)
- Matrix build: macOS, Windows, Ubuntu
- Upload artifacts to GitHub Releases
- Tauri Action handles cross-platform builds

### 11. Development Setup

**package.json** scripts:
```json
{
  "scripts": {
    "dev": "tauri dev",
    "build": "tauri build",
    "icons": "tauri icon src-tauri/icons/icon.svg"
  }
}
```

**Dev workflow:**
1. Start web app: `cd packages/web && pnpm dev`
2. Start desktop: `cd packages/desktop && pnpm dev`
3. Tauri opens window pointing to localhost:3000

## Implementation Order

1. Initialize Tauri v2 project in `packages/desktop/`
2. Configure tauri.conf.json (window, permissions, identifiers)
3. Web UI wrapper with server URL configuration
4. System tray with menu and quick actions
5. File sync: local watcher + Lex API integration + sync state DB
6. SyncThing detection and configuration guide
7. Desktop notifications
8. App settings (native settings page)
9. Auto-update configuration
10. App icons (generate from SVG)
11. Build configuration for Mac + Windows + Linux
12. GitHub Actions CI for automated builds
13. README with install instructions

## Acceptance Criteria
- [ ] Desktop app opens and shows Lex web UI
- [ ] Server URL configuration works (first launch + settings)
- [ ] File sync: local changes → uploaded to Lex
- [ ] File sync: remote changes → downloaded to local
- [ ] Sync status visible in system tray
- [ ] System tray menu works (new chat, upload, settings, quit)
- [ ] Desktop notifications for automations and sync
- [ ] Auto-update check works
- [ ] Builds produce installers for Mac (.dmg), Windows (.msi), Linux (.deb/.AppImage)
- [ ] Launch on startup option works
- [ ] `packages/desktop` builds clean with `pnpm build`
