import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';
import { CreateGroupScreen } from '../screens/group/CreateGroupScreen';
import { JoinGroupScreen } from '../screens/group/JoinGroupScreen';
import { LiveMapScreen } from '../screens/group/LiveMapScreen';
import { FirestoreLiveMapScreen } from '../screens/group/FirestoreLiveMapScreen';
import { GroupDetailsScreen } from '../screens/group/GroupDetailsScreen';
import { GroupChatScreen } from '../screens/group/GroupChatScreen';
import { SelfAlertModal } from '../screens/alerts/SelfAlertModal';
import { PeerAlertModal } from '../screens/alerts/PeerAlertModal';
import { ShareLocationScreen } from '../screens/liveShare/ShareLocationScreen';
import { ReceivedShareScreen } from '../screens/liveShare/ReceivedShareScreen';
import { AddFriendScreen } from '../screens/friends/AddFriendScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { PeerAlertToast } from '../components/alerts/PeerAlertToast';
import { navigationRef } from './navigationRef';
import { useAuthStore } from '../store/authStore';
import { useAlertStore } from '../store/alertStore';
import { connectSocket, disconnectSocket } from '../services/socket/socket';
import { onPeerAlert } from '../services/socket/alertEvents';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useFirebaseTrackingAuth } from '../hooks/useFirebaseTrackingAuth';
import { COLORS } from '../utils/constants';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const token = useAuthStore((s) => s.token);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Connects for the app's lifetime once logged in — the Friends live map
  // (and any other realtime feature) reads the same singleton via getSocket().
  useEffect(() => {
    if (!token) return;
    connectSocket(token);
    return () => disconnectSocket();
  }, [token]);

  // Listens for incoming peer alerts app-wide (not just while a matching
  // PeerAlertModal thread happens to be open) so the toast banner can surface
  // one no matter which screen the user is currently on.
  useEffect(() => {
    if (!token) return;
    const socket = connectSocket(token);
    return onPeerAlert(socket, (alert) => {
      useAlertStore.getState().pushIncoming(alert);
      useAlertStore.getState().incrementPeerUnread(alert.tripId, alert.senderId);
    });
  }, [token]);

  // FCM registration + notification-tap deep linking — see usePushNotifications.ts.
  usePushNotifications();

  // Signs into Firebase (custom token, uid = this user's Track-api id) so
  // Firestore-backed tracking is available — see useFirebaseTrackingAuth.ts.
  useFirebaseTrackingAuth();

  if (isHydrating) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {token ? (
            <>
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="JoinGroup" component={JoinGroupScreen} options={{ presentation: 'modal' }} />
              <Stack.Screen name="LiveMap" component={LiveMapScreen} />
              <Stack.Screen name="FirestoreLiveMap" component={FirestoreLiveMapScreen} />
              <Stack.Screen name="GroupDetails" component={GroupDetailsScreen} />
              <Stack.Screen name="GroupChat" component={GroupChatScreen} />
              <Stack.Screen name="SelfAlertModal" component={SelfAlertModal} options={{ presentation: 'modal' }} />
              <Stack.Screen name="PeerAlertModal" component={PeerAlertModal} options={{ presentation: 'modal' }} />
              <Stack.Screen name="ShareLocation" component={ShareLocationScreen} />
              <Stack.Screen name="ReceivedShare" component={ReceivedShareScreen} />
              <Stack.Screen name="AddFriend" component={AddFriendScreen} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
            </>
          ) : (
            <Stack.Screen name="Auth" component={AuthStack} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      {token && <PeerAlertToast />}
    </View>
  );
}
