import { apiClient } from './client';
import type { ChatMessage } from '../../types/models';

export async function sendChatMessage(groupId: string, body: string): Promise<ChatMessage> {
  const { data } = await apiClient.post<ChatMessage>(`/groups/${groupId}/chat`, { body });
  return data;
}

// Backend returns newest-first, capped at its own page size — callers that
// want chronological order (e.g. useGroupChat's seed fetch) reverse this.
export async function getChatHistory(groupId: string, before?: string): Promise<ChatMessage[]> {
  const { data } = await apiClient.get<ChatMessage[]>(`/groups/${groupId}/chat`, { params: before ? { before } : undefined });
  return data;
}
