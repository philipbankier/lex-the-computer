// Phase 10: Google Tasks integration (uses existing Google OAuth)

import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://tasks.googleapis.com/tasks/v1';

async function tasksFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`Google Tasks API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listTaskLists(integrationId: number): Promise<any[]> {
  const data = await tasksFetch(integrationId, '/users/@me/lists');
  return (data.items || []).map((l: any) => ({
    id: l.id,
    title: l.title,
    updated: l.updated,
  }));
}

export async function listTasks(integrationId: number, listId: string): Promise<any[]> {
  const data = await tasksFetch(integrationId, `/lists/${listId}/tasks?showCompleted=true&showHidden=false`);
  return (data.items || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    notes: t.notes,
    status: t.status, // 'needsAction' | 'completed'
    due: t.due,
    completed: t.completed,
    parent: t.parent,
    position: t.position,
  }));
}

export async function createTask(integrationId: number, listId: string, title: string, notes?: string, due?: string): Promise<any> {
  const body: any = { title };
  if (notes) body.notes = notes;
  if (due) body.due = due;

  const data = await tasksFetch(integrationId, `/lists/${listId}/tasks`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: data.id, title: data.title, status: data.status };
}

export async function completeTask(integrationId: number, listId: string, taskId: string): Promise<any> {
  const data = await tasksFetch(integrationId, `/lists/${listId}/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
  return { id: data.id, title: data.title, status: data.status };
}

export async function deleteTask(integrationId: number, listId: string, taskId: string): Promise<{ deleted: boolean }> {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}/lists/${listId}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete task failed: ${res.status}`);
  return { deleted: true };
}
