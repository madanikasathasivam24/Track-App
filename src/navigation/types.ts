import type { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  AvatarPicker: { phoneNumber: string; pin: string; name: string };
};

export type MainTabsParamList = {
  // Set when "Track" is tapped on a friend elsewhere (e.g. the Friends list
  // screen) — hands off to the Directions tab with that destination pre-filled.
  Explore: { trackDestination?: { label: string; latitude: number; longitude: number } } | undefined;
  Home: undefined;
  Friends: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabsParamList>;
  CreateGroup: undefined;
  JoinGroup: undefined;
  LiveMap: {
    groupId: string;
    tripId: string;
    tripName: string;
    destLat?: number;
    destLng?: number;
    destLabel?: string;
  };
  // Firestore-backed live map — a new, separate tracking path alongside the
  // Socket.IO-based LiveMap above (see FirestoreLiveMapScreen.tsx).
  FirestoreLiveMap: {
    groupId: string;
    tripId: string;
    tripName: string;
    destLat?: number;
    destLng?: number;
    destLabel?: string;
  };
  GroupDetails: { groupId: string };
  GroupChat: { groupId: string; groupName: string };
  SelfAlertModal: { groupId: string };
  PeerAlertModal: {
    groupId: string;
    tripId: string;
    tripName?: string;
    peerId: string;
    peerName: string;
    peerAvatarIndex: number;
  };
  ShareLocation: undefined;
  ReceivedShare: { sessionId: string };
  AddFriend: undefined;
  Notifications: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
