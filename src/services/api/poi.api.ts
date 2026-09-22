import type { LatLng } from '../../utils/polyline';
import type { FreeMapViewRegion, PoiCategory } from '../../components/map/FreeMapView.types';

// Overpass API — queries OpenStreetMap's own places database directly. Free,
// keyless, but rate-limited hard (light/evaluation traffic only, same as OSM's
// tile server) — several public mirrors exist precisely because any one of
// them alone rate-limits quickly under normal panning. Tried in order; a 429
// or network failure on one falls through to the next rather than surfacing
// an error immediately.
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
];

// Short-lived client-side cache so panning back over recently-seen ground
// doesn't re-hit Overpass at all — keyed by a coarse rounded center (~0.002°,
// roughly 200m) plus the active category set.
const CACHE_TTL_MS = 2 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; results: PoiResult[] }>();

function cacheKey(region: FreeMapViewRegion, categories: PoiCategory[]): string {
  const round = (n: number) => Math.round(n * 500) / 500;
  return `${round(region.latitude)},${round(region.longitude)}|${[...categories].sort().join(',')}`;
}

export interface PoiResult {
  id: string;
  name: string;
  category: PoiCategory;
  coords: LatLng;
}

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: { name?: string; amenity?: string; shop?: string };
}

export function regionToBbox(region: FreeMapViewRegion) {
  return {
    south: region.latitude - region.latitudeDelta / 2,
    north: region.latitude + region.latitudeDelta / 2,
    west: region.longitude - region.longitudeDelta / 2,
    east: region.longitude + region.longitudeDelta / 2,
  };
}

function clauseFor(category: PoiCategory, bboxStr: string): string {
  if (category === 'restaurant') return `node["amenity"="restaurant"](${bboxStr});`;
  if (category === 'cafe') return `node["amenity"="cafe"](${bboxStr});`;
  if (category === 'hospital') return `node["amenity"="hospital"](${bboxStr});`;
  return `node["shop"="bakery"](${bboxStr});`;
}

async function queryOverpass(query: string): Promise<OverpassElement[]> {
  let lastError: unknown;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (response.status === 429) {
        lastError = new Error('Overpass rate-limited');
        continue;
      }
      if (!response.ok) {
        throw new Error(`Overpass query failed: ${response.status}`);
      }
      const data = await response.json();
      return data.elements ?? [];
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Overpass query failed');
}

export async function fetchNearbyPlaces(
  region: FreeMapViewRegion,
  categories: PoiCategory[]
): Promise<PoiResult[]> {
  if (categories.length === 0) return [];

  const key = cacheKey(region, categories);
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const { south, west, north, east } = regionToBbox(region);
  const bboxStr = `${south},${west},${north},${east}`;
  const clauses = categories.map((c) => clauseFor(c, bboxStr)).join('\n');
  const query = `[out:json][timeout:15];(${clauses});out body 60;`;

  const elements = await queryOverpass(query);

  const results = elements
    .filter((el): el is OverpassElement & { tags: { name: string } } => Boolean(el.tags?.name))
    .map((el) => {
      let category: PoiCategory = 'restaurant';
      if (el.tags.amenity === 'cafe') category = 'cafe';
      else if (el.tags.amenity === 'hospital') category = 'hospital';
      else if (el.tags.shop === 'bakery') category = 'bakery';
      return {
        id: String(el.id),
        name: el.tags.name,
        category,
        coords: { latitude: el.lat, longitude: el.lon },
      };
    });

  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, results });
  return results;
}
