# Lex the Computer — Live UI Audit (from Zo Computer)

## Captured via chrome-cdp skill on Philip's live Zo account (2026-03-26)

---

## NAVIGATION STRUCTURE

### Sidebar (left, collapsible)
- **Home** (with Zo icon)
- **Files**
- **Search** (standalone search, not just in-page)
- **Chats**
- **Automations**
- **Space**
- **Skills**
- **More** (expandable)
- **Bookmarks** (under More)
- **Settings** (under More)

### Tab System
- Each nav click opens as a **tab** at the top (like browser tabs within the app)
- Tabs show "Close tab" button
- Multiple sections can be open simultaneously as tabs
- This is a KEY UX pattern — it's not page-based, it's tab-based

### Persistent Elements
- Chat sidebar always available on the right (collapsible)
- Footer always shows: zo.computer URL, zo.space URL, email, phone number
- Command Palette overlay (Cmd+K style)
- "Go to File" search overlay

---

## HOME / DASHBOARD
- "Bookmarks" heading — quick access to bookmarked tabs and recent files
- "New chat" button prominent
- Plan indicator ("Free")
- Subscribe button
- Active persona shown with avatar
- Model selector dropdown

---

## FILES
- Tree view with folders: Articles, Images, openclaw-saas, Getting Started
- Actions: Upload, Choose Files, Show help, View options, Search files, Open trash, Create new item
- Sort by Name (column header, toggleable direction)
- Expand/collapse folders
- Chat sidebar open alongside

---

## CHATS
- Conversation list grouped by time (Today, etc.)
- Each conversation: title, Chat options button, Share button
- Filter conversations button
- "New" button to create new chat

---

## AUTOMATIONS
- "New agent" button
- Filter tabs: **None | Email | SMS | Telegram | Paused**
- Per automation card:
  - Title + description
  - Schedule (e.g., "EVERY DAY AT 8:00 AM")
  - Persona shown (with icon)
  - Model shown
  - Pause/Resume button
  - Edit schedule button
  - Open task actions
  - Delivery method indicator

---

## SPACE
- URL shown: handle.zo.space
- Route dropdown selector (e.g., "Home page")
- Actions: New page, Open in new tab, Refresh, Share, Make private
- **Site preview iframe** (live preview embedded)
- Space settings button
- Toggle route list button

---

## SKILLS ⭐
### Installed Tab
- Shows installed skills (empty in this account)
- "Open folder" button — goes to Skills/ in file browser
- "Create skill" button
- Documentation link
- GitHub link (for PR submissions)
- Description: "Skills help your AI do more complex tasks for you..."

### Hub Tab (MASSIVE — 100+ skills!)
- Search bar: "Search skills..."
- Sort skills button
- Each skill card:
  - Name (bold)
  - Author tag (e.g., "skeletorjs", "Anthropic", "Zo", "Coreyhaines31", "Clawdbot")
  - Description (full paragraph)
  - "Install" button
  - "Open [skill name]" button (view details)

### Skills Found in Hub (complete list captured):
**By Zo (official):**
- Research a topic, Create a site, Organize my files, Automate something
- Daily news digest, Set up SSH server, Set up code-server (VS Code in browser)
- Set up n8n workflow automation, Set up Grafana for log visualization
- Daily Linear digest, Weekly meeting reminder, Text summary of important emails
- Texting positive affirmations daily, Extract Text from Images (OCR)
- Generate PDF from Markdown, Convert PDF to Markdown, Convert EPUB to Markdown
- Resize Images, Enrich CSV with AI-generated columns, Create a blog
- Create a portfolio site, Create a guestbook, Process file line-by-line
- Find meetings with attendees, google-direct-oauth

**By Anthropic:**
- skill-creator, frontend-design, Process PDF Files, canvas-design
- web-artifacts-builder, webapp-testing, doc-coauthoring, brand-guidelines
- internal-comms, template-skill, mcp-builder, Font & Color Theme Builder
- Create Animated GIFs for Slack, Generate Algorithmic Art

**By skeletorjs:**
- supermemory, web-scraper, humanizer, self-improvement, context7
- code-degunker, handoff, morning-briefing, midday-checkin, journal
- simplify, market-research, visual-explainer, zo-space, seo-data
- prompt-improver, revealjs-presentation, zopack, zo-dataset-creator

**By Coreyhaines31:**
- SEO Expert, Social Content Expert, Copywriting Expert, Copy Editing Expert
- Marketing Psychology & Mental Models, marketing-ideas, launch-strategy
- pricing-strategy, free-tool-strategy, paid-ads, email-sequence
- page-cro, signup-flow-cro, onboarding-cro, paywall-upgrade-cro
- popup-cro, form-cro, ab-test-setup, analytics-tracking
- programmatic-seo, competitor-alternatives, schema-markup, referral-program

**By Clawdbot (OpenClaw):**
- GitHub, Use MCP Server, Google Workspace Tool, Weather
- Blog Watcher, Video Frames (FFmpeg), Shorten URLs, Control tmux sessions
- Help me cancel my subscriptions, Use Notion, Use Trello, EightSleep Pod Control
- Access Last.fm data

**By community members:**
- LinkedIn (Zo), X (Twitter) (Zo), Post to X (Twitter) (0.zo.computer)
- Create Animated Videos (Remotion), Create 3Blue1Brown Videos (Manim)
- Install OpenClaw on Zo, Create Memes, Stripe Best Practices
- Summarize Hacker News front page, Claude Code Window Primer
- Multiple threejs-* skills (Cloudai-x), Genome Analysis, Plant Care Plan
- Generate QR code, Create ideal dating profile, Tweetscape Narrator
- Set up hashcards, Generate flashcards, Create slide deck, moltbook
- file-share, mcporter-setup, exe-dev, google-calendar, share-skill
- Create syllabus reminders, Text commute time, Remove Photo Metadata
- Craigslist missed connections, receipt processing, vapi (Voice AI)

---

## SETTINGS

### Settings Tabs (top)
- **AI** | **Channels** | **Integrations** | **UX** | **Advanced**
- Plan indicator link ("Free plan")

### AI Tab contains:
- **Models** — per-channel model selector
- **Personas** — CRUD, active indicator, per-channel assignment
- **Providers** — "Add Claude Code, Codex, or bring your own API keys"
- **Personalization** — Name, Bio, Social profiles (x, linkedin, github, instagram, bluesky, substack), Language, Time zone, Location toggle
- **Rules** — CRUD

### Channel Configuration (visible on AI tab):
Each channel shows independently configurable:
- **Chat** — persona + model selector
- **Text** — phone number shown, persona + model
- **Email** — email shown, persona + model
- **Telegram** — persona + model

This means EACH CHANNEL can have its own persona and model!

### Persona Detail:
- Name, avatar/icon
- Description
- Active on which channels (TEXT, EMAIL, etc.)
- Actions menu

### Personalization:
- Name (text input)
- Bio (text, e.g., "i am an ai agent builder.")
- Social profiles: x, linkedin, github, instagram, bluesky, substack (all as buttons)
- Language selector (e.g., "Canadian English")
- Time zone (e.g., "New York (America)")
- Location toggle (share location for local context)

---

---

## SETTINGS (Complete)

### Settings Tabs: AI | Channels | Integrations | UX | Advanced

### AI Tab
- **Models** — per-channel model selector (Chat, Text, Email, Telegram each configurable)
- **Personas** — CRUD, active indicator, per-channel assignment, avatar
- **Providers** — "Add Claude Code, Codex, or bring your own API keys"
- **Personalization**:
  - Name (text input)
  - Bio (text)
  - Social profiles: x, linkedin, github, instagram, bluesky, substack
  - Language selector (e.g., "Canadian English")
  - Time zone (e.g., "New York (America)")
  - Location toggle (share for local context)
- **Rules** — CRUD with documentation link

### Channels Tab
- **Text channel**: 
  - Phone number shown (+1 (650) 218-7127)
  - Per-channel persona + model selector
  - "Add phone number" — can register multiple numbers
  - Description: all registered numbers can receive texts, unassociated numbers can also text back
- **Email channel**:
  - Email shown (philipbankier@zo.computer)
  - Per-channel persona + model
  - "Add allowed sender" to whitelist email addresses
  - Account email shown (philip@mailai.live)
  - Link to "connect your Gmail account" for sending on behalf
- **Telegram channel**:
  - Bot: @zo_computer_bot
  - Per-channel persona + model
  - Connect Telegram account flow

### Integrations Tab
Sub-tabs: **Connections | Browser | Payments**

**Connections:**
- Gmail — "Read, send, and manage emails and drafts"
- Calendar — "View and manage events in Google Calendar"
- Drive — "Access files in Google Drive, including Docs, Sheets, Slides, and Forms"
- Notion — "Access and manage pages, databases, and workspaces"
- Dropbox — "Access and manage files in your Dropbox account"
- **OneDrive** — "Access and manage files in Microsoft OneDrive" ⚠️ MISSED THIS
- **Tasks** — "Access and manage task lists and tasks in Google Tasks" ⚠️ MISSED THIS
- Airtable — "Access and manage bases, tables, and records"
- Linear — "Manage issues, projects, and teams"
- **Microsoft Outlook** — "Read, send, and manage emails" ⚠️ MISSED THIS
- Spotify — "Search, play, and manage playlists and library"
- LinkedIn — "Use your LinkedIn account with Zo" (skill-based)
- Twitter — "Use your Twitter account with Zo" (skill-based)
- Note: "Zo Computer partners with Pipedream (SOC 2 compliant)"
- Note: "Want to connect something else? Just ask Zo to build a custom integration"

**Browser:**
- "Zo's browser" section
- "Log into sites you want Zo to access"
- "Open Zo's browser" button
- "No logged-in sites detected yet" (empty state)
- View documentation link

**Payments:**
- Stripe Connect integration
- Sub-tabs: Account | Products | Orders
- Country selector for Stripe account creation
- "Connect Stripe Account" with onboarding flow
- View documentation link

### UX Tab
**Theme picker** — not just light/dark! Full themed options:
- Light, Dark, System (standard)
- Named themes: Espreszo, In the Zone, Claude Zo, T3 Zo, Root Zone, Comfort Zone, Garbanzo, Intermezzo, Why Zo Serious, Protozoa, All Systems Zo, Ozone, ZOTech, LFZ, Hadal Zone, ZOMG, Zo Hot Right Now, Zodiac, Zombocom, Zo Cool
- **Keybindings**: "Configure shortcuts" button
- **Show hidden files and folders** toggle (dev mode)

### Advanced Tab
- **Secrets**: Environment variables for scripts and routes (KEY=VALUE format, paste .env support)
- **Access Tokens**: For MCP and HTTP API authentication
  - Named keys (e.g., "Home Laptop", "Project Z")
  - Links to MCP docs and HTTP API docs
- **Danger Zone**: Delete Account button

---

## MORE MENU (Expanded Sidebar Items) ⚠️ PREVIOUSLY MISSED

When clicking "More" in sidebar, reveals:
- **Hosting** — Sites & Services management
- **Datasets** — Structured data exploration (DuckDB)
- **System** — Server stats and management
- **Terminal** — Web terminal
- **Billing** — Subscription management
- **Resources** — Help/docs links
- **Bookmarks** — Quick access items
- **Settings** — Full settings

### Hosting Page
- "New Site" button + "More create options"
- Search bar for sites and services
- Site cards showing:
  - Site name (e.g., "openclaw-saas")
  - Public URL (e.g., https://zite-50972-philipbankier.zo.computer)
  - Actions button
- Stripe promotion: "Accept payments on sites with Stripe. No additional fees."

### Datasets Page ⚠️ COMPLETELY NEW FEATURE
- "Create dataset" button
- Description: "Turn messy exports into structured datasets you can explore. Zo can organize, document, and analyze your data so you can ask better questions, build charts, and discover patterns."
- Blog post link
- Uses DuckDB under the hood (from zo-dataset-creator skill)
- Data format: datapackage.json + schema.yaml + data.duckdb

### System Page
- Sub-tabs: **Stats | Restore | Reboot**
- Stats shows:
  - Physical Cores: 3 @ 2.6GHz
  - Architecture: x86_64
  - Operating System: Linux 6.12
  - Processes: 17
  - Uptime: 1h 25m
  - Memory: 0.9 GB of 4.0 GB used (22.8%)
  - Network Speed: "Run test" button
- **Restore**: system restore capability
- **Reboot**: restart the server
- Note: "Hardware specs can change dynamically depending on the workloads you run and the plan you're subscribed to"

---

## GLOBAL UI PATTERNS

### Chat Sidebar (always available)
- Collapsible right panel
- "New chat" button
- "Expand chat" / "Collapse chat sidebar" buttons
- Active persona shown with avatar
- Model selector dropdown
- "Browse files" button (@ mention files)
- "Send message" / "Go" button
- "Free" plan indicator (or credits)
- Footer: all user endpoints (URL, space, email, phone)

### Command Palette
- "Search for a command to run..." overlay
- Separate "Go to File" search

### Tab System
- Browser-style tabs within the app
- Can have Files + Chats + Settings all open as tabs
- Close tab button on each

### "Zo is thinking" indicator
- Shows when AI is processing
- "Press Esc to stop" hint

---

## CHAT UI (Detailed — from conversation view)

### Conversation List (left panel)
- Grouped by time: "Today", etc.
- Each entry shows:
  - Date prefix for automations: "Mar 26 | Daily AI Research..."
  - Title for user chats: "Cloud-based OpenClaw SaaS Development"
  - Chat options button (hover)
  - Share button with "Share" label
- Filter conversations button at top
- "New" button at top

### Active Conversation (main area)
- **Chat header**: Rename chat button, Share chat / Export button
- **User messages**: plain text, left-aligned
- **AI messages**: include:
  - Persona avatar + name (e.g., "Brief & Direct")
  - Model name (e.g., "MiniMax 2.7")
  - Timestamp ("about 11 hours ago")
  - **Thoughts** button — expandable thinking/reasoning
  - **Tool call indicators** as collapsible buttons:
    - "Researched the web [query]"
    - "Looked up tool [tool_name]"
    - "Created site [name]"
    - "Edited space [route]"
    - "Read from space [route]"
    - "Viewed space"
    - "Checked space" (error checking)
    - "Created file +[lines] [path]"
    - "Deleted from space [route]"
    - "Updated site settings [title]"
  - Rich markdown rendering: tables, headings, code blocks, lists, links
  - Tables have "Copy table" button
  - Code blocks have "Copy code" button
  - Links to internal pages (Settings › Advanced, Services) are clickable
  - File links are clickable (README, install.sh, etc.)

### Chat Input Area
- Text input with "Reply..." placeholder
- Active Persona shown with avatar
- Model selector dropdown (combobox)
- Plan indicator ("Free")
- "Browse files" button (@ file mentions)
- "Send" button

### Model Picker (dropdown)
- Shows available models with pricing tier
- Free models: MiniMax 2.7, Kimi K2.5
- "More" button to see all models (likely paid: Claude, GPT, etc.)
- Each option shows: Model name + tier label

### Conversation Layout
- Left: conversation list (collapsible via separator)
- Right: active conversation + input
- Separator bar between list and conversation (draggable width)
- Tab shows conversation name + close button

---

## CHANNELS SETTINGS (Detailed)

### Text Channel
- Phone number: +1 (650) 218-7127
- "Ask [Persona] with [Model] over text"
- Register multiple phone numbers
- All registered numbers can receive texts
- Unassociated numbers can also text back

### Email Channel
- Email: philipbankier@zo.computer
- "Ask [Persona] with [Model] over email"
- "Let Zo respond to emails sent to [email] from any allowed email address"
- "Add allowed sender" — whitelist emails
- Account email shown: philip@mailai.live
- Link to connect Gmail for sending on behalf

### Telegram Channel
- "Ask [Persona] with [Model] over Telegram"
- Bot: @zo_computer_bot
- "Connect your Telegram account to chat with Zo via Telegram"
- "Send messages to @zo_computer_bot and receive replies"

---

## INTEGRATIONS SETTINGS (Detailed)

### Connections Sub-tab
Full list of integrations with descriptions:
| Integration | Description |
|-------------|-------------|
| Gmail | Read, send, and manage emails and drafts in Gmail |
| Calendar | View and manage events in Google Calendar |
| Drive | Access files in Google Drive, including Docs, Sheets, Slides, and Forms |
| Notion | Access and manage pages, databases, and workspaces in Notion |
| Dropbox | Access and manage files in your Dropbox account |
| OneDrive | Access and manage files in Microsoft OneDrive |
| Tasks | Access and manage task lists and tasks in Google Tasks |
| Airtable | Access and manage bases, tables, and records in Airtable |
| Linear | Manage issues, projects, and teams in Linear |
| Microsoft Outlook | Read, send, and manage emails in Microsoft Outlook |
| Spotify | Search, play, and manage playlists and library in Spotify |
| LinkedIn | Use your LinkedIn account with Zo (skill-based) |
| Twitter | Use your Twitter account with Zo (skill-based) |

Note: "Zo Computer partners with Pipedream (SOC 2 compliant)"
Note: "Want to connect something else? Just ask Zo to build a custom integration"

### Browser Sub-tab
- "Zo's browser" — AI has its own browser
- "Log into sites you want Zo to access"
- "Open Zo's browser" button
- Shows logged-in sites (empty state: "No logged-in sites detected yet")

### Payments Sub-tab
- Sub-tabs: Account | Products | Orders
- "Connect Stripe Account" flow
- Country selector (cannot change after creation)
- "Create Account" button
- View documentation link
- "Sell products and manage orders" description

---

## UX SETTINGS (Detailed)

### Theme System (20+ themes!)
Standard: Light | Dark | System
Named themes: Espreszo, In the Zone, Claude Zo, T3 Zo, Root Zone, Comfort Zone, Garbanzo, Intermezzo, Why Zo Serious, Protozoa, All Systems Zo, Ozone, ZOTech, LFZ, Hadal Zone, ZOMG, Zo Hot Right Now, Zodiac, Zombocom, Zo Cool

### Keybindings
- "Configure shortcuts" button (customizable)

### Developer Options
- "Show hidden files and folders" toggle
- Description: "Show hidden files and folders – typically used by developers"

---

## ADVANCED SETTINGS (Detailed)

### Secrets
- Environment variables for scripts and routes
- Key-Value format
- Supports pasting .env content
- Description: "Environment variables available to Zo when running scripts and routes. Use these for third-party API keys, tokens, and other credentials."

### Access Tokens
- Named tokens (e.g., "Home Laptop", "Project Z")
- Used for MCP and HTTP API authentication
- Links to MCP docs and HTTP API docs

### Danger Zone
- "Permanently delete your account and all associated data"
- Delete Account button

---

## HOSTING PAGE (Detailed — previously called "Sites")

- "New Site" button + "More create options" dropdown
- Search bar: "Search sites and services"
- Site cards:
  - Site name (e.g., "openclaw-saas")
  - Public URL (e.g., https://zite-50972-philipbankier.zo.computer)
  - Actions button (menu)
- Stripe promotion banner: "Accept payments on sites with Stripe. No additional fees."

---

## DATASETS PAGE (New — not in docs!)

- "Create dataset" button (prominent)
- Description: "Turn messy exports into structured datasets you can explore. Zo can organize, document, and analyze your data so you can ask better questions, build charts, and discover patterns."
- Blog post link
- Uses DuckDB under the hood
- Format: datapackage.json + schema.yaml + data.duckdb

---

## SYSTEM PAGE (Server Management)

### Stats Tab
- Physical Cores: 3 @ 2.6GHz
- Architecture: x86_64
- Operating System: Linux 6.12
- Processes: 17
- Uptime: 1h 25m
- Memory: 0.9 GB of 4.0 GB used (22.8%)
- Network Speed: "Run test" button

### Restore Tab
- System restore capability

### Reboot Tab
- Restart server

Note: "Hardware specs can change dynamically depending on the workloads you run and the plan that you're subscribed to"
