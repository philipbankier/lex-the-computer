// Notion uses internal integration tokens (API key), not OAuth2
const API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

async function notionFetch(token: string, path: string, opts?: RequestInit) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`Notion API error: ${res.status} ${await res.text()}`);
  return res.json();
}

// Convert Notion rich text to plain text
function richTextToPlain(richText: any[]): string {
  return (richText || []).map((r: any) => r.plain_text || '').join('');
}

// Convert Notion blocks to markdown
function blocksToMarkdown(blocks: any[]): string {
  return blocks.map((b: any) => {
    const type = b.type;
    const data = b[type];
    if (!data) return '';
    switch (type) {
      case 'paragraph': return richTextToPlain(data.rich_text);
      case 'heading_1': return `# ${richTextToPlain(data.rich_text)}`;
      case 'heading_2': return `## ${richTextToPlain(data.rich_text)}`;
      case 'heading_3': return `### ${richTextToPlain(data.rich_text)}`;
      case 'bulleted_list_item': return `- ${richTextToPlain(data.rich_text)}`;
      case 'numbered_list_item': return `1. ${richTextToPlain(data.rich_text)}`;
      case 'to_do': return `- [${data.checked ? 'x' : ' '}] ${richTextToPlain(data.rich_text)}`;
      case 'code': return `\`\`\`${data.language || ''}\n${richTextToPlain(data.rich_text)}\n\`\`\``;
      case 'quote': return `> ${richTextToPlain(data.rich_text)}`;
      case 'divider': return '---';
      default: return richTextToPlain(data.rich_text || []);
    }
  }).filter(Boolean).join('\n\n');
}

export async function searchPages(token: string, query: string) {
  const data = await notionFetch(token, '/search', {
    method: 'POST',
    body: JSON.stringify({ query, filter: { value: 'page', property: 'object' }, page_size: 10 }),
  });
  return (data.results || []).map((p: any) => ({
    id: p.id,
    title: richTextToPlain(p.properties?.title?.title || p.properties?.Name?.title || []),
    url: p.url,
    lastEdited: p.last_edited_time,
    icon: p.icon?.emoji || p.icon?.external?.url || null,
  }));
}

export async function getPage(token: string, pageId: string) {
  const [page, blocksData] = await Promise.all([
    notionFetch(token, `/pages/${pageId}`),
    notionFetch(token, `/blocks/${pageId}/children?page_size=100`),
  ]);

  const title = richTextToPlain(page.properties?.title?.title || page.properties?.Name?.title || []);
  const content = blocksToMarkdown(blocksData.results || []);

  return { id: page.id, title, url: page.url, content, lastEdited: page.last_edited_time };
}

export async function createPage(token: string, parentId: string, title: string, content: string) {
  // Determine parent type (page or database)
  const isDatabase = parentId.length === 32 || parentId.includes('-');

  const body: any = {
    parent: isDatabase ? { database_id: parentId } : { page_id: parentId },
    properties: isDatabase
      ? { Name: { title: [{ text: { content: title } }] } }
      : { title: { title: [{ text: { content: title } }] } },
    children: content.split('\n').filter(Boolean).map(line => ({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ type: 'text', text: { content: line } }] },
    })),
  };

  const page = await notionFetch(token, '/pages', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return { id: page.id, url: page.url, created: true };
}

export async function updatePage(token: string, pageId: string, content: string) {
  // Append new blocks to the page
  const children = content.split('\n').filter(Boolean).map(line => ({
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: line } }] },
  }));

  await notionFetch(token, `/blocks/${pageId}/children`, {
    method: 'PATCH',
    body: JSON.stringify({ children }),
  });

  return { id: pageId, updated: true };
}

export async function listDatabases(token: string) {
  const data = await notionFetch(token, '/search', {
    method: 'POST',
    body: JSON.stringify({ filter: { value: 'database', property: 'object' }, page_size: 20 }),
  });
  return (data.results || []).map((db: any) => ({
    id: db.id,
    title: richTextToPlain(db.title || []),
    url: db.url,
    properties: Object.keys(db.properties || {}),
  }));
}

export async function queryDatabase(token: string, dbId: string, filter?: any) {
  const body: any = { page_size: 25 };
  if (filter) body.filter = filter;

  const data = await notionFetch(token, `/databases/${dbId}/query`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  return (data.results || []).map((row: any) => {
    const props: any = {};
    for (const [key, val] of Object.entries(row.properties || {})) {
      const v = val as any;
      switch (v.type) {
        case 'title': props[key] = richTextToPlain(v.title); break;
        case 'rich_text': props[key] = richTextToPlain(v.rich_text); break;
        case 'number': props[key] = v.number; break;
        case 'select': props[key] = v.select?.name; break;
        case 'multi_select': props[key] = (v.multi_select || []).map((s: any) => s.name); break;
        case 'date': props[key] = v.date?.start; break;
        case 'checkbox': props[key] = v.checkbox; break;
        case 'url': props[key] = v.url; break;
        case 'email': props[key] = v.email; break;
        case 'status': props[key] = v.status?.name; break;
        default: props[key] = JSON.stringify(v[v.type]);
      }
    }
    return { id: row.id, url: row.url, properties: props };
  });
}
