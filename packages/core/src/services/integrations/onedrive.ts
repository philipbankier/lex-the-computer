// Phase 10: OneDrive integration (Microsoft OAuth2)

import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://graph.microsoft.com/v1.0';

async function graphFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`Microsoft Graph API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function searchFiles(integrationId: number, query: string): Promise<any[]> {
  const data = await graphFetch(integrationId, `/me/drive/root/search(q='${encodeURIComponent(query)}')?$top=10`);
  return (data.value || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    size: f.size,
    web_url: f.webUrl,
    last_modified: f.lastModifiedDateTime,
    mime_type: f.file?.mimeType,
    folder: !!f.folder,
  }));
}

export async function getFile(integrationId: number, itemId: string): Promise<any> {
  const data = await graphFetch(integrationId, `/me/drive/items/${itemId}`);
  return {
    id: data.id,
    name: data.name,
    size: data.size,
    web_url: data.webUrl,
    last_modified: data.lastModifiedDateTime,
    created: data.createdDateTime,
    mime_type: data.file?.mimeType,
    download_url: data['@microsoft.graph.downloadUrl'],
  };
}

export async function downloadFile(integrationId: number, itemId: string): Promise<string> {
  const file = await getFile(integrationId, itemId);
  if (!file.download_url) throw new Error('No download URL available');
  const res = await fetch(file.download_url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const text = await res.text();
  return text.slice(0, 50000);
}

export async function uploadFile(integrationId: number, filePath: string, content: string): Promise<any> {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}/me/drive/root:/${filePath}:/content`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: content,
  });
  if (!res.ok) throw new Error(`OneDrive upload failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return { id: data.id, name: data.name, web_url: data.webUrl };
}
