import { apiClient } from './client';
import type { LatLng } from '../../utils/polyline';

export interface DirectionSearchRecord {
  id: string;
  originLabel: string;
  originLat: number;
  originLng: number;
  destLabel: string;
  destLat: number;
  destLng: number;
  distanceMeters: number;
  durationSeconds: number;
  startedAt: string | null;
  isSaved: boolean;
  createdAt: string;
}

export interface CreateDirectionSearchPayload {
  origin: LatLng;
  originLabel: string;
  destination: LatLng;
  destLabel: string;
  distanceMeters: number;
  durationSeconds: number;
}

export async function createDirectionSearch(payload: CreateDirectionSearchPayload): Promise<DirectionSearchRecord> {
  const { data } = await apiClient.post<DirectionSearchRecord>('/direction-history', {
    originLabel: payload.originLabel,
    originLat: payload.origin.latitude,
    originLng: payload.origin.longitude,
    destLabel: payload.destLabel,
    destLat: payload.destination.latitude,
    destLng: payload.destination.longitude,
    distanceMeters: Math.round(payload.distanceMeters),
    durationSeconds: Math.round(payload.durationSeconds),
  });
  return data;
}

export async function getRecentDirectionSearches(): Promise<DirectionSearchRecord[]> {
  const { data } = await apiClient.get<DirectionSearchRecord[]>('/direction-history');
  return data;
}

export async function markDirectionSearchStarted(id: string): Promise<void> {
  await apiClient.patch(`/direction-history/${id}/start`);
}

export async function getSavedDirectionSearches(): Promise<DirectionSearchRecord[]> {
  const { data } = await apiClient.get<DirectionSearchRecord[]>('/direction-history/saved');
  return data;
}

export async function saveDirectionSearch(id: string): Promise<DirectionSearchRecord> {
  const { data } = await apiClient.patch<DirectionSearchRecord>(`/direction-history/${id}/save`);
  return data;
}

export async function unsaveDirectionSearch(id: string): Promise<DirectionSearchRecord> {
  const { data } = await apiClient.patch<DirectionSearchRecord>(`/direction-history/${id}/unsave`);
  return data;
}
