# Zo Computer — Live UI Audit (March 29, 2026)

Performed via browser tool on a fresh account (philip@mailai.live).

---

## Navigation Structure

### Sidebar (Primary)
1. **Home** — dashboard/chat landing
2. **Files** — file browser
3. **Chats** — conversation list
4. **Automations** — scheduled AI tasks (NOT "Agents" in UI!)
5. **Space** — personal domain editor
6. **Skills** — installed + hub marketplace

### Sidebar (More menu, expanded)
7. **Hosting** — site/service management
8. **Datasets** — DuckDB data explorer
9. **System** — server stats
10. **Terminal** — web terminal
11. **Billing** — subscription management
12. **Resources** — help/docs links

### Sidebar (Bottom)
- **Bookmarks** — bookmarked tabs
- **Settings** — full settings page

### Footer (always visible)
- philipbankier.zo.computer (link)
- philipbankier.zo.space (link)
- philipbankier@zo.computer (mailto link)
- **Connections** button

---

## Tab System
- Every section opens as a **closeable tab** at the top
- Multiple tabs can be open simultaneously (Settings + Files + Automations + Skills all open at once)
- Click X to close any tab
- Tab bar scrolls horizontally if too many open

---

## Settings Structure

### Settings → AI (5 sub-sections in left nav)

**Models:**
- Per-CHANNEL model configuration (not global!)
- Each channel row: [Channel icon] [Channel name + details] [Persona dropdown] [Model dropdown]
  - Chat: persona + model
  - Text: +1 (650) 218-7127 (auto-provisioned phone!), persona + model
  - Email: philipbankier@zo.computer, persona + model
  - Telegram: persona + model
- Each channel can have DIFFERENT persona AND model

**Personas:**
- List of persona cards with name, description preview
- "+ New" button
- Default persona: "Brief & Direct"
- Edit/delete per persona

**Providers:**
- "Add Claude Code, Codex, or bring your own API keys" — single entry point
- Expands to show available providers

**Personalization:**
- Name (text input)
- Bio (text area) — "i am an ai agent builder."
- Social profiles: x, linkedin, github, instagram, bluesky, substack buttons
- Language: "Canadian English"
- Time zone: "New York (America)"
- Location: toggle to share location for local context

**Rules:**
- List of rules with "+ New" button
- Documentation link

### Settings → Channels
Channel cards with format: **"Ask [Persona dropdown] with [Model dropdown] over [channel]"**
- Text: shows phone number, can register multiple numbers, "+ Add"
- Email: shows zo.computer email + connected account, "+ Add"
- Telegram: connect via @zo_computer_bot, "+ Add"
- Each channel independently configures persona + model

### Settings → Integrations (3 sub-sections)

**Connections:**
1. Gmail — "Read, send, and manage emails and drafts in Gmail"
2. Calendar — "View and manage events in Google Calendar"
3. Drive — "Access files in Google Drive, Including Docs, Sheets, Slides, and Forms"
4. Notion — "Access and manage pages, databases, and workspaces in Notion"
5. Dropbox — "Access and manage files in your Dropbox account"
6. OneDrive — "Access and manage files in Microsoft OneDrive"
7. Tasks (Google Tasks) — "Access and manage task lists and tasks in Google Tasks"
8. Airtable — "Access and manage bases, tables, and records in Airtable"
9. Linear — "Manage issues, projects, and teams in Linear"

**Browser:**
- Zo's browser for logged-in site access

**Payments:**
- Stripe Connect (sell products)

### Settings → UX
- Theme picker, keybindings, display preferences

### Settings → Advanced
- API keys/access tokens for MCP
- Advanced configuration

---

## Key Features & UX Observations

### Chat System
- Persistent chat sidebar on RIGHT side (collapsible)
- Chat visible on EVERY page (not just the Chats tab)
- Model picker: "MiniMax 2.7" (default free model) with dropdown
- Persona selector next to model picker
- "Browse files" button (+ icon) for attaching files
- "What can I do for you?" placeholder
- "Zo is thinking. Press Esc to stop." during processing

### Files
- Simple list view with folders and files
- Default folders: Articles, Images
- Sites appear as globe-icon entries
- Name column with sort toggle
- Toolbar: info, filter, search, trash
- "+" FAB for new file/folder

### Automations
- Card layout with: title, description, schedule, model
- Schedule format: "EVERY DAY AT 8:00 AM"
- Search bar
- "+" FAB
- Onboarding creates a default automation

### Space
- URL bar showing: domain + route name
- **Preview / Code** toggle tabs
- **Public** toggle switch (top right)
- Live preview iframe
- Action buttons: open external, refresh, settings gear
- Back navigation arrow

### Skills
- Two tabs: **Installed** / **Hub**
- "Open folder" button → opens Skills/ in file browser
- "Create skill" button
- Documentation link to docs.zocomputer.com/skills
- GitHub link for community submissions (zocomputer/skills repo)

### Free Tier
- "Free with limits" badge at top
- "Subscribe to unlock" link
- Auto-provisioned: phone number, email, .zo.computer domain, .zo.space domain
- Default model: MiniMax 2.7 (free model)

---

## Gaps Identified (Our Build vs Zo)

### 🔴 Critical

1. **TERMINOLOGY: UI says "Automations" not "Agents"** — We renamed to Agents in remediation Step 12. The Zo API tools use "agent" (create-agent, etc.) but the UI/nav says "Automations". We need to REVERT the UI rename.

2. **Per-channel model+persona in Settings → AI → Models** — Zo lets you set DIFFERENT model AND persona per channel (Chat, Text, Email, Telegram). We need this per-channel configuration in our Models settings.

3. **Auto-provisioned phone number** — Free accounts get a US phone number automatically. Users can text Zo directly. This is hard for open-source but should be supported if Twilio is configured.

4. **"Personalization" section** with social profiles (x, linkedin, github, instagram, bluesky, substack), language, timezone, location sharing — We have bio but may be missing social profiles, language, location.

5. **Integrations structure**: Browser and Payments are SUB-SECTIONS of Integrations (not separate pages). Our implementation may have them as separate features.

6. **Bookmarks** — Zo has a Bookmarks section in the sidebar for bookmarking tabs and recent files. We may not have this.

7. **Resources** page under More menu — help/docs links. We may not have this.

### 🟡 Important

8. **Channel cards UX**: "Ask [Persona] with [Model] over [channel]" — beautiful sentence structure. Ours should match this pattern.

9. **"+ Add" on channels** — ability to add multiple configurations per channel type (e.g., multiple phone numbers for Text).

10. **Space Preview/Code toggle** — our Space editor should have this exact pattern with live preview.

11. **Default free model**: MiniMax 2.7 — Zo uses a specific free model. We should configure a sensible default.

12. **Connections button in footer** — quick access to connection status.

13. **"Zo is thinking. Press Esc to stop."** — specific UX copy during processing.

### ✅ Aligned

- Tab-based UI ✅
- Sidebar navigation structure ✅ (same items, same order)
- More menu items ✅ (Hosting, Datasets, System, Terminal, Billing, Resources)
- Skills with Installed/Hub tabs ✅
- Settings tabs (AI, Channels, Integrations, UX, Advanced) ✅
- File browser layout ✅
- Automation cards with schedule + model ✅
- Persistent chat sidebar ✅
- Providers section for Claude Code/Codex ✅
