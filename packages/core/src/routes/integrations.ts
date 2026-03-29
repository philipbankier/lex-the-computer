import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import {
  buildAuthUrl, exchangeCode, fetchUserinfo, getProviderConfig,
  isConfigured, listProviders, TOKEN_PROVIDERS,
} from '../lib/oauth2.js';
import { env } from '../lib/env.js';

export const integrationsRouter = new Hono();
const userIdFromCtx = () => 1; // Phase 0 placeholder auth

// List available providers with config status
integrationsRouter.get('/providers', (c) => {
  return c.json(listProviders());
});

// List user's connected integrations
integrationsRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.integrations).where(eq(schema.integrations.user_id, userId));
  // Strip tokens from response
  return c.json(rows.map(r => ({
    id: r.id,
    provider: r.provider,
    label: r.label,
    permission: r.permission,
    account_email: r.account_email,
    account_name: r.account_name,
    account_avatar: r.account_avatar,
    is_active: r.is_active,
    scope: r.scope,
    connected_at: r.connected_at,
    updated_at: r.updated_at,
  })));
});

// Get single integration details
integrationsRouter.get('/:id{[0-9]+}', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();
  const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id)).limit(1);
  if (!row || row.user_id !== userId) return c.json({ error: 'Not found' }, 404);
  return c.json({
    id: row.id,
    provider: row.provider,
    label: row.label,
    permission: row.permission,
    account_email: row.account_email,
    account_name: row.account_name,
    account_avatar: row.account_avatar,
    is_active: row.is_active,
    scope: row.scope,
    connected_at: row.connected_at,
    updated_at: row.updated_at,
  });
});

// Update integration (label, permission)
integrationsRouter.put('/:id{[0-9]+}', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();
  const body = await c.req.json();

  const [existing] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id)).limit(1);
  if (!existing || existing.user_id !== userId) return c.json({ error: 'Not found' }, 404);

  const updates: any = { updated_at: new Date() };
  if (body.label !== undefined) updates.label = body.label;
  if (body.permission && ['read', 'readwrite'].includes(body.permission)) updates.permission = body.permission;

  const [row] = await db.update(schema.integrations).set(updates).where(eq(schema.integrations.id, id)).returning();
  return c.json({ ok: true, integration: row });
});

// Disconnect integration
integrationsRouter.delete('/:id{[0-9]+}', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();

  const [existing] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id)).limit(1);
  if (!existing || existing.user_id !== userId) return c.json({ error: 'Not found' }, 404);

  await db.delete(schema.integrations).where(eq(schema.integrations.id, id));
  return c.json({ ok: true });
});

// Test integration connection
integrationsRouter.post('/:id{[0-9]+}/test', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const userId = userIdFromCtx();

  const [row] = await db.select().from(schema.integrations).where(eq(schema.integrations.id, id)).limit(1);
  if (!row || row.user_id !== userId) return c.json({ error: 'Not found' }, 404);
  if (!row.access_token) return c.json({ ok: false, error: 'No access token' });

  try {
    // Test by making a simple API call per provider
    const token = row.access_token;
    let result: any = { ok: true };

    switch (row.provider) {
      case 'gmail':
        await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
      case 'google-calendar':
        await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
      case 'google-drive':
        await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
      case 'notion':
        await fetch('https://api.notion.com/v1/users/me', {
          headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
      case 'dropbox':
        await fetch('https://api.dropboxapi.com/2/users/get_current_account', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
      case 'linear':
        await fetch('https://api.linear.app/graphql', {
          method: 'POST',
          headers: { Authorization: token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ viewer { id } }' }),
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
      case 'github':
        await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        }).then((r: Response) => { if (!r.ok) throw new Error(`${r.status}`); });
        break;
    }

    return c.json({ ok: true, provider: row.provider });
  } catch (e: any) {
    return c.json({ ok: false, error: e.message });
  }
});

// Start OAuth flow — redirects to provider's consent page
integrationsRouter.get('/:provider/auth', async (c) => {
  const provider = c.req.param('provider');

  if (!isConfigured(provider)) {
    return c.json({ error: `${provider} is not configured. Set client ID and secret in environment variables.` }, 400);
  }

  const permission = (c.req.query('permission') as 'read' | 'readwrite') || 'readwrite';
  const authUrl = buildAuthUrl(provider, permission);
  return c.redirect(authUrl);
});

// OAuth callback — exchanges code for tokens and saves to DB
integrationsRouter.get('/:provider/callback', async (c) => {
  const provider = c.req.param('provider');
  const code = c.req.query('code');
  const stateRaw = c.req.query('state');
  const error = c.req.query('error');

  if (error) {
    return c.html(`<html><body><h2>Authorization failed</h2><p>${error}</p><script>window.close();</script></body></html>`);
  }

  if (!code) {
    return c.json({ error: 'No authorization code received' }, 400);
  }

  let permission: 'read' | 'readwrite' = 'readwrite';
  if (stateRaw) {
    try {
      const state = JSON.parse(stateRaw);
      if (state.permission) permission = state.permission;
    } catch { /* ignore parse error */ }
  }

  try {
    const tokens = await exchangeCode(provider, code);
    const userinfo = await fetchUserinfo(provider, tokens.access_token);

    const db = await getDb();
    const userId = userIdFromCtx();

    const [integration] = await db.insert(schema.integrations).values({
      user_id: userId,
      provider,
      label: userinfo.name || userinfo.email || provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: tokens.scope || null,
      permission,
      account_email: userinfo.email || null,
      account_name: userinfo.name || null,
      account_avatar: userinfo.avatar || null,
      is_active: true,
    } as any).returning();

    // Return HTML that closes the popup and notifies the parent
    return c.html(`<html><body>
      <h2>Connected ${provider}!</h2>
      <p>You can close this window.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'integration-connected', provider: '${provider}', id: ${integration.id} }, '*');
          window.close();
        } else {
          setTimeout(() => window.location.href = '/', 2000);
        }
      </script>
    </body></html>`);
  } catch (e: any) {
    return c.html(`<html><body><h2>Connection failed</h2><p>${e.message}</p><script>setTimeout(() => window.close(), 3000);</script></body></html>`);
  }
});

// Connect Notion via token (not OAuth2)
integrationsRouter.post('/notion/connect', async (c) => {
  const body = await c.req.json();
  const token = body.token;
  if (!token) return c.json({ error: 'token required' }, 400);

  // Verify token by calling Notion API
  try {
    const res = await fetch('https://api.notion.com/v1/users/me', {
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28' },
    });
    if (!res.ok) throw new Error(`Invalid token: ${res.status}`);
    const user = await res.json();

    const db = await getDb();
    const userId = userIdFromCtx();
    const permission = body.permission || 'readwrite';

    const [integration] = await db.insert(schema.integrations).values({
      user_id: userId,
      provider: 'notion',
      label: user.name || 'Notion',
      access_token: token,
      permission,
      account_name: user.name || null,
      account_avatar: user.avatar_url || null,
      is_active: true,
    } as any).returning();

    return c.json({ ok: true, integration: { id: integration.id, provider: 'notion', account_name: user.name } });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Phase 10: Airtable connect (API key based, like Notion)
integrationsRouter.post('/airtable/connect', async (c) => {
  const body = await c.req.json();
  const token = body.token;
  if (!token) return c.json({ error: 'token required' }, 400);

  try {
    // Verify token by calling Airtable API
    const res = await fetch('https://api.airtable.com/v0/meta/whoami', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`Invalid token: ${res.status}`);
    const user = await res.json();

    const db = await getDb();
    const userId = userIdFromCtx();
    const permission = body.permission || 'readwrite';

    const [integration] = await db.insert(schema.integrations).values({
      user_id: userId,
      provider: 'airtable',
      label: user.email || 'Airtable',
      access_token: token,
      permission,
      account_email: user.email || null,
      account_name: user.email || null,
      is_active: true,
    } as any).returning();

    return c.json({ ok: true, integration: { id: integration.id, provider: 'airtable', account_email: user.email } });
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});
