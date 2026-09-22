export const COLORS = {
  primary: '#1A1A1A', // near-black — brand accent (grey/black palette, no teal/green)
  primaryDark: '#000000',
  primaryLight: '#5C5C5C',
  background: '#F7FAFA',
  surface: '#FFFFFF',
  text: '#12212A',
  textMuted: '#6B7B80',
  border: '#E1E8E8',

  // Status ring colors — reserved strictly for member/group status, never reused decoratively
  statusActive: '#2FBF71', // green, pulsing
  statusStale: '#9AA5A8', // grey, dashed
  statusAlert: '#E5484D', // red
} as const;

// Loaded via useFonts() in App.tsx from @expo-google-fonts/nunito-sans — a free
// rounded/friendly sans-serif standing in for the (proprietary, non-redistributable)
// Airbnb Cereal VF that was originally requested.
export const FONTS = {
  regular: 'NunitoSans_400Regular',
  medium: 'NunitoSans_500Medium',
  semiBold: 'NunitoSans_600SemiBold',
  bold: 'NunitoSans_700Bold',
} as const;

export const STATUS_RING_DURATIONS = {
  pulseMs: 1400,
  staleDashMs: 2200,
} as const;

export const AVATAR_OPTIONS = [
  require('../assets/avatars/avatar1.png'),
  require('../assets/avatars/avatar2.png'),
  require('../assets/avatars/avatar3.png'),
  require('../assets/avatars/avatar4.png'),
  require('../assets/avatars/avatar5.png'),
];

export const PIN_LENGTH = { min: 4, max: 4 };

export const TRACK_ID_LENGTH = 7;

// Lives here (not client.ts or authStore.ts) so those two can both read it
// without importing each other — client.ts needs authStore for session-expiry
// handling, and authStore needs this key, which would otherwise be a cycle.
export const ACCESS_TOKEN_KEY = 'track_access_token';

// Diagnostic breadcrumbs for the still-unreproduced-on-demand "closed the app,
// came back logged out" bug — see authStore.ts's hydrate()/handleSessionExpired.
// Persisted (not just in-memory state) since the whole point is to survive
// across the exact app restart that triggers the bug, so LoginScreen can show
// what actually happened next time, without needing adb logcat or Render
// dashboard access. Remove once the bug is confirmed fixed.
export const SESSION_END_REASON_KEY = 'track_session_end_reason';
export const HAS_LOGGED_IN_BEFORE_KEY = 'track_has_logged_in_before';
