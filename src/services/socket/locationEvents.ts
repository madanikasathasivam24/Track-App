import type { Socket } from 'socket.io-client';
import { decodePolyline } from '../../utils/polyline';
import type { TripMemberPosition } from '../../types/models';

// Emit/listen wrappers for trip-scoped live location — a member's position
// (and freshly-computed route-to-destination) is relayed to every other
// member of the same trip, distinct from friendLocationEvents.ts's
// friend-graph broadcast (`friend:location:update`/`friend:location`).

// The wire shape the backend sends (both over the socket and from the
// GET .../locations seed-fetch REST endpoint) — id/routeGeometry get renamed
// and decoded into TripMemberPosition's userId/routeCoords.
export interface TripLocationWirePayload {
  tripId: string;
  id: string;
  name: string;
  avatarIndex: number;
  trackId: string;
  latitude: number;
  longitude: number;
  routeGeometry: string | null;
  routeDurationSeconds: number | null;
  lastUpdatedAt: string;
}

export function toTripMemberPosition(payload: TripLocationWirePayload): TripMemberPosition {
  return {
    tripId: payload.tripId,
    userId: payload.id,
    name: payload.name,
    avatarIndex: payload.avatarIndex,
    trackId: payload.trackId,
    latitude: payload.latitude,
    longitude: payload.longitude,
    routeCoords: payload.routeGeometry ? decodePolyline(payload.routeGeometry) : undefined,
    routeDurationSeconds: payload.routeDurationSeconds ?? undefined,
    lastUpdatedAt: payload.lastUpdatedAt,
  };
}

export function emitLocationUpdate(
  socket: Socket,
  tripId: string,
  coords: { latitude: number; longitude: number }
): void {
  socket.emit('location:update', { tripId, ...coords });
}

export function onMemberPosition(socket: Socket, callback: (member: TripMemberPosition) => void): () => void {
  const handler = (payload: TripLocationWirePayload) => callback(toTripMemberPosition(payload));
  socket.on('location:member', handler);
  return () => socket.off('location:member', handler);
}
