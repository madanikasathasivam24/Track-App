import { apiClient } from './client';

export interface FriendLocation {
  id: string;
  name: string;
  avatarIndex: number;
  trackId: string;
  latitude: number;
  longitude: number;
  updatedAt: string | null;
}

// Mutual sharing: starting/stopping targets a specific friend by id, and
// either friend can call either endpoint — there's one shared state per pair,
// not a one-directional sender/recipient session.
export async function startLiveShare(friendId: string): Promise<void> {
  await apiClient.post(`/live-share/${friendId}`);
}

export async function stopLiveShare(friendId: string): Promise<void> {
  await apiClient.delete(`/live-share/${friendId}`);
}

// Friend ids the current user has an active mutual share with.
export async function getActiveShareFriendIds(): Promise<string[]> {
  const { data } = await apiClient.get<string[]>('/live-share');
  return data;
}

// A friend's last broadcast position — only available while sharing is active.
export async function getFriendLocation(friendId: string): Promise<FriendLocation> {
  const { data } = await apiClient.get<FriendLocation>(`/live-share/${friendId}/location`);
  return data;
}
