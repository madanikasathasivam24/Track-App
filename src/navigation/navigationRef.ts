import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

// Lives in its own file (rather than inside RootNavigator.tsx) so components
// outside the navigator tree — e.g. the global PeerAlertToast — can navigate
// without a circular import back to RootNavigator itself.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();
