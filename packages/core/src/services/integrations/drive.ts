import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://www.googleapis.com/drive/v3';

async function driveFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(`Drive API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function searchFiles(integrationId: number, query: string, maxResults = 10) {
  const q = `name contains '${query.replace(/'/g, "\\'")}'`;
  const params = new URLSearchParams({
    q,
    pageSize: String(maxResults),
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,parents)',
  });
  const data = await driveFetch(integrationId, `/files?${params}`);
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size ? Number(f.size) : undefined,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
  }));
}

export async function getFile(integrationId: number, fileId: string) {
  const data = await driveFetch(integrationId, `/files/${fileId}?fields=id,name,mimeType,size,modifiedTime,webViewLink,description,parents`);
  return {
    id: data.id,
    name: data.name,
    mimeType: data.mimeType,
    size: data.size ? Number(data.size) : undefined,
    modifiedTime: data.modifiedTime,
    webViewLink: data.webViewLink,
    description: data.description,
  };
}

export async function downloadFile(integrationId: number, fileId: string): Promise<string> {
  const token = await getAccessToken(integrationId);

  // First check if it's a Google Docs file that needs export
  const meta = await driveFetch(integrationId, `/files/${fileId}?fields=mimeType,name`);

  let url: string;
  if (meta.mimeType.startsWith('application/vnd.google-apps.')) {
    // Export Google Docs files
    const exportMime = meta.mimeType === 'application/vnd.google-apps.spreadsheet'
      ? 'text/csv'
      : 'text/plain';
    url = `${API}/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`;
  } else {
    url = `${API}/files/${fileId}?alt=media`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Drive download error: ${res.status}`);
  return res.text();
}

export async function uploadFile(integrationId: number, name: string, content: string, mimeType: string, folderId?: string) {
  const token = await getAccessToken(integrationId);

  // Multipart upload: metadata + content
  const metadata: any = { name, mimeType };
  if (folderId) metadata.parents = [folderId];

  const boundary = '---lex-upload-boundary---';
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}`,
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) throw new Error(`Drive upload error: ${res.status} ${await res.text()}`);
  const f = await res.json();
  return { id: f.id, name: f.name, webViewLink: f.webViewLink, uploaded: true };
}
