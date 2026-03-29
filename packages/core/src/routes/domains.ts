// Custom Domains API — manage custom domains for sites, spaces, and services
// Integrates with Caddy for auto-HTTPS

import { Hono } from 'hono';
import { getDb, schema } from '../lib/db.js';
import { randomUUID } from 'node:crypto';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import dns from 'node:dns/promises';

const execAsync = promisify(exec);

export const domainsRouter = new Hono();

const userIdFromCtx = () => 1; // Phase 0 placeholder

// POST /api/domains — add a custom domain
domainsRouter.post('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const body = await c.req.json();

  const { domain, target_type, target_id } = body;
  if (!domain || !target_type) {
    return c.json({ error: 'domain and target_type are required' }, 400);
  }

  // Validate target_type
  if (!['site', 'space', 'service'].includes(target_type)) {
    return c.json({ error: 'target_type must be site, space, or service' }, 400);
  }

  // Generate verification token
  const verification_token = `lex-verify-${randomUUID().slice(0, 12)}`;

  const [row] = await db.insert(schema.custom_domains).values({
    user_id: userId,
    domain: domain.toLowerCase().trim(),
    target_type,
    target_id: target_id || null,
    verified: false,
    verification_token,
    ssl_status: 'pending',
  } as any).returning();

  return c.json({
    domain: row,
    dns_instructions: {
      cname: { type: 'CNAME', name: domain, value: 'your-lex-server.example.com' },
      txt: { type: 'TXT', name: `_lex-verification.${domain}`, value: verification_token },
    },
  });
});

// GET /api/domains — list user's domains
domainsRouter.get('/', async (c) => {
  const db = await getDb();
  const userId = userIdFromCtx();
  const rows = await db.select().from(schema.custom_domains).where({ user_id: userId } as any);
  return c.json(rows);
});

// POST /api/domains/:id/verify — check DNS and verify domain
domainsRouter.post('/:id/verify', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const row = (await db.select().from(schema.custom_domains).where({ id } as any).limit(1))[0];
  if (!row) return c.json({ error: 'Not found' }, 404);

  try {
    // Check TXT record
    const txtRecords = await dns.resolveTxt(`_lex-verification.${row.domain}`).catch(() => []);
    const flatRecords = txtRecords.flat();
    const verified = flatRecords.some(r => r === row.verification_token);

    if (verified) {
      // Update domain as verified
      const [updated] = await db.update(schema.custom_domains)
        .set({ verified: true, ssl_status: 'active', updated_at: new Date() } as any)
        .where({ id } as any).returning();

      // Try to update Caddy config
      await updateCaddyConfig(row.domain, row.target_type, row.target_id).catch(() => {});

      return c.json({ verified: true, domain: updated });
    }

    return c.json({
      verified: false,
      expected_record: { type: 'TXT', name: `_lex-verification.${row.domain}`, value: row.verification_token },
      found_records: flatRecords,
    });
  } catch (e: any) {
    return c.json({ verified: false, error: `DNS lookup failed: ${e.message}` });
  }
});

// DELETE /api/domains/:id — remove domain
domainsRouter.delete('/:id', async (c) => {
  const db = await getDb();
  const id = Number(c.req.param('id'));
  const row = (await db.select().from(schema.custom_domains).where({ id } as any).limit(1))[0];
  if (row) {
    await removeCaddyConfig(row.domain).catch(() => {});
  }
  await db.delete(schema.custom_domains).where({ id } as any);
  return c.json({ ok: true });
});

// Caddy integration helpers

async function updateCaddyConfig(domain: string, targetType: string, targetId: number | null) {
  // Determine the upstream based on target type
  let upstream = 'localhost:3000'; // default to web frontend
  if (targetType === 'service' && targetId) {
    const db = await getDb();
    const svc = (await db.select().from(schema.services).where({ id: targetId } as any).limit(1))[0];
    if (svc?.port) upstream = `localhost:${svc.port}`;
  }

  // Generate Caddyfile snippet
  const snippet = `${domain} {\n  reverse_proxy ${upstream}\n}\n`;

  // Try to add to Caddy via API (if Caddy admin API is available)
  try {
    await fetch('http://localhost:2019/config/apps/http/servers/srv0/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        match: [{ host: [domain] }],
        handle: [{ handler: 'reverse_proxy', upstreams: [{ dial: upstream }] }],
      }),
    });
  } catch {
    // Caddy admin API not available — write to Caddyfile instead
    try {
      const caddyDir = '/etc/caddy/conf.d';
      await execAsync(`mkdir -p ${caddyDir}`).catch(() => {});
      const filePath = `${caddyDir}/lex-${domain.replace(/\./g, '-')}.caddy`;
      await execAsync(`echo '${snippet}' > ${filePath} && caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true`, { timeout: 10000 });
    } catch {
      // Silent fail — user may need to configure Caddy manually
    }
  }
}

async function removeCaddyConfig(domain: string) {
  try {
    const caddyDir = '/etc/caddy/conf.d';
    const filePath = `${caddyDir}/lex-${domain.replace(/\./g, '-')}.caddy`;
    await execAsync(`rm -f ${filePath} && caddy reload --config /etc/caddy/Caddyfile 2>/dev/null || true`, { timeout: 10000 });
  } catch {
    // Silent fail
  }
}
