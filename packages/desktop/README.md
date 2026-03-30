# Lex Desktop App

Native desktop app for [Lex the Computer](../../README.md) — built with **Tauri v2**.

## Features

- **Web UI Wrapper** — Lex web interface in a native window
- **File Sync** — Bidirectional sync between a local folder and Lex workspace
- **System Tray** — Quick actions: new chat, upload, sync status, quit
- **Desktop Notifications** — Automation complete, new messages, sync status
- **Auto-Update** — Background update checks via GitHub Releases
- **Launch on Startup** — Optional autostart
- **Cross-Platform** — macOS (.dmg), Windows (.msi), Linux (.deb/.AppImage)

## Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/) >= 9
- Platform dependencies:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools, WebView2
  - **Linux**: `libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`

## Development

1. Start the Lex web app:
   ```bash
   cd packages/web && pnpm dev
   ```

2. Start the desktop app (in another terminal):
   ```bash
   cd packages/desktop && pnpm dev
   ```

   Tauri opens a native window pointing to `http://localhost:3000`.

## First Launch

On first launch, you'll be prompted to enter your Lex server URL:
- Local development: `http://localhost:3000`
- Self-hosted: `https://mylex.example.com`

The URL is saved in the app's config directory.

## File Sync

1. Open **Settings > Desktop** in the app (or use the system tray)
2. Click **Set up file sync** and choose a local folder
3. The app syncs files between your local folder and Lex's `/files/` workspace
4. Sync status is shown in the system tray icon

**Sync behavior:**
- Local changes are uploaded automatically via filesystem watcher
- Remote changes are polled every 30 seconds (configurable)
- Ignored: `.git/`, `node_modules/`, `.DS_Store`
- Max file size: 100MB

## Building

```bash
# Build for current platform
pnpm build

# Generate icons from SVG
pnpm icons
```

## Build Outputs

| Platform | Format | Location |
|----------|--------|----------|
| macOS | `.dmg` | `src-tauri/target/release/bundle/dmg/` |
| Windows | `.msi` | `src-tauri/target/release/bundle/msi/` |
| Linux | `.deb` | `src-tauri/target/release/bundle/deb/` |
| Linux | `.AppImage` | `src-tauri/target/release/bundle/appimage/` |

## Settings

Desktop-specific settings (separate from Lex web settings):

| Setting | Default | Description |
|---------|---------|-------------|
| Server URL | — | Lex instance to connect to |
| Sync folder | — | Local folder for file sync |
| Sync interval | 30s | How often to poll for remote changes |
| Launch on startup | Off | Start app when system boots |
| Notifications | On | Desktop notification preferences |
| Check for updates | On | Auto-check on launch |

Settings are stored in the OS config directory:
- macOS: `~/Library/Application Support/com.lexthecomputer.app/`
- Windows: `%APPDATA%/com.lexthecomputer.app/`
- Linux: `~/.config/com.lexthecomputer.app/`
