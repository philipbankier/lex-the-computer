# Phase 2: Files & Workspace

## Overview
Build the full file management system and web terminal. Users should be able to browse, upload, edit, and organize files. AI should be able to read/write/search files and run shell commands. The terminal provides direct shell access via xterm.js.

## Existing Code
Phase 1 is complete. Relevant existing pieces:
- `packages/core/src/routes/files.ts` — basic GET `/api/files` (list) and GET `/api/files/content` (read snippet). Needs expansion.
- `packages/web/app/(app)/files/page.tsx` — empty shell with placeholder buttons
- `packages/web/app/(app)/terminal/page.tsx` — empty shell
- Workspace directory convention: `workspace/` at core working dir (will become `/data/workspace/` in Docker)

## Phase 2a: Backend — File Operations API

Expand `packages/core/src/routes/files.ts` with full CRUD:

1. `GET /api/files` — List files/dirs at path (query: `?path=relative/dir`). Return `{ entries: [{ name, path, type: 'file'|'dir', size, modified }] }`
2. `GET /api/files/content` — Read file content (already exists, keep it)
3. `POST /api/files/content` — Create or overwrite file. Body: `{ path, content }`
4. `PATCH /api/files/content` — Rename/move file. Body: `{ path, newPath }`
5. `DELETE /api/files` — Delete file or directory. Body: `{ path }`
6. `POST /api/files/mkdir` — Create directory. Body: `{ path }`
7. `POST /api/files/upload` — Multipart file upload. Accept multiple files. Save to specified directory path.
8. `GET /api/files/download` — Download file (query: `?path=`). Set Content-Disposition header.
9. `GET /api/files/download-zip` — Download directory as zip (query: `?path=`). Use `archiver` package.
10. `GET /api/files/search` — Search files. Query: `?q=query&type=content|filename`. For content search, use `grep -rn` or similar. For filename search, use the existing walk function with filter.

Security: All paths must be validated to stay within workspace root (the `within()` function already exists).

## Phase 2b: Backend — AI File Tools

Add new tools in `packages/core/src/tools/`:

11. `create_file` tool — Create or overwrite a file at given path with given content
12. `edit_file` tool — Read a file, apply edits (simple find/replace or line-based), write back
13. `list_files` tool — List files in a directory (wraps the API)
14. `search_files` tool — Search file contents or filenames (wraps the API)
15. `run_command` tool — Execute a shell command in the workspace directory. Use `child_process.exec` with `{ cwd: WORKSPACE_DIR, timeout: 30000 }`. Return `{ stdout, stderr, exitCode }`. Sandbox: reject commands that try to leave workspace.
16. `run_sequential_commands` tool — Run multiple commands in order, stop on first failure
17. `run_parallel_commands` tool — Run multiple commands concurrently, return all results

Register all new tools in the chat route's `toolsList` array so the AI can use them.

Update `save_webpage` tool to use the proper workspace path from env/config.

## Phase 2c: Backend — Terminal WebSocket

18. Add WebSocket endpoint for terminal: `GET /api/terminal/ws`
   - Use `node-pty` to spawn a shell (bash) in the workspace directory
   - WebSocket receives keystrokes from client, sends to pty
   - Pty output forwarded to client via WebSocket
   - Handle resize events (cols/rows)
   - Clean up pty on disconnect
   - Install `node-pty` and `ws` packages in core

## Phase 2d: Frontend — File Browser

Update `packages/web/app/(app)/files/page.tsx`:

19. **Tree view sidebar** (left panel, ~250px):
   - Recursive folder tree
   - Click folder to expand/collapse
   - Click file to open in viewer
   - Right-click context menu: Rename, Delete, New File, New Folder
   - Current path highlighted

20. **Breadcrumb navigation** — Shows current directory path as clickable segments

21. **Main content area** (right panel):
   - **List view** (default): table with Name, Size, Modified columns. Sortable.
   - **Grid view**: thumbnail cards for images, icons for other files
   - Toggle button between views

22. **File viewer/editor** — Opens when clicking a file:
   - **Text/code**: Monaco editor (install `@monaco-editor/react`). Syntax highlighting auto-detected from extension. Save button (Ctrl+S).
   - **Markdown**: Rendered preview with toggle to raw editor
   - **Images**: Preview with zoom (fit to container)
   - **PDF**: Embedded `<iframe>` or `react-pdf`
   - **Audio**: HTML5 `<audio>` player
   - **Video**: HTML5 `<video>` player
   - For unsupported types: show file info + download button

23. **Upload**: Drag & drop zone on the main area. Also an "Upload" button that opens file picker. Show upload progress. Multi-file support.

24. **Download**: Click download button on any file. For directories, download as zip.

25. **File operations toolbar**:
   - New File button → prompt for name → creates empty file
   - New Folder button → prompt for name → creates directory
   - Delete button → confirm dialog → deletes selected
   - Rename → inline edit or prompt
   - Search input → searches files (content + filename)

26. **"Chat about this file"** button on file viewer → opens the main chat with the file pre-attached (uses the @ mention file selection from Phase 1)

## Phase 2e: Frontend — Terminal

Update `packages/web/app/(app)/terminal/page.tsx`:

27. **xterm.js terminal** — Full terminal emulation:
   - Install `@xterm/xterm` and `@xterm/addon-fit`
   - Connect to `ws://CORE_URL/api/terminal/ws`
   - Auto-fit to container size
   - Handle resize (send new cols/rows to server)
   - Dark theme matching app
   - Reconnect on disconnect

28. **Split view option**: Side-by-side terminal + file editor. Toggle button or drag handle.

## Workspace Initialization

29. On first startup, if `workspace/` doesn't exist, create it with subdirectories:
    ```
    workspace/
    ├── files/
    ├── sites/
    ├── skills/
    ├── articles/
    └── .config/
    ```
    Add this initialization to core startup (index.ts).

## Acceptance Criteria
- [ ] File browser shows directory tree + file list
- [ ] Can navigate directories via tree or breadcrumbs
- [ ] Can upload files (drag & drop + button)
- [ ] Can download files and directories (as zip)
- [ ] Monaco editor opens for code/text files with syntax highlighting
- [ ] Can save edits (Ctrl+S)
- [ ] Image/audio/video previews work
- [ ] File operations: new file, new folder, rename, delete all work
- [ ] File search (content + filename) returns results
- [ ] "Chat about this file" opens chat with file in context
- [ ] AI tools: create_file, edit_file, list_files, search_files all work
- [ ] AI tools: run_command executes in workspace and returns output
- [ ] Terminal (xterm.js) connects and provides working shell
- [ ] Terminal auto-fits and handles resize
- [ ] Grid/list view toggle works
- [ ] Workspace directories auto-created on first startup

## What NOT to Build Yet
- Automations (Phase 3)
- Sites/hosting (Phase 4)
- Space (Phase 5)
- Skills (Phase 6)
