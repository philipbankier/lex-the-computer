// Phase 10: Google Maps tool

import { ToolDefinition } from './types.js';
import * as maps from '../services/integrations/maps.js';

export const searchMapsTool: ToolDefinition<{
  query: string;
  location?: string;
  action?: 'search' | 'details' | 'directions';
  place_id?: string;
  from?: string;
  to?: string;
  mode?: string;
}> = {
  name: 'search_maps',
  description: 'Search Google Maps for places, get place details, or get directions. Requires GOOGLE_MAPS_API_KEY.',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query (for search action)' },
      location: { type: 'string', description: 'Location hint for search (e.g. "40.7128,-74.0060")' },
      action: { type: 'string', enum: ['search', 'details', 'directions'], description: 'Action to perform (default: search)' },
      place_id: { type: 'string', description: 'Google Place ID (for details action)' },
      from: { type: 'string', description: 'Starting point (for directions action)' },
      to: { type: 'string', description: 'Destination (for directions action)' },
      mode: { type: 'string', description: 'Travel mode: driving, walking, bicycling, transit (default: driving)' },
    },
    required: ['query'],
  },
  async execute(params) {
    const action = params.action || 'search';
    switch (action) {
      case 'search': return maps.searchPlaces(params.query, params.location);
      case 'details': {
        if (!params.place_id) throw new Error('place_id required for details action');
        return maps.getPlaceDetails(params.place_id);
      }
      case 'directions': {
        const from = params.from || params.query;
        if (!params.to) throw new Error('to required for directions action');
        return maps.getDirections(from, params.to, params.mode);
      }
      default: throw new Error(`Unknown action: ${action}`);
    }
  },
};
