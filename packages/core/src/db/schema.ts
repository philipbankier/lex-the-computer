import { pgTable, serial, varchar, timestamp, boolean, jsonb, integer, text } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  handle: varchar('handle', { length: 64 }),
  name: varchar('name', { length: 255 }),
  bio: text('bio'),
  avatar: text('avatar'),
  settings: jsonb('settings'),
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

export const automations = pgTable('automations', {
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

export const automation_runs = pgTable('automation_runs', {
  id: serial('id').primaryKey(),
  automation_id: integer('automation_id').notNull(),
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
  scopes: text('scopes'),
  permissions: jsonb('permissions'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expires_at: timestamp('expires_at', { withTimezone: true }),
});

export const api_keys = pgTable('api_keys', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  key_hash: text('key_hash').notNull(),
  name: varchar('name', { length: 255 }),
  last_used: timestamp('last_used', { withTimezone: true }),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const skills = pgTable('skills', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  directory: text('directory'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
  path: text('path'),
  created_at: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
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
