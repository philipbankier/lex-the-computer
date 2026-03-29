# Codex Task: Lex the Computer — Phase 8: Channels (Multi-Surface Access)

## Overview
Build the **Channels** system — a plugin architecture that lets users access their Lex AI from Telegram, Email, Discord, and SMS. Each channel receives messages, routes them through the AI conversation engine, and sends responses back. Channels auto-enable when their env vars are configured.

## Reference Docs
Read these files in `docs/` before starting:
- `ARCHITECTURE.md` — full system architecture
- `PLAN.md` — Phase 8 section
- `UI-AUDIT.md` — how Zo Computer implements Channels

## What Already Exists (Phases 0–7 complete)
- Full monorepo with chat, files, automations, sites, space, skills, integrations, public API
- Settings page with Channels tab (currently a shell)
- Automation system with delivery methods (can be extended for channel delivery)
- Per-persona model configuration already exists in chat system

## Phase 8 Requirements

### Database Schema
Add to Drizzle schema:

```typescript
// Channel connections
channels: {
  id: uuid primaryKey
  userId: uuid references users
  type: enum('telegram', 'email', 'discord', 'sms')
  config: jsonb not null          // provider-specific config (bot token, chat ID, email address, etc.)
  personaId: uuid references personas  // per-channel persona (optional)
  isActive: boolean default true
  pairedAt: timestamp
  updatedAt: timestamp
}

// Channel message log (for debugging/history)
channel_messages: {
  id: uuid primaryKey
  channelId: uuid references channels
  direction: enum('inbound', 'outbound')
  externalId: text               // provider message ID
  content: text
  conversationId: uuid references conversations  // linked AI conversation
  createdAt: timestamp
}
```

### Backend (packages/core)

#### Channel Plugin Architecture

Create a common interface all channel plugins implement:

```typescript
// services/channels/base.ts
interface ChannelPlugin {
  type: string;
  isConfigured(): boolean;          // check if env vars present
  initialize(): Promise<void>;       // start listening (webhook/polling)
  shutdown(): Promise<void>;         // stop listening
  sendMessage(channelId: string, message: string, attachments?: Buffer[]): Promise<void>;
  handleInbound(raw: any): Promise<{ userId: string; text: string; attachments?: any[] }>;
}
```

**Plugin registration** in core startup:
1. Check env vars for each channel type
2. If configured, initialize the plugin (start webhook/polling)
3. Register plugin in a channel registry for AI tool access

**Message flow:**
1. Inbound message arrives (webhook/poll)
2. Plugin parses → finds or creates user channel connection
3. Finds or creates conversation for this channel
4. Sends message through AI chat engine (same as web chat)
5. AI response sent back through channel plugin
6. Log both directions to channel_messages

#### Telegram Bot (`services/channels/telegram.ts`)
- Uses `grammy` library (lightweight Telegram bot framework for Node.js)
- **Env vars**: `TELEGRAM_BOT_TOKEN`
- **Pairing flow**:
  - User clicks "Connect Telegram" in settings
  - Shows unique pairing code
  - User sends pairing code to bot in Telegram
  - Bot verifies code → links Telegram chat ID to user
- **Features**:
  - Text messages → AI conversation → text response
  - File attachments: receive files from user (download + save to workspace), send files back
  - Markdown formatting in responses
  - Long message splitting (Telegram 4096 char limit)
  - `/start` command → pairing instructions
  - `/new` command → start new conversation
  - `/persona <name>` → switch persona

#### Email Channel (`services/channels/email.ts`)
- **Env vars**: `EMAIL_PROVIDER` (cloudflare|postal|mailgun), `EMAIL_DOMAIN`, `EMAIL_API_KEY`, plus provider-specific vars
- **Per-user email**: `{handle}@{EMAIL_DOMAIN}` (handle from Space settings or username)
- **Inbound**:
  - Webhook endpoint: `POST /api/channels/email/inbound`
  - Parse email (from, subject, body as text)
  - Route to user by recipient address
  - Create/continue conversation (subject as conversation title)
  - AI processes → response sent as reply email
- **Outbound**:
  - Send via configured provider API
  - Proper email headers (Reply-To, References, In-Reply-To for threading)
- **Provider adapters**:
  - Cloudflare Email Workers: webhook parsing
  - Postal: REST API for send, webhook for receive
  - Mailgun: REST API for send, webhook for receive

#### Discord Bot (`services/channels/discord.ts`)
- Uses `discord.js` library
- **Env vars**: `DISCORD_BOT_TOKEN`, `DISCORD_APPLICATION_ID`
- **Pairing flow**:
  - User clicks "Connect Discord" in settings
  - Shows bot invite link + pairing code
  - User DMs bot with pairing code
  - Bot verifies → links Discord user ID to Lex user
- **Features**:
  - DM messages → AI conversation → DM response
  - File attachments (send + receive)
  - Markdown formatting
  - Message splitting (Discord 2000 char limit)
  - Slash commands: `/new` (new conversation), `/persona` (switch)

#### SMS Channel (`services/channels/sms.ts`)
- Uses Twilio API
- **Env vars**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- **Pairing flow**:
  - User enters phone number in settings
  - Verification code sent via SMS
  - User enters code → links phone to account
- **Features**:
  - Inbound: Twilio webhook → `POST /api/channels/sms/inbound`
  - Parse message → AI conversation → respond via Twilio send
  - SMS length handling (split long messages or truncate with "... (continued in app)")
  - MMS support for image attachments (receive)

#### Channel Settings API (`/api/channels`)
- `GET /api/channels` — list user's channel connections
- `POST /api/channels/:type/pair` — start pairing flow (returns code/instructions)
- `POST /api/channels/:type/verify` — verify pairing code
- `DELETE /api/channels/:id` — disconnect channel
- `PUT /api/channels/:id` — update settings (persona, active toggle)
- `POST /api/channels/:id/test` — send test message through channel
- `GET /api/channels/available` — list which channels are configured (env vars present)

#### AI Tools
- `send-email` — params: to, subject, body, cc?, bcc? (uses email channel or Gmail integration)
- `send-telegram` — params: message, channelId? (sends to user's connected Telegram)
- `send-discord` — params: message, channelId? (sends to user's connected Discord)
- `send-sms` — params: message, phoneNumber? (sends via Twilio)

#### Automation Channel Delivery
Extend the automation delivery system to support channels:
- When an automation completes, it can deliver results via:
  - Chat (existing)
  - Email (new)
  - Telegram (new)
  - Discord (new)
  - SMS (new)
- Automation form gets a "Delivery Channel" multi-select

### Frontend (packages/web)

#### Channels Settings Tab
Replace the Channels shell in Settings:

**Available Channels Grid:**
Each channel type gets a card:

- **Telegram** card:
  - Status: Connected/Not Connected
  - If not connected: "Connect" button → shows pairing code + QR code + bot username
  - If connected: shows Telegram username, "Test" button, "Disconnect" button
  - Persona selector dropdown
  - Active toggle

- **Email** card:
  - Status: shows assigned email address (`handle@domain`)
  - If not configured: "Email not configured" + instructions
  - If configured: "Test" button (sends test email to user's account email)
  - Persona selector

- **Discord** card:
  - Status: Connected/Not Connected
  - If not connected: "Connect" button → shows bot invite link + pairing code
  - If connected: shows Discord username, "Test" button, "Disconnect"
  - Persona selector

- **SMS** card:
  - Status: Connected/Not Connected
  - If not connected: phone number input + "Verify" button → sends code
  - Verification code input → "Confirm"
  - If connected: shows phone number, "Test", "Disconnect"
  - Persona selector

**Per-Channel Persona Configuration:**
- Dropdown to select persona for each channel
- "Use default" option (uses whatever persona is active in web chat)
- Brief explanation: "Choose how the AI responds on this channel"

## Implementation Order

1. Database: add channels + channel_messages tables, generate migration
2. Backend: Channel plugin base interface + registry
3. Backend: Telegram bot plugin (grammy, pairing, message handling)
4. Backend: Email channel plugin (multi-provider, inbound webhook, outbound)
5. Backend: Discord bot plugin (discord.js, pairing, DMs)
6. Backend: SMS channel plugin (Twilio, verification, webhooks)
7. Backend: Channel settings API (pair, verify, disconnect, test)
8. Backend: AI tools (send-email, send-telegram, send-discord, send-sms)
9. Backend: Extend automation delivery for channel support
10. Frontend: Channels settings tab with all 4 channel cards
11. Frontend: Pairing flows (modals/dialogs for each channel)
12. Frontend: Per-channel persona selectors
13. Wire webhook routes + channel initialization in core startup

## Acceptance Criteria
- [ ] Channel plugin architecture works (auto-enable from env vars)
- [ ] Telegram: pair via code → send message → get AI response
- [ ] Email: inbound webhook → AI processes → reply email sent
- [ ] Discord: pair via code → DM bot → get AI response
- [ ] SMS: verify phone → text message → get AI response
- [ ] Per-channel persona support works
- [ ] AI tools can send messages through each channel
- [ ] Automation delivery works via channels
- [ ] Channel settings UI shows status, connect/disconnect, test
- [ ] Both `packages/web` and `packages/core` build clean

## What NOT to Build Yet
- Voice messages / audio in channels
- Group chat support (only DMs/direct messages)
- Channel-specific rich formatting (buttons, cards, etc.)
- Onboarding (Phase 9)
- Advanced features (Phase 10)
