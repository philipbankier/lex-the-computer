// Phase 10: Airtable integration (API key based)

import { env } from '../../lib/env.js';

const API = 'https://api.airtable.com/v0';

function requireKey() {
  if (!env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY is not configured.');
  return env.AIRTABLE_API_KEY;
}

async function airtableFetch(path: string, opts?: RequestInit) {
  const key = requireKey();
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`Airtable API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listBases(): Promise<any[]> {
  const data = await airtableFetch('/meta/bases');
  return (data.bases || []).map((b: any) => ({
    id: b.id,
    name: b.name,
    permission_level: b.permissionLevel,
  }));
}

export async function listTables(baseId: string): Promise<any[]> {
  const data = await airtableFetch(`/meta/bases/${baseId}/tables`);
  return (data.tables || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    fields: (t.fields || []).map((f: any) => ({ id: f.id, name: f.name, type: f.type })),
  }));
}

export async function listRecords(baseId: string, tableId: string, filter?: string): Promise<any[]> {
  const params = new URLSearchParams();
  if (filter) params.set('filterByFormula', filter);
  params.set('maxRecords', '100');
  const data = await airtableFetch(`/${baseId}/${tableId}?${params}`);
  return (data.records || []).map((r: any) => ({
    id: r.id,
    fields: r.fields,
    created_time: r.createdTime,
  }));
}

export async function createRecord(baseId: string, tableId: string, fields: Record<string, any>): Promise<any> {
  const data = await airtableFetch(`/${baseId}/${tableId}`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
  return { id: data.id, fields: data.fields };
}

export async function updateRecord(baseId: string, tableId: string, recordId: string, fields: Record<string, any>): Promise<any> {
  const data = await airtableFetch(`/${baseId}/${tableId}/${recordId}`, {
    method: 'PATCH',
    body: JSON.stringify({ fields }),
  });
  return { id: data.id, fields: data.fields };
}
