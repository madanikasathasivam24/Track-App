import { apiClient } from './client';
import type { Group, GroupDetail } from '../../types/models';

export interface CreateGroupPayload {
  name: string;
  description?: string;
}

export async function createGroup(payload: CreateGroupPayload): Promise<Group> {
  const { data } = await apiClient.post<Group>('/groups', payload);
  return data;
}

export async function joinGroupByCode(inviteCode: string): Promise<Group> {
  const { data } = await apiClient.post<Group>('/groups/join', { inviteCode });
  return data;
}

export async function getMyGroups(): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>('/groups');
  return data;
}

export async function getGroupDetail(groupId: string): Promise<GroupDetail> {
  const { data } = await apiClient.get<GroupDetail>(`/groups/${groupId}`);
  return data;
}

export async function endGroup(groupId: string): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/end`);
}

export async function deleteGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}`);
}

export async function leaveGroup(groupId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/leave`);
}
