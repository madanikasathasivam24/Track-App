import { apiClient } from './client';
import { toTripMemberPosition } from '../socket/locationEvents';
import type { TripLocationWirePayload } from '../socket/locationEvents';
import type { Trip, TripDetail, TripMemberPosition } from '../../types/models';

export interface CreateTripPayload {
  name: string;
  description?: string;
  destLat?: number;
  destLng?: number;
  destLabel?: string;
}

export async function createTrip(groupId: string, payload: CreateTripPayload): Promise<Trip> {
  const { data } = await apiClient.post<Trip>(`/groups/${groupId}/trips`, payload);
  return data;
}

export async function getTrips(groupId: string): Promise<Trip[]> {
  const { data } = await apiClient.get<Trip[]>(`/groups/${groupId}/trips`);
  return data;
}

// Powers the trip info panel — members (with join times), started/ended at,
// and the rest of the trip's details beyond what the live map's route params
// already carry.
export async function getTripDetail(groupId: string, tripId: string): Promise<TripDetail> {
  const { data } = await apiClient.get<TripDetail>(`/groups/${groupId}/trips/${tripId}`);
  return data;
}

export async function joinTrip(groupId: string, tripId: string): Promise<void> {
  await apiClient.post(`/groups/${groupId}/trips/${tripId}/join`);
}

export async function endTrip(groupId: string, tripId: string): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/trips/${tripId}/end`);
}

export async function leaveTrip(groupId: string, tripId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/trips/${tripId}/leave`);
}

// Seed fetch for opening a trip's live map — every member's last known
// position (and cached route, if any) without waiting for a fresh socket tick.
export async function getTripMemberLocations(groupId: string, tripId: string): Promise<TripMemberPosition[]> {
  const { data } = await apiClient.get<TripLocationWirePayload[]>(`/groups/${groupId}/trips/${tripId}/locations`);
  return data.map(toTripMemberPosition);
}
