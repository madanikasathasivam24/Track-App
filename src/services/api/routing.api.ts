import { apiClient } from './client';
import type { LatLng } from '../../utils/polyline';

export interface PlaceSuggestion {
  id: string;
  description: string;
}

export interface RouteStep {
  instruction: string;
  maneuver: string | null;
  encodedPolyline: string;
}

export interface Route {
  distanceMeters: number;
  durationSeconds: number;
  encodedPolyline: string;
  steps?: RouteStep[];
}

// Proxied through the backend (GET /places/autocomplete) rather than called
// directly against Google's Places API the way the old ORS-based version
// called ORS directly: Google's key-restriction options (app package/bundle
// ID, HTTP referrer) don't cover a plain fetch() the way they cover an SDK
// call, so a client-embedded Places key would be directly usable by anyone
// straight out of the app bundle against a billed API — see the backend's
// PlacesService for where the key actually lives. Switched from ORS because
// ORS's OpenStreetMap-backed geocoder has much thinner coverage of small
// local businesses than Google's Places database.
export async function autocompletePlaces(input: string, bias: LatLng | null): Promise<PlaceSuggestion[]> {
  if (!input.trim()) return [];

  const params: Record<string, string> = { text: input };
  if (bias) {
    params.lat = String(bias.latitude);
    params.lng = String(bias.longitude);
  }

  const { data } = await apiClient.get<{ placeId: string; description: string }[]>('/places/autocomplete', {
    params,
  });
  return data.map((p) => ({ id: p.placeId, description: p.description }));
}

// Places Autocomplete (New) only returns a placeId + text per suggestion, not
// coordinates — this second round trip (only made once, when a suggestion is
// actually selected, not per keystroke) resolves the coordinates.
export async function getPlaceLocation(placeId: string): Promise<LatLng> {
  const { data } = await apiClient.get<LatLng | null>(`/places/${encodeURIComponent(placeId)}`);
  if (!data) throw new Error('Could not resolve that place');
  return data;
}

// Proxied through the backend (POST /routing/directions) rather than called
// directly against Google's Routes API the way autocompletePlaces above
// calls ORS directly: Google's key-restriction options (app package/bundle
// ID, HTTP referrer) don't cover a plain fetch() the way they cover an SDK
// call, so a client-embedded Routes key would be directly usable by anyone
// straight out of the app bundle against a billed API — see the backend's
// GoogleRoutingService/RoutingController for where the key actually lives.
export interface RouteOptions {
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  // ISO 8601 timestamp — route by arrival time instead of departure time.
  arrivalTime?: string;
}

export async function getRoute(waypoints: LatLng[], options?: RouteOptions): Promise<Route> {
  if (waypoints.length < 2) {
    throw new Error('Need at least an origin and a destination');
  }

  const { data } = await apiClient.post<Route>('/routing/directions', {
    waypoints: waypoints.map((w) => ({ lat: w.latitude, lng: w.longitude })),
    avoidTolls: options?.avoidTolls,
    avoidHighways: options?.avoidHighways,
    arrivalTime: options?.arrivalTime,
  });
  return data;
}
