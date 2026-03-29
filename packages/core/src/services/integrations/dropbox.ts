import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://api.dropboxapi.com/2';
const CONTENT_API = 'https://content.dropboxapi.com/2';

async function dbxFetch(integrationId: number, path: string, body?: any) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`Dropbox API error: ${res.status} ${await res.text()}`);
  // Some Dropbox endpoints return empty body
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function searchFiles(integrationId: number, query: string, maxResults = 10) {
  const data = await dbxFetch(integrationId, '/files/search_v2', {
    query,
    options: { max_results: maxResults, file_status: 'active' },
  });
  return (data.matches || []).map((m: any) => {
    const meta = m.metadata?.metadata || {};
    return {
      id: meta.id,
      name: meta.name,
      path: meta.path_display,
      size: meta.size,
      modified: meta.server_modified || meta.client_modified,
      isFolder: meta['.tag'] === 'folder',
    };
  });
}

export async function getFile(integrationId: number, filePath: string) {
  const data = await dbxFetch(integrationId, '/files/get_metadata', { path: filePath });
  return {
    id: data.id,
    name: data.name,
    path: data.path_display,
    size: data.size,
    modified: data.server_modified || data.client_modified,
    isFolder: data['.tag'] === 'folder',
  };
}

export async function downloadFile(integrationId: number, filePath: string): Promise<string> {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${CONTENT_API}/files/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Dropbox-API-Arg': JSON.stringify({ path: filePath }),
    },
  });
  if (!res.ok) throw new Error(`Dropbox download error: ${res.status}`);
  return res.text();
}

export async function uploadFile(integrationId: number, filePath: string, content: string) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${CONTENT_API}/files/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path: filePath,
        mode: 'overwrite',
        autorename: true,
      }),
    },
    body: content,
  });
  if (!res.ok) throw new Error(`Dropbox upload error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, name: data.name, path: data.path_display, uploaded: true };
}
