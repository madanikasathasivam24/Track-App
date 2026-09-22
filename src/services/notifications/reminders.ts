import * as Notifications from 'expo-notifications';

// Local (device-scheduled) notifications — unlike push.ts's FCM-based
// remote push, these need no backend round-trip at all, which is exactly
// right for a "leave by" alarm: it only concerns this device, at a time this
// device already knows, computed from a route duration this device already
// has.
export async function scheduleLeaveReminder(leaveAt: Date, title: string, body: string): Promise<string | null> {
  if (leaveAt.getTime() <= Date.now()) return null;
  return Notifications.scheduleNotificationAsync({
    content: { title, body },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: leaveAt },
  });
}

export async function cancelLeaveReminder(notificationId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {});
}
