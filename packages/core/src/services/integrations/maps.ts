// Phase 10: Google Maps / Places API service

import { env } from '../../lib/env.js';

const API = 'https://maps.googleapis.com/maps/api';

function requireKey() {
  if (!env.GOOGLE_MAPS_API_KEY) throw new Error('GOOGLE_MAPS_API_KEY is not configured.');
  return env.GOOGLE_MAPS_API_KEY;
}

export async function searchPlaces(query: string, location?: string): Promise<any[]> {
  const key = requireKey();
  const params = new URLSearchParams({
    query,
    key,
    ...(location ? { location } : {}),
  });
  const res = await fetch(`${API}/place/textsearch/json?${params}`);
  if (!res.ok) throw new Error(`Google Maps API error: ${res.status}`);
  const data = await res.json();
  return (data.results || []).slice(0, 10).map((p: any) => ({
    place_id: p.place_id,
    name: p.name,
    address: p.formatted_address,
    rating: p.rating,
    user_ratings_total: p.user_ratings_total,
    types: p.types,
    location: p.geometry?.location,
    open_now: p.opening_hours?.open_now,
  }));
}

export async function getPlaceDetails(placeId: string): Promise<any> {
  const key = requireKey();
  const params = new URLSearchParams({
    place_id: placeId,
    key,
    fields: 'name,formatted_address,formatted_phone_number,website,rating,reviews,opening_hours,geometry,photos,price_level',
  });
  const res = await fetch(`${API}/place/details/json?${params}`);
  if (!res.ok) throw new Error(`Google Maps API error: ${res.status}`);
  const data = await res.json();
  const p = data.result;
  return {
    name: p.name,
    address: p.formatted_address,
    phone: p.formatted_phone_number,
    website: p.website,
    rating: p.rating,
    price_level: p.price_level,
    hours: p.opening_hours?.weekday_text,
    reviews: (p.reviews || []).slice(0, 5).map((r: any) => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text?.slice(0, 200),
      time: r.relative_time_description,
    })),
  };
}

export async function getDirections(from: string, to: string, mode: string = 'driving'): Promise<any> {
  const key = requireKey();
  const params = new URLSearchParams({ origin: from, destination: to, mode, key });
  const res = await fetch(`${API}/directions/json?${params}`);
  if (!res.ok) throw new Error(`Google Maps API error: ${res.status}`);
  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) return { error: 'No route found' };
  const leg = route.legs[0];
  return {
    distance: leg.distance?.text,
    duration: leg.duration?.text,
    start_address: leg.start_address,
    end_address: leg.end_address,
    steps: (leg.steps || []).map((s: any) => ({
      instruction: s.html_instructions?.replace(/<[^>]*>/g, ''),
      distance: s.distance?.text,
      duration: s.duration?.text,
    })),
  };
}
