import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://www.googleapis.com/calendar/v3';

async function calFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...opts?.headers },
  });
  if (!res.ok) throw new Error(`Calendar API error: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function listEvents(integrationId: number, startDate: string, endDate: string, maxResults = 25) {
  const params = new URLSearchParams({
    timeMin: new Date(startDate).toISOString(),
    timeMax: new Date(endDate).toISOString(),
    maxResults: String(maxResults),
    singleEvents: 'true',
    orderBy: 'startTime',
  });
  const data = await calFetch(integrationId, `/calendars/primary/events?${params}`);
  return (data.items || []).map((e: any) => ({
    id: e.id,
    summary: e.summary,
    description: e.description,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location,
    attendees: (e.attendees || []).map((a: any) => a.email),
    htmlLink: e.htmlLink,
  }));
}

export async function getEvent(integrationId: number, eventId: string) {
  const e = await calFetch(integrationId, `/calendars/primary/events/${eventId}`);
  return {
    id: e.id,
    summary: e.summary,
    description: e.description,
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    location: e.location,
    attendees: (e.attendees || []).map((a: any) => ({ email: a.email, responseStatus: a.responseStatus })),
    htmlLink: e.htmlLink,
    status: e.status,
    created: e.created,
    updated: e.updated,
  };
}

export async function createEvent(integrationId: number, title: string, start: string, end: string, description?: string, attendees?: string[]) {
  const body: any = {
    summary: title,
    start: { dateTime: new Date(start).toISOString() },
    end: { dateTime: new Date(end).toISOString() },
  };
  if (description) body.description = description;
  if (attendees?.length) body.attendees = attendees.map(email => ({ email }));

  const e = await calFetch(integrationId, '/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return { id: e.id, summary: e.summary, htmlLink: e.htmlLink, created: true };
}

export async function updateEvent(integrationId: number, eventId: string, updates: { title?: string; start?: string; end?: string; description?: string }) {
  const body: any = {};
  if (updates.title) body.summary = updates.title;
  if (updates.start) body.start = { dateTime: new Date(updates.start).toISOString() };
  if (updates.end) body.end = { dateTime: new Date(updates.end).toISOString() };
  if (updates.description !== undefined) body.description = updates.description;

  const e = await calFetch(integrationId, `/calendars/primary/events/${eventId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return { id: e.id, summary: e.summary, updated: true };
}

export async function deleteEvent(integrationId: number, eventId: string) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}/calendars/primary/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 204) throw new Error(`Calendar delete error: ${res.status}`);
  return { deleted: true };
}
