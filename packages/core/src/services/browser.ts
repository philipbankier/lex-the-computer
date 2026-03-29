// Phase 10: AI Browser service using Playwright
// Manages headless browser instances with persistent contexts

import { env } from '../lib/env.js';
import { getDb, schema } from '../lib/db.js';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs/promises';

const USER_ID = 1; // Phase 0 placeholder

// Lazy-load playwright to avoid hard dependency if not installed
let pw: any = null;
async function getPlaywright() {
  if (!pw) {
    try {
      // Dynamic import to avoid hard dependency
      pw = await (Function('return import("playwright")')() as Promise<any>);
    } catch {
      throw new Error('Playwright is not installed. Run: npx playwright install chromium');
    }
  }
  return pw;
}

// Browser pool: one persistent context per user
const browserPool: Map<number, { browser: any; context: any; page: any }> = new Map();

async function getOrCreateContext(userId: number) {
  if (browserPool.has(userId)) {
    const entry = browserPool.get(userId)!;
    try {
      // Test if page is still open
      await entry.page.title();
      return entry;
    } catch {
      // Page/browser crashed, recreate
      try { await entry.browser.close(); } catch {}
      browserPool.delete(userId);
    }
  }

  const { chromium } = await getPlaywright();

  // Persistent storage directory for cookies/sessions
  const userDataDir = path.join(env.WORKSPACE_DIR, '.config', 'browser', `user-${userId}`);
  await fs.mkdir(userDataDir, { recursive: true });

  const browser = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    viewport: { width: 1280, height: 720 },
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ignoreHTTPSErrors: true,
  });

  const page = browser.pages()[0] || await browser.newPage();
  const entry = { browser, context: browser, page };
  browserPool.set(userId, entry);
  return entry;
}

export async function navigateTo(url: string): Promise<{ url: string; title: string; text: string }> {
  const { page } = await getOrCreateContext(USER_ID);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const title = await page.title();
  const text = await page.evaluate(`
    (() => {
      const body = document.body;
      if (!body) return '';
      const clone = body.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());
      return (clone.innerText || '').slice(0, 10000);
    })()
  `);
  return { url: page.url(), title, text };
}

export async function screenshot(url?: string): Promise<{ path: string; url: string }> {
  const { page } = await getOrCreateContext(USER_ID);
  if (url) {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  const filename = `screenshot-${Date.now()}.png`;
  const filePath = path.join(env.WORKSPACE_DIR, 'files', filename);
  await page.screenshot({ path: filePath, fullPage: false });
  return { path: `files/${filename}`, url: page.url() };
}

export async function clickElement(selector: string): Promise<{ clicked: boolean; url: string }> {
  const { page } = await getOrCreateContext(USER_ID);
  await page.click(selector, { timeout: 10000 });
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  return { clicked: true, url: page.url() };
}

export async function typeText(selector: string, text: string): Promise<{ typed: boolean }> {
  const { page } = await getOrCreateContext(USER_ID);
  await page.fill(selector, text, { timeout: 10000 });
  return { typed: true };
}

export async function extractContent(selector?: string): Promise<{ content: string; url: string }> {
  const { page } = await getOrCreateContext(USER_ID);
  const sel = selector || 'body';
  const content: string = await page.evaluate(`
    (() => {
      const el = document.querySelector(${JSON.stringify(sel)});
      if (!el) return '';
      const clone = el.cloneNode(true);
      clone.querySelectorAll('script, style, noscript').forEach(e => e.remove());
      return (clone.innerHTML || '').slice(0, 15000);
    })()
  `);
  return { content, url: page.url() };
}

export async function evaluateScript(code: string): Promise<{ result: any }> {
  const { page } = await getOrCreateContext(USER_ID);
  const result = await page.evaluate(code);
  return { result };
}

export async function getPageInfo(): Promise<{
  url: string; title: string;
  links: { text: string; href: string }[];
  forms: { action: string; inputs: string[] }[];
}> {
  const { page } = await getOrCreateContext(USER_ID);
  const info: any = await page.evaluate(`
    (() => {
      const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 50).map(a => ({
        text: (a.textContent || '').trim().slice(0, 100),
        href: a.href,
      }));
      const forms = Array.from(document.querySelectorAll('form')).slice(0, 10).map(f => ({
        action: f.action || '',
        inputs: Array.from(f.querySelectorAll('input, textarea, select')).map(i =>
          i.tagName.toLowerCase() + '[name=' + (i.name || '?') + ', type=' + (i.type || '?') + ']'
        ),
      }));
      return { url: window.location.href, title: document.title, links, forms };
    })()
  `);
  return info;
}

export async function listSessions(): Promise<{ sessions: { id: number; site_url: string; label: string; last_used: string }[] }> {
  const db = await getDb();
  const rows = await db.select().from(schema.browser_sessions).where(eq(schema.browser_sessions.user_id, USER_ID));
  return {
    sessions: rows.map(r => ({
      id: r.id,
      site_url: r.site_url,
      label: r.label || r.site_url,
      last_used: r.last_used?.toISOString() || '',
    })),
  };
}

export async function deleteSession(sessionId: number): Promise<{ deleted: boolean }> {
  const db = await getDb();
  await db.delete(schema.browser_sessions).where(eq(schema.browser_sessions.id, sessionId));
  return { deleted: true };
}

export async function closeBrowser(): Promise<void> {
  const entry = browserPool.get(USER_ID);
  if (entry) {
    try { await entry.browser.close(); } catch {}
    browserPool.delete(USER_ID);
  }
}
