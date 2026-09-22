import { apiClient } from './client';

export async function registerPushToken(token: string, platform: 'android' | 'ios' | 'web'): Promise<void> {
  await apiClient.post('/push/register', { token, platform });
}

// Called on logout so a signed-out device stops receiving pushes meant for
// the account that just logged out.
export async function unregisterPushToken(token: string): Promise<void> {
  await apiClient.delete('/push/register', { data: { token } });
}
