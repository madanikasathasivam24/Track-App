import type { LatLng } from '../../utils/polyline';

export type PoiCategory = 'restaurant' | 'cafe' | 'bakery' | 'hospital';

export interface MapMarkerSpec {
  id: string;
  coordinate: LatLng;
  color: string;
  pulse?: boolean;
  // Set for labeled POI pins (Explore tab) — plain route waypoint dots leave
  // these unset and render as a simple colored circle instead.
  label?: string;
  category?: PoiCategory;
  // Set for the current user's own marker and friends' markers (Friends tab) —
  // renders the avatar image (see AVATAR_OPTIONS) in place of a colored dot.
  avatarIndex?: number;
  // Display name shown in a tag above the avatar — set alongside avatarIndex
  // wherever a person marker is rendered (LiveMapScreen, FriendsMapView).
  name?: string;
  // Minutes until this member reaches the trip destination, from their
  // server-cached route (see TripMemberPosition.routeDurationSeconds) —
  // rendered as a small pill on the avatar. Trip live map only; friends
  // tracking has no destination to estimate against.
  etaMinutes?: number;
  // Unread peer-alert count from this member — renders a red numeric badge
  // in the corner of their avatar (see LiveMapScreen), same visual pattern as
  // an app icon's unread badge. Unset/0 renders no badge.
  unreadCount?: number;
}

export interface FreeMapViewRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

// One route line per tracked trip member, rendered simultaneously (as opposed
// to `polyline` below, which is the single active Directions/friend-tracking
// route) — see TripMapScreen.
export interface MapRouteSpec {
  id: string;
  coords: LatLng[];
  color: string;
}

export interface FreeMapViewProps {
  initialRegion: FreeMapViewRegion;
  markers: MapMarkerSpec[];
  polyline?: LatLng[];
  routes?: MapRouteSpec[];
  // Live traffic overlay (colored road congestion) — opt-in per screen
  // rather than always-on, since it's only meaningful where a route is being
  // planned/driven (Directions), not on the Friends/trip live maps.
  showsTraffic?: boolean;
  onRegionChange?: (region: FreeMapViewRegion) => void;
  // Fired when a marker is tapped — used by the Explore/Friends tabs to surface
  // a "Get directions" callout for the tapped POI or friend.
  onMarkerPress?: (markerId: string) => void;
  // Fired when the map itself (not a marker) is tapped — used by the trip
  // destination picker to drop a pin at the tapped coordinate.
  onMapPress?: (coord: LatLng) => void;
}

export interface FreeMapViewHandle {
  fitToCoordinates: (coords: LatLng[]) => void;
  // Pans to a coordinate without changing zoom — used by the "recenter to my
  // location" button, as opposed to fitToCoordinates' bounds-fitting zoom.
  recenter: (coord: LatLng) => void;
}
