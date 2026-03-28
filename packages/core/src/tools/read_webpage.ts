import { ToolDefinition } from './types.js';

export const readWebpage: ToolDefinition<{ url: string }> = {
  name: 'read_webpage',
  description: 'Fetch a URL and extract text content',
  parameters: {
    type: 'object',
    properties: { url: { type: 'string' } },
    required: ['url'],
  },
  async execute({ url }) {
    const res = await fetch(url);
    const html = await res.text();
    // Minimal extraction: strip tags
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ');
    return { text: text.trim().replace(/\s+/g, ' ').slice(0, 10000) };
  },
};

