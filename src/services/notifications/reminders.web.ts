// expo-notifications' local scheduling has no meaningful web equivalent —
// there's no persistent background process to fire a timed alert once the
// tab isn't open, unlike a native OS-level scheduled notification. No-op
// stub, same category as push.web.ts.
export async function scheduleLeaveReminder(_leaveAt: Date, _title: string, _body: string): Promise<string | null> {
  return null;
}

export async function cancelLeaveReminder(_notificationId: string): Promise<void> {}
