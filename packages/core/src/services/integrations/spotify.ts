// Phase 10: Spotify integration (OAuth2)

import { getAccessToken } from '../../lib/oauth2.js';

const API = 'https://api.spotify.com/v1';

async function spotifyFetch(integrationId: number, path: string, opts?: RequestInit) {
  const token = await getAccessToken(integrationId);
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...opts?.headers,
    },
  });
  if (!res.ok) throw new Error(`Spotify API error: ${res.status} ${await res.text()}`);
  if (res.status === 204) return {};
  return res.json();
}

export async function searchTracks(integrationId: number, query: string): Promise<any[]> {
  const data = await spotifyFetch(integrationId, `/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
  return (data.tracks?.items || []).map((t: any) => ({
    id: t.id,
    name: t.name,
    artist: t.artists?.map((a: any) => a.name).join(', '),
    album: t.album?.name,
    duration_ms: t.duration_ms,
    uri: t.uri,
    preview_url: t.preview_url,
  }));
}

export async function getCurrentPlayback(integrationId: number): Promise<any> {
  const data = await spotifyFetch(integrationId, '/me/player');
  if (!data || !data.item) return { playing: false };
  return {
    playing: data.is_playing,
    track: data.item.name,
    artist: data.item.artists?.map((a: any) => a.name).join(', '),
    album: data.item.album?.name,
    progress_ms: data.progress_ms,
    duration_ms: data.item.duration_ms,
    device: data.device?.name,
  };
}

export async function getPlaylists(integrationId: number): Promise<any[]> {
  const data = await spotifyFetch(integrationId, '/me/playlists?limit=20');
  return (data.items || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    tracks_total: p.tracks?.total,
    uri: p.uri,
    public: p.public,
  }));
}

export async function play(integrationId: number, uri?: string): Promise<any> {
  const body = uri ? JSON.stringify({ uris: [uri] }) : undefined;
  await spotifyFetch(integrationId, '/me/player/play', { method: 'PUT', body });
  return { playing: true };
}

export async function pause(integrationId: number): Promise<any> {
  await spotifyFetch(integrationId, '/me/player/pause', { method: 'PUT' });
  return { paused: true };
}

export async function skipNext(integrationId: number): Promise<any> {
  await spotifyFetch(integrationId, '/me/player/next', { method: 'POST' });
  return { skipped: true };
}
