import { ToolDefinition } from './types.js';

// Very simple search stub; replace with Brave/Serp API if key is present
export const webSearch: ToolDefinition<{ query: string }> = {
  name: 'web_search',
  description: 'Search the web for current information',
  parameters: {
    type: 'object',
    properties: { query: { type: 'string' } },
    required: ['query'],
  },
  async execute({ query }) {
    const BRAVE_KEY = process.env.BRAVE_API_KEY;
    const SERP_KEY = process.env.SERPAPI_KEY;
    try {
      if (BRAVE_KEY) {
        const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`, {
          headers: { 'X-Subscription-Token': BRAVE_KEY },
        });
        const json = await res.json();
        return json;
      }
      if (SERP_KEY) {
        const res = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${SERP_KEY}`);
        const json = await res.json();
        return json;
      }
      return { note: 'No API key configured; returning mock results', results: [{ title: 'Example result', url: 'https://example.com' }] };
    } catch (e: any) {
      return { error: e?.message || 'search failed' };
    }
  },
};

