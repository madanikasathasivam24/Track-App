import type { LatLng } from '../utils/polyline';

export interface User {
  id: string;
  phoneNumber: string;
  name: string;
  avatarIndex: number;
  trackId: string;
}

// Public profile shape returned by friend search/list endpoints — no phoneNumber,
// it's intentionally hidden from other users.
export interface PublicUser {
  id: string;
  name: string;
  avatarIndex: number;
  trackId: string;
}

// userA is always the requester (who sent the request) per the backend's
// userAId/userBId convention — never the current user, since GET /friends/requests
// only returns requests sent *to* you.
export interface FriendRequestItem {
  id: string;
  userA: PublicUser;
}

// A friend's last-known live position — the Friends tab's counterpart to
// TripMemberPosition below, shared over the friend-graph socket events instead
// of a trip room (see friendLocationEvents.ts).
export interface FriendPosition extends PublicUser {
  latitude: number;
  longitude: number;
  lastUpdatedAt: string;
}

// A trip member's live position, plus their cached route-to-destination
// (decoded client-side from the backend's encoded polyline) — the Friends
// tab's FriendPosition counterpart, scoped to a Trip's members instead of the
// friend graph. Distinct from GroupMemberInfo above, which is the plain REST
// membership record.
export interface TripMemberPosition {
  tripId: string;
  userId: string;
  name: string;
  avatarIndex: number;
  trackId: string;
  latitude: number;
  longitude: number;
  routeCoords?: LatLng[];
  routeDurationSeconds?: number;
  lastUpdatedAt: string;
}

export type GroupStatus = 'ACTIVE' | 'ENDED';

export interface Group {
  id: string;
  name: string;
  description?: string;
  adminId: string;
  status: GroupStatus;
  inviteCode: string;
  qrData: string;
  memberCount: number;
  isAdmin: boolean;
  joinedAt?: string;
  createdAt: string;
  endedAt?: string;
}

export interface GroupMemberInfo {
  id: string;
  name: string;
  avatarIndex: number;
  trackId: string;
  isAdmin: boolean;
  joinedAt: string;
}

export type TripStatus = 'ACTIVE' | 'ENDED';

export interface Trip {
  id: string;
  name: string;
  description?: string;
  destLat?: number;
  destLng?: number;
  destLabel?: string;
  status: TripStatus;
  creatorId: string;
  creator: PublicUser;
  memberCount: number;
  createdAt: string;
  endedAt?: string;
  hasJoined?: boolean;
}

export interface GroupDetail extends Group {
  members: GroupMemberInfo[];
  activeTrips: Trip[];
}

export interface TripMemberInfo extends PublicUser {
  joinedAt: string;
}

export interface TripDetail extends Trip {
  members: TripMemberInfo[];
}

// Persistent in-app notification inbox row — see PushDeepLinkData
// (services/notifications/push.ts) for the shape of `data`.
export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string> | null;
  isRead: boolean;
  createdAt: string;
}

// A private, trip-scoped alert between two members — a reply is just another
// row with sender/recipient swapped (see alerts.api.ts), so send and reply
// share this one shape. Self-alerts (SOS) are a separate, still-unbuilt
// feature — see CLAUDE.md.
export interface PeerAlert {
  id: string;
  groupId: string;
  tripId: string;
  senderId: string;
  recipientId: string;
  message: string;
  replyToId?: string | null;
  createdAt: string;
  seenAt?: string | null;
  sender: PublicUser;
  recipient: PublicUser;
}

// A group-wide chat message, visible to every member (as opposed to
// PeerAlert above, which is private between two people).
export interface ChatMessage {
  id: string;
  groupId: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender: PublicUser;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
