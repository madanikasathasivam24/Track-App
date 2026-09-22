import { apiClient } from './client';
import type { FriendRequestItem, PublicUser } from '../../types/models';

export async function searchUserByTrackId(trackId: string): Promise<PublicUser> {
  const { data } = await apiClient.get<PublicUser>('/users/search', { params: { trackId } });
  return data;
}

export async function sendFriendRequest(trackId: string): Promise<void> {
  await apiClient.post('/friends/request', { trackId });
}

export async function getFriendRequests(): Promise<FriendRequestItem[]> {
  const { data } = await apiClient.get<Array<{ id: string; userA?: PublicUser | null }>>('/friends/requests');
  // Defensively drop any entry missing a sender rather than letting the list
  // crash on a malformed item (e.g. the sender's account was deleted).
  return data.filter((item): item is FriendRequestItem => Boolean(item.userA));
}

export async function respondToFriendRequest(requestId: string, action: 'accept' | 'decline'): Promise<void> {
  await apiClient.patch(`/friends/request/${requestId}`, { action });
}

export async function getFriends(): Promise<PublicUser[]> {
  const { data } = await apiClient.get<PublicUser[]>('/friends');
  return data;
}

export async function unfriend(friendId: string): Promise<void> {
  await apiClient.delete(`/friends/${friendId}`);
}
