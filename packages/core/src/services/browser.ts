// AI Browser service using Playwright + Stagehand
// Manages headless browser instances with persistent contexts
// Stagehand adds natural language act()/extract()/observe() on top of Playwright

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
      pw = await (Function('return import("playwright")')() as Promise<any>);
    } catch {
      throw new Error('Playwright is not installed. Run: npx playwright install chromium');
    }
  }
  return pw;
}

// Lazy-load Stagehand for AI-powered browser interactions
let _stagehandMod: any = null;
async function getStagehandModule() {
  if (_stagehandMod) return _stagehandMod;
  try {
    _stagehandMod = await (Function('return import("@browserbasehq/stagehand")')() as Promise<any>);
    return _stagehandMod;
  } catch {
    return null;
  }
}

// Browser pool: one persistent context per user
const browserPool: Map<number, { browser: any; context: any; page: any }> = new Map();

// Stagehand pool: one instance per user (for AI interactions)
const stagehandPool: Map<number, any> = new Map();

async function getOrCreateContext(userId: number) {
  if (browserPool.has(userId)) {
    const entry = browserPool.get(userId)!;
    try {
      await entry.page.title();
      return entry;
    } catch {
      try { await entry.browser.close(); } catch {}
      browserPool.delete(userId);
    }
  }

  const { chromium } = await getPlaywright();

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

async function getOrCreateStagehand(userId: number) {
  if (stagehandPool.has(userId)) {
    const sh = stagehandPool.get(userId)!;
    try {
      await sh.page.title();
      return sh;
    } catch {
      try { await sh.close(); } catch {}
      stagehandPool.delete(userId);
    }
  }

  const mod = await getStagehandModule();
  if (!mod) throw new Error('Stagehand is not installed. Run: pnpm add @browserbasehq/stagehand');

  const Stagehand = mod.Stagehand || mod.default?.Stagehand || mod.default;
  const stagehand = new Stagehand({ env: 'LOCAL' });
  await stagehand.init();
  stagehandPool.set(userId, stagehand);
  return stagehand;
}

// === Standard Playwright operations ===

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

// === Stagehand AI operations ===

export async function stagehandAct(url: string | undefined, action: string): Promise<{ success: boolean; url: string }> {
  const stagehand = await getOrCreateStagehand(USER_ID);
  if (url) {
    await stagehand.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  await stagehand.act({ action });
  return { success: true, url: stagehand.page.url() };
}

export async function stagehandExtract(url: string | undefined, instruction: string): Promise<{ data: any; url: string }> {
  const stagehand = await getOrCreateStagehand(USER_ID);
  if (url) {
    await stagehand.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  // Extract with a generic schema — Stagehand returns structured data
  const data = await stagehand.extract({ instruction });
  return { data, url: stagehand.page.url() };
}

export async function stagehandObserve(url: string | undefined, instruction: string): Promise<{ elements: any[]; url: string }> {
  const stagehand = await getOrCreateStagehand(USER_ID);
  if (url) {
    await stagehand.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  const elements = await stagehand.observe({ instruction });
  return { elements, url: stagehand.page.url() };
}

// === Session management ===

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
  const sh = stagehandPool.get(USER_ID);
  if (sh) {
    try { await sh.close(); } catch {}
    stagehandPool.delete(USER_ID);
  }
}
