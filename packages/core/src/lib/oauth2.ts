import { env } from './env.js';
import { getDb, schema } from './db.js';
import { eq } from 'drizzle-orm';

// Provider-specific OAuth2 configurations
export type OAuthProviderConfig = {
  provider: string;
  authUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  scopes: { read: string[]; readwrite: string[] };
  // For extracting account info from the token response or userinfo endpoint
  userinfoUrl?: string;
  parseUserinfo?: (data: any) => { email?: string; name?: string; avatar?: string };
};

const GOOGLE_PROVIDERS: Record<string, OAuthProviderConfig> = {
  gmail: {
    provider: 'gmail',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    scopes: {
      read: ['https://www.googleapis.com/auth/gmail.readonly', 'openid', 'email', 'profile'],
      readwrite: ['https://www.googleapis.com/auth/gmail.modify', 'https://www.googleapis.com/auth/gmail.send', 'openid', 'email', 'profile'],
    },
    userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    parseUserinfo: (d: any) => ({ email: d.email, name: d.name, avatar: d.picture }),
  },
  'google-calendar': {
    provider: 'google-calendar',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    scopes: {
      read: ['https://www.googleapis.com/auth/calendar.readonly', 'openid', 'email', 'profile'],
      readwrite: ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email', 'profile'],
    },
    userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    parseUserinfo: (d: any) => ({ email: d.email, name: d.name, avatar: d.picture }),
  },
  'google-drive': {
    provider: 'google-drive',
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    scopes: {
      read: ['https://www.googleapis.com/auth/drive.readonly', 'openid', 'email', 'profile'],
      readwrite: ['https://www.googleapis.com/auth/drive.file', 'openid', 'email', 'profile'],
    },
    userinfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    parseUserinfo: (d: any) => ({ email: d.email, name: d.name, avatar: d.picture }),
  },
};

const OTHER_PROVIDERS: Record<string, OAuthProviderConfig> = {
  dropbox: {
    provider: 'dropbox',
    authUrl: 'https://www.dropbox.com/oauth2/authorize',
    tokenUrl: 'https://api.dropboxapi.com/oauth2/token',
    clientId: env.DROPBOX_CLIENT_ID,
    clientSecret: env.DROPBOX_CLIENT_SECRET,
    scopes: {
      read: ['files.metadata.read', 'files.content.read'],
      readwrite: ['files.metadata.read', 'files.content.read', 'files.content.write'],
    },
    userinfoUrl: 'https://api.dropboxapi.com/2/users/get_current_account',
    parseUserinfo: (d: any) => ({ email: d.email, name: d.name?.display_name, avatar: d.profile_photo_url }),
  },
  linear: {
    provider: 'linear',
    authUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    clientId: env.LINEAR_CLIENT_ID,
    clientSecret: env.LINEAR_CLIENT_SECRET,
    scopes: {
      read: ['read'],
      readwrite: ['read', 'write'],
    },
  },
  github: {
    provider: 'github',
    authUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    scopes: {
      read: ['repo', 'user'],
      readwrite: ['repo', 'user'],
    },
    userinfoUrl: 'https://api.github.com/user',
    parseUserinfo: (d: any) => ({ email: d.email, name: d.name || d.login, avatar: d.avatar_url }),
  },
};

export const PROVIDER_CONFIGS: Record<string, OAuthProviderConfig> = {
  ...GOOGLE_PROVIDERS,
  ...OTHER_PROVIDERS,
};

// Notion uses internal integration tokens, not OAuth2
export const TOKEN_PROVIDERS = ['notion'] as const;

export function getProviderConfig(provider: string): OAuthProviderConfig | undefined {
  return PROVIDER_CONFIGS[provider];
}

export function isConfigured(provider: string): boolean {
  if (provider === 'notion') return true; // token-based, always available
  const config = PROVIDER_CONFIGS[provider];
  if (!config) return false;
  return !!(config.clientId && config.clientSecret);
}

export function buildAuthUrl(provider: string, permission: 'read' | 'readwrite' = 'readwrite'): string {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const redirectUri = `${env.BASE_URL}/api/integrations/${provider}/callback`;
  const scopes = config.scopes[permission];
  const state = JSON.stringify({ provider, permission });

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    state,
    access_type: 'offline', // Google-specific but harmless for others
    prompt: 'consent',
  });

  // Dropbox needs token_access_type for refresh tokens
  if (provider === 'dropbox') {
    params.set('token_access_type', 'offline');
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function exchangeCode(provider: string, code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config) throw new Error(`Unknown provider: ${provider}`);

  const redirectUri = `${env.BASE_URL}/api/integrations/${provider}/callback`;

  const body: Record<string, string> = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  // GitHub returns JSON with Accept header
  if (provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed for ${provider}: ${res.status} ${text}`);
  }

  return res.json();
}

export async function refreshAccessToken(integrationId: number): Promise<string> {
  const db = await getDb();
  const [integration] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, integrationId)).limit(1);
  if (!integration) throw new Error('Integration not found');

  // Token-based providers don't need refresh
  if (TOKEN_PROVIDERS.includes(integration.provider as any)) {
    return integration.access_token!;
  }

  // Check if token is still valid (with 5 min buffer)
  if (integration.token_expires_at) {
    const expiresAt = new Date(integration.token_expires_at).getTime();
    if (Date.now() < expiresAt - 5 * 60 * 1000) {
      return integration.access_token!;
    }
  }

  // No refresh token? Return current token and hope for the best
  if (!integration.refresh_token) {
    return integration.access_token!;
  }

  const config = PROVIDER_CONFIGS[integration.provider];
  if (!config) throw new Error(`Unknown provider: ${integration.provider}`);

  const body: Record<string, string> = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: integration.refresh_token,
    grant_type: 'refresh_token',
  };

  const headers: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (integration.provider === 'github') {
    headers['Accept'] = 'application/json';
  }

  const res = await fetch(config.tokenUrl, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body).toString(),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed for ${integration.provider}: ${res.status}`);
  }

  const tokens = await res.json();

  const updates: any = {
    access_token: tokens.access_token,
    updated_at: new Date(),
  };
  if (tokens.refresh_token) updates.refresh_token = tokens.refresh_token;
  if (tokens.expires_in) {
    updates.token_expires_at = new Date(Date.now() + tokens.expires_in * 1000);
  }

  await db.update(schema.integrations).set(updates).where(eq(schema.integrations.id, integrationId));
  return tokens.access_token;
}

export async function fetchUserinfo(provider: string, accessToken: string): Promise<{ email?: string; name?: string; avatar?: string }> {
  const config = PROVIDER_CONFIGS[provider];
  if (!config?.userinfoUrl || !config?.parseUserinfo) return {};

  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };

  // Dropbox userinfo is a POST with no body
  const method = provider === 'dropbox' ? 'POST' : 'GET';
  const fetchOpts: RequestInit = { method, headers };
  if (provider === 'dropbox') {
    // Dropbox requires null body for this endpoint
  }

  try {
    const res = await fetch(config.userinfoUrl, fetchOpts);
    if (!res.ok) return {};
    const data = await res.json();
    return config.parseUserinfo(data);
  } catch {
    return {};
  }
}

// Get a valid access token for an integration (auto-refreshes if needed)
export async function getAccessToken(integrationId: number): Promise<string> {
  return refreshAccessToken(integrationId);
}

// Get integration by ID, verify it belongs to user and is active
export async function getIntegration(integrationId: number, userId: number) {
  const db = await getDb();
  const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, integrationId)).limit(1);
  if (!row || row.user_id !== userId || !row.is_active) return null;
  return row;
}

// Find active integration by provider for a user
export async function findIntegration(userId: number, provider: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.integrations)
    .where(eq(schema.integrations.user_id, userId))
    .limit(50);
  return rows.find(r => r.provider === provider && r.is_active);
}

// List all providers with their configuration status
export function listProviders() {
  const all = ['gmail', 'google-calendar', 'google-drive', 'notion', 'dropbox', 'linear', 'github'];
  return all.map(p => ({
    provider: p,
    configured: isConfigured(p),
    type: TOKEN_PROVIDERS.includes(p as any) ? 'token' : 'oauth2',
  }));
}
