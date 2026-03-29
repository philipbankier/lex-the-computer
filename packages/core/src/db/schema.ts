import { pgTable, serial, varchar, timestamp, boolean, jsonb, integer, text, bigint } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  handle: varchar('handle', { length: 64 }),
  name: varchar('name', { length: 255 }),
  bio: text('bio'),
  avatar: text('avatar'),
  settings: jsonb('settings'),
  onboarding_completed: boolean('onboarding_completed').default(false).notNull(),
  role: varchar('role', { length: 16 }).default('user').notNull(), // 'user' | 'admin'
  is_disabled: boolean('is_disabled').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 9: User profiles for onboarding
export const user_profiles = pgTable('user_profiles', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  display_name: varchar('display_name', { length: 255 }),
  bio: text('bio'),
  interests: jsonb('interests'), // string[]
  social_links: jsonb('social_links'), // { twitter, github, linkedin, website }
  avatar_url: text('avatar_url'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 9: Notifications
export const notifications = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  body: text('body'),
  type: varchar('type', { length: 32 }).notNull(), // 'agent' | 'channel' | 'system'
  read: boolean('read').default(false).notNull(),
  link: text('link'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const conversations = pgTable('conversations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  title: varchar('title', { length: 255 }),
  persona_id: integer('persona_id'),
  model: varchar('model', { length: 128 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const messages = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversation_id: integer('conversation_id').notNull(),
  role: varchar('role', { length: 16 }).notNull(),
  content: text('content').notNull(),
  tool_calls: jsonb('tool_calls'),
  tool_results: jsonb('tool_results'),
  model: varchar('model', { length: 128 }),
  tokens_in: integer('tokens_in'),
  tokens_out: integer('tokens_out'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const personas = pgTable('personas', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  prompt: text('prompt'),
  is_default: boolean('is_default').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const rules = pgTable('rules', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  condition: text('condition'),
  prompt: text('prompt'),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Agents (formerly "Automations") — SQL table kept as 'automations' for migration compat
export const agents = pgTable('automations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  instruction: text('instruction'),
  schedule: varchar('schedule', { length: 255 }),
  delivery: varchar('delivery', { length: 64 }),
  model: varchar('model', { length: 128 }),
  is_active: boolean('is_active').default(true).notNull(),
  last_run: timestamp('last_run', { withTimezone: true }),
  next_run: timestamp('next_run', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const agent_runs = pgTable('automation_runs', {
  id: serial('id').primaryKey(),
  agent_id: integer('automation_id').notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  output: text('output'),
  error: text('error'),
  started_at: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  completed_at: timestamp('completed_at', { withTimezone: true }),
});

export const sites = pgTable('sites', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 64 }).notNull(),
  framework: varchar('framework', { length: 64 }),
  is_published: boolean('is_published').default(false).notNull(),
  custom_domain: varchar('custom_domain', { length: 255 }),
  port: integer('port'),
  pid: integer('pid'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const integrations = pgTable('integrations', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  provider: varchar('provider', { length: 64 }).notNull(),
  label: varchar('label', { length: 255 }),
  access_token: text('access_token'),
  refresh_token: text('refresh_token'),
  token_expires_at: timestamp('token_expires_at', { withTimezone: true }),
  scope: text('scope'),
  permission: varchar('permission', { length: 16 }).default('readwrite').notNull(),
  account_email: text('account_email'),
  account_name: text('account_name'),
  account_avatar: text('account_avatar'),
  is_active: boolean('is_active').default(true).notNull(),
  connected_at: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const api_keys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  key_hash: text('key_hash').notNull(),
  key_prefix: varchar('key_prefix', { length: 16 }).notNull(),
  last_used_at: timestamp('last_used_at', { withTimezone: true }),
  expires_at: timestamp('expires_at', { withTimezone: true }),
  is_active: boolean('is_active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  author: varchar('author', { length: 255 }),
  version: varchar('version', { length: 64 }),
  icon: text('icon'),
  directory: text('directory'),
  source: varchar('source', { length: 16 }).default('local').notNull(), // 'local' | 'hub'
  hub_id: integer('hub_id'),
  is_active: boolean('is_active').default(true).notNull(),
  installed_at: timestamp('installed_at', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const skills_hub = pgTable('skills_hub', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  author: varchar('author', { length: 255 }),
  version: varchar('version', { length: 64 }),
  icon: text('icon'),
  tags: text('tags'), // JSON array stored as text
  repo_url: text('repo_url'),
  download_url: text('download_url'),
  downloads: integer('downloads').default(0).notNull(),
  readme: text('readme'),
  skill_md: text('skill_md'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const secrets = pgTable('secrets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  key: varchar('key', { length: 255 }).notNull(),
  value_encrypted: text('value_encrypted').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const datasets = pgTable('datasets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  source: text('source'),
  schema_def: jsonb('schema_def'), // column definitions
  row_count: integer('row_count'),
  file_path: text('file_path').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 5: Space tables
export const space_routes = pgTable('space_routes', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  path: text('path').notNull(),
  type: varchar('type', { length: 8 }).notNull(), // 'page' | 'api'
  code: text('code').notNull(),
  is_public: boolean('is_public').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const space_route_versions = pgTable('space_route_versions', {
  id: serial('id').primaryKey(),
  route_id: integer('route_id').notNull(),
  code: text('code').notNull(),
  version: integer('version').notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const space_assets = pgTable('space_assets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  filename: text('filename').notNull(),
  path: text('path').notNull(),
  mime_type: varchar('mime_type', { length: 255 }),
  size: integer('size'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const space_settings = pgTable('space_settings', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  handle: varchar('handle', { length: 64 }),
  title: varchar('title', { length: 255 }),
  description: text('description'),
  favicon: text('favicon'),
  custom_css: text('custom_css'),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const space_errors = pgTable('space_errors', {
  id: serial('id').primaryKey(),
  route_id: integer('route_id').notNull(),
  error: text('error').notNull(),
  stack: text('stack'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 8: Channels tables
export const channels = pgTable('channels', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  type: varchar('type', { length: 16 }).notNull(), // 'telegram' | 'email' | 'discord' | 'sms'
  config: jsonb('config').notNull(), // provider-specific: chat_id, email address, discord user id, phone number, etc.
  persona_id: integer('persona_id'),
  is_active: boolean('is_active').default(true).notNull(),
  paired_at: timestamp('paired_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const channel_messages = pgTable('channel_messages', {
  id: serial('id').primaryKey(),
  channel_id: integer('channel_id').notNull(),
  direction: varchar('direction', { length: 8 }).notNull(), // 'inbound' | 'outbound'
  external_id: text('external_id'),
  content: text('content'),
  conversation_id: integer('conversation_id'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 10: SSH keys
export const ssh_keys = pgTable('ssh_keys', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  host: varchar('host', { length: 255 }).notNull(),
  port: integer('port').default(22).notNull(),
  username: varchar('username', { length: 255 }).notNull(),
  private_key: text('private_key'),
  passphrase: text('passphrase'),
  fingerprint: text('fingerprint'),
  last_connected: timestamp('last_connected', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 10: Browser sessions
export const browser_sessions = pgTable('browser_sessions', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  site_url: text('site_url').notNull(),
  label: varchar('label', { length: 255 }),
  cookies: text('cookies'), // JSON stringified cookies
  last_used: timestamp('last_used', { withTimezone: true }).defaultNow().notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// AI Providers (Claude Code, Codex, Gemini CLI, BYOK, built-in)
export const ai_providers = pgTable('ai_providers', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'builtin' | 'byok' | 'claude-code' | 'codex' | 'gemini-cli'
  name: varchar('name', { length: 255 }).notNull(),
  is_enabled: boolean('is_enabled').default(false).notNull(),
  is_authenticated: boolean('is_authenticated').default(false).notNull(),
  config: jsonb('config'), // provider-specific config (API keys for BYOK, model preferences, etc.)
  default_model: text('default_model'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Custom domains for sites, spaces, and services
export const custom_domains = pgTable('custom_domains', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  domain: text('domain').notNull().unique(),
  target_type: varchar('target_type', { length: 16 }).notNull(), // 'site' | 'space' | 'service'
  target_id: integer('target_id'),
  verified: boolean('verified').default(false).notNull(),
  verification_token: text('verification_token'),
  ssl_status: varchar('ssl_status', { length: 16 }).default('pending').notNull(), // 'pending' | 'active' | 'error'
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 11: Stripe Connect Commerce
export const stripe_accounts = pgTable('stripe_accounts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  stripe_account_id: text('stripe_account_id').notNull(),
  country: varchar('country', { length: 8 }),
  onboarding_complete: boolean('onboarding_complete').default(false).notNull(),
  charges_enabled: boolean('charges_enabled').default(false).notNull(),
  payouts_enabled: boolean('payouts_enabled').default(false).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stripe_products = pgTable('stripe_products', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  stripe_product_id: text('stripe_product_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stripe_prices = pgTable('stripe_prices', {
  id: serial('id').primaryKey(),
  product_id: integer('product_id').notNull(),
  stripe_price_id: text('stripe_price_id').notNull(),
  amount: integer('amount').notNull(), // cents
  currency: varchar('currency', { length: 8 }).default('usd').notNull(),
  type: varchar('type', { length: 16 }).default('one_time').notNull(), // 'one_time' | 'recurring'
  interval: varchar('interval', { length: 16 }), // 'month' | 'year' for recurring
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stripe_payment_links = pgTable('stripe_payment_links', {
  id: serial('id').primaryKey(),
  price_id: integer('price_id').notNull(),
  stripe_payment_link_id: text('stripe_payment_link_id').notNull(),
  url: text('url').notNull(),
  active: boolean('active').default(true).notNull(),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const stripe_orders = pgTable('stripe_orders', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  stripe_session_id: text('stripe_session_id').notNull(),
  product_name: text('product_name'),
  amount: integer('amount'),
  currency: varchar('currency', { length: 8 }),
  customer_email: text('customer_email'),
  payment_status: varchar('payment_status', { length: 16 }).default('pending').notNull(), // 'pending' | 'paid' | 'failed'
  fulfillment_status: varchar('fulfillment_status', { length: 16 }).default('unfulfilled').notNull(), // 'unfulfilled' | 'fulfilled'
  paid_at: timestamp('paid_at', { withTimezone: true }),
  fulfilled_at: timestamp('fulfilled_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 11: Multi-user container isolation
export const user_containers = pgTable('user_containers', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  container_id: text('container_id'),
  status: varchar('status', { length: 16 }).default('creating').notNull(), // 'creating' | 'running' | 'stopped' | 'error'
  hostname: text('hostname'),
  cpu_limit: varchar('cpu_limit', { length: 8 }).default('1').notNull(),
  memory_limit: varchar('memory_limit', { length: 8 }).default('2g').notNull(),
  storage_limit: varchar('storage_limit', { length: 8 }).default('10g').notNull(),
  last_active_at: timestamp('last_active_at', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 11: Usage metering
export const usage_records = pgTable('usage_records', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  type: varchar('type', { length: 32 }).notNull(), // 'ai_tokens' | 'storage' | 'api_calls' | 'image_gen' | 'video_gen' | 'transcription'
  amount: bigint('amount', { mode: 'number' }).notNull(),
  metadata: jsonb('metadata'), // model, cost estimate, etc.
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Phase 4a: Services table
export const services = pgTable('services', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 8 }).notNull(), // 'http' | 'tcp'
  port: integer('port'),
  entrypoint: text('entrypoint'),
  working_dir: text('working_dir'),
  env_vars: jsonb('env_vars'),
  is_running: boolean('is_running').default(false).notNull(),
  public_url: varchar('public_url', { length: 255 }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
