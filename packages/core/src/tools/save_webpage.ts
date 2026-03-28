import fs from 'node:fs/promises';
import path from 'node:path';
import { ToolDefinition } from './types.js';
import { env } from '../lib/env.js';

export const saveWebpage: ToolDefinition<{ url: string }> = {
  name: 'save_webpage',
  description: 'Fetch a URL, convert to markdown, and save under workspace/articles/',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  async execute({ url }) {
    const res = await fetch(url);
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
    const md = `# Saved Article\n\nSource: ${url}\n\n${text}`;
    const dir = path.resolve(env.WORKSPACE_DIR, 'articles');
    await fs.mkdir(dir, { recursive: true });
    const slug = (url.replace(/https?:\/\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '') || 'article').slice(0, 80);
    const file = path.join(dir, `${Date.now()}-${slug}.md`);
    await fs.writeFile(file, md, 'utf8');
    return { saved: true, path: path.relative(env.WORKSPACE_DIR, file) };
  },
};
