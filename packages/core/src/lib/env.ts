import path from 'node:path';

export const env = {
  DATABASE_URL: process.env.DATABASE_URL || '',
  LITELLM_BASE_URL: process.env.LITELLM_BASE_URL || process.env.LITELLM_URL || 'http://localhost:4000',
  WORKSPACE_DIR: process.env.WORKSPACE_DIR || path.resolve(process.cwd(), 'workspace'),
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  // Base URL for OAuth callbacks
  BASE_URL: process.env.BASE_URL || 'http://localhost:3001',
  // Google OAuth (shared across Gmail, Calendar, Drive)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  // Notion
  NOTION_CLIENT_ID: process.env.NOTION_CLIENT_ID || '',
  NOTION_CLIENT_SECRET: process.env.NOTION_CLIENT_SECRET || '',
  // Dropbox
  DROPBOX_CLIENT_ID: process.env.DROPBOX_CLIENT_ID || '',
  DROPBOX_CLIENT_SECRET: process.env.DROPBOX_CLIENT_SECRET || '',
  // Linear
  LINEAR_CLIENT_ID: process.env.LINEAR_CLIENT_ID || '',
  LINEAR_CLIENT_SECRET: process.env.LINEAR_CLIENT_SECRET || '',
  // GitHub
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET || '',
  // Phase 8: Channels
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || '',
  DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN || '',
  DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID || '',
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || '', // 'cloudflare' | 'postal' | 'mailgun'
  EMAIL_DOMAIN: process.env.EMAIL_DOMAIN || '',
  EMAIL_API_KEY: process.env.EMAIL_API_KEY || '',
  EMAIL_WEBHOOK_SECRET: process.env.EMAIL_WEBHOOK_SECRET || '',
  // Postal-specific
  POSTAL_API_URL: process.env.POSTAL_API_URL || '',
  // Mailgun-specific
  MAILGUN_DOMAIN: process.env.MAILGUN_DOMAIN || '',
  // Twilio SMS
  TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER || '',
  // Phase 10: Advanced Features
  // Image generation
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  STABILITY_API_KEY: process.env.STABILITY_API_KEY || '',
  REPLICATE_API_TOKEN: process.env.REPLICATE_API_TOKEN || '',
  // Google Maps
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || '',
  // Airtable
  AIRTABLE_API_KEY: process.env.AIRTABLE_API_KEY || '',
  // Spotify
  SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID || '',
  SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET || '',
  // Microsoft (OneDrive + Outlook)
  MICROSOFT_CLIENT_ID: process.env.MICROSOFT_CLIENT_ID || '',
  MICROSOFT_CLIENT_SECRET: process.env.MICROSOFT_CLIENT_SECRET || '',
};
