import * as Clarity from '@microsoft/react-native-clarity';

const CLARITY_PROJECT_ID = process.env.EXPO_PUBLIC_CLARITY_PROJECT_ID;

// Native-only (see clarity.web.ts) — Clarity's SDK depends on native code, so
// it requires a dev-client rebuild (npx expo prebuild) and no-ops under Expo
// Go, same category of constraint as react-native-maps/RNFirebase.
export function initClarity(): void {
  if (!CLARITY_PROJECT_ID) return;
  Clarity.initialize(CLARITY_PROJECT_ID);
}
