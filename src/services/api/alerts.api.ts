import { apiClient } from './client';
import type { PeerAlert } from '../../types/models';

// Self-alerts (SOS) are intentionally out of scope — see CLAUDE.md. This
// module only covers private, trip-scoped peer alerts.

export async function sendPeerAlert(
  groupId: string,
  tripId: string,
  recipientId: string,
  message: string,
  replyToId?: string
): Promise<PeerAlert> {
  const { data } = await apiClient.post<PeerAlert>(`/groups/${groupId}/trips/${tripId}/alerts`, {
    recipientId,
    message,
    replyToId,
  });
  return data;
}

// The private thread between the current user and one other trip member.
export async function getPeerAlertThread(groupId: string, tripId: string, withUserId: string): Promise<PeerAlert[]> {
  const { data } = await apiClient.get<PeerAlert[]>(`/groups/${groupId}/trips/${tripId}/alerts`, {
    params: { withUserId },
  });
  return data;
}

export async function markPeerAlertSeen(groupId: string, tripId: string, alertId: string): Promise<PeerAlert> {
  const { data } = await apiClient.patch<PeerAlert>(`/groups/${groupId}/trips/${tripId}/alerts/${alertId}/seen`);
  return data;
}

// Per-sender unread alert counts waiting for me in this trip — seeds the
// map's persistent unread-count avatar badge on load (see useAlertStore's
// unreadCounts, which this seeds rather than owns).
export async function getUnseenAlertCounts(groupId: string, tripId: string): Promise<Record<string, number>> {
  const { data } = await apiClient.get<Record<string, number>>(`/groups/${groupId}/trips/${tripId}/alerts/unseen`);
  return data;
}
