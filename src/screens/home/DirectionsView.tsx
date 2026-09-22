import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { FreeMapView } from '../../components/map/FreeMapView';
import { RecenterButton } from '../../components/map/RecenterButton';
import { TimePickerField } from '../../components/common/TimePickerField';
import { cancelLeaveReminder, scheduleLeaveReminder } from '../../services/notifications/reminders';
import type { FreeMapViewHandle, MapMarkerSpec } from '../../components/map/FreeMapView.types';
import { autocompletePlaces, getPlaceLocation, getRoute } from '../../services/api/routing.api';
import type { PlaceSuggestion, Route, RouteOptions } from '../../services/api/routing.api';
import {
  createDirectionSearch,
  getRecentDirectionSearches,
  getSavedDirectionSearches,
  markDirectionSearchStarted,
  saveDirectionSearch,
  unsaveDirectionSearch,
} from '../../services/api/directionHistory.api';
import type { DirectionSearchRecord } from '../../services/api/directionHistory.api';
import { decodePolyline, type LatLng } from '../../utils/polyline';
import { haversineMeters } from '../../utils/geo';
import { COLORS, FONTS } from '../../utils/constants';
import { useAuthStore } from '../../store/authStore';
import { Skeleton } from '../../components/ui/Skeleton';

interface WaypointField {
  id: string;
  label: string;
  coords: LatLng | null;
  isCurrentLocation?: boolean;
}

const DEFAULT_DELTA = 0.05;
const DEBOUNCE_MS = 300;
const ROUTE_REVEAL_STEPS = 24;
const ROUTE_REVEAL_MS = 700;
const ARRIVAL_THRESHOLD_METERS = 40;
const REROUTE_MIN_INTERVAL_MS = 15000;
const REROUTE_MIN_DISTANCE_METERS = 75;

// Recent searches can repeat the same destination many times — keep only the
// most recent entry per destination for display.
function dedupeByDestination(records: DirectionSearchRecord[]): DirectionSearchRecord[] {
  const seen = new Set<string>();
  const result: DirectionSearchRecord[] = [];
  for (const record of records) {
    if (seen.has(record.destLabel)) continue;
    seen.add(record.destLabel);
    result.push(record);
  }
  return result;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

let nextStopId = 1;

export interface DirectionsViewProps {
  // Set when arriving via "Get directions" from a tapped POI/friend marker on
  // another tab — pre-fills the destination and routes as soon as the user's
  // own location resolves. Consumed once (see onPrefillConsumed) since this
  // view remounts fresh on every tab switch.
  prefillDestination?: { label: string; coords: LatLng } | null;
  onPrefillConsumed?: () => void;
}

export function DirectionsView({ prefillDestination, onPrefillConsumed }: DirectionsViewProps = {}) {
  // topOverlay is position:'absolute', which doesn't reliably pick up the
  // ancestor SafeAreaView's top padding the way normal-flow content does —
  // read the inset directly instead of depending on that inheritance.
  const insets = useSafeAreaInsets();
  const currentUser = useAuthStore((s) => s.user);
  const mapRef = useRef<FreeMapViewHandle>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prefillRef = useRef(prefillDestination);
  const onPrefillConsumedRef = useRef(onPrefillConsumed);
  onPrefillConsumedRef.current = onPrefillConsumed;
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastRerouteRef = useRef<{ at: number; coords: LatLng } | null>(null);
  const tripDestinationRef = useRef<{ label: string; coords: LatLng } | null>(null);

  const [myLocation, setMyLocation] = useState<LatLng | null>(null);
  // Seeded from a cached fix (near-instant) purely to mount the map right
  // away instead of leaving native map init (Play Services loading, tiles,
  // styling) blocked behind a full fresh GPS lock — never used as a routing
  // origin, unlike myLocation above, which still waits for the precise fix.
  const [quickRegion, setQuickRegion] = useState<LatLng | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const [waypoints, setWaypoints] = useState<WaypointField[]>(() => [
    { id: 'from', label: 'Your location', coords: null, isCurrentLocation: true },
    prefillDestination
      ? { id: 'to', label: prefillDestination.label, coords: prefillDestination.coords }
      : { id: 'to', label: '', coords: null },
  ]);
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
  const [fieldText, setFieldText] = useState<Record<string, string>>({
    from: 'Your location',
    to: prefillDestination?.label ?? '',
  });
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [routeCoords, setRouteCoords] = useState<LatLng[]>([]);
  const [route, setRoute] = useState<Route | null>(null);
  const [isRouting, setIsRouting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recentSearches, setRecentSearches] = useState<DirectionSearchRecord[]>([]);
  const [savedSearches, setSavedSearches] = useState<DirectionSearchRecord[]>([]);
  const [lastSearchId, setLastSearchId] = useState<string | null>(null);
  const [isCurrentSaved, setIsCurrentSaved] = useState(false);
  // Unlike the menu's other actions, this one doesn't close the sheet on tap
  // and its label/icon flip instantly (optimistic), which invites rapid
  // re-tapping — without this guard, several taps in quick succession fire
  // overlapping save/unsave requests that can resolve out of order.
  const [isSavingRoute, setIsSavingRoute] = useState(false);
  const [isTripActive, setIsTripActive] = useState(false);
  const [hasArrived, setHasArrived] = useState(false);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidHighways, setAvoidHighways] = useState(false);
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [reminderId, setReminderId] = useState<string | null>(null);
  // Mirrors reminderId for the unmount-cleanup effect below, which needs the
  // latest value at unmount time rather than whatever it was when that
  // effect's closure was created (it only ever runs once, on mount).
  const reminderIdRef = useRef<string | null>(null);
  reminderIdRef.current = reminderId;

  useEffect(() => {
    getRecentDirectionSearches()
      .then((records) => setRecentSearches(dedupeByDestination(records)))
      .catch(() => {
        // Recent-searches is a nice-to-have, not a critical path — fail quietly.
      });
    getSavedDirectionSearches()
      .then((records) => setSavedSearches(dedupeByDestination(records)))
      .catch(() => {});
  }, []);

  // Fetch the user's live location as soon as Explore opens.
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setPermissionDenied(true);
        return;
      }
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        setQuickRegion({ latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude });
      }

      const current = await Location.getCurrentPositionAsync({});
      const coords = { latitude: current.coords.latitude, longitude: current.coords.longitude };
      setMyLocation(coords);
      mapRef.current?.recenter(coords);
      setWaypoints((prev) => {
        const next = prev.map((w) => (w.isCurrentLocation ? { ...w, coords } : w));
        if (prefillRef.current) runRoute(next);
        return next;
      });
    })();
    if (prefillRef.current) onPrefillConsumedRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearRevealTimer = useCallback(() => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  }, []);

  const runRoute = useCallback(
    async (points: WaypointField[]) => {
      const coordsList = points.map((p) => p.coords).filter((c): c is LatLng => c !== null);
      if (coordsList.length !== points.length) return;

      setIsRouting(true);
      setError(null);
      setLastSearchId(null);
      setIsCurrentSaved(false);
      try {
        const routeResult = await getRoute(coordsList, {
          avoidTolls,
          avoidHighways,
          arrivalTime: arrivalTime?.toISOString(),
        });
        const decoded = decodePolyline(routeResult.encodedPolyline);
        setRoute(routeResult);

        clearRevealTimer();
        let step = 0;
        revealTimerRef.current = setInterval(() => {
          step += 1;
          const count = Math.max(2, Math.round((decoded.length * step) / ROUTE_REVEAL_STEPS));
          setRouteCoords(decoded.slice(0, count));
          if (step >= ROUTE_REVEAL_STEPS) clearRevealTimer();
        }, ROUTE_REVEAL_MS / ROUTE_REVEAL_STEPS);

        mapRef.current?.fitToCoordinates([...coordsList, ...decoded]);

        const origin = points[0];
        const destination = points[points.length - 1];
        createDirectionSearch({
          origin: origin.coords!,
          originLabel: origin.label || 'Your location',
          destination: destination.coords!,
          destLabel: destination.label,
          distanceMeters: routeResult.distanceMeters,
          durationSeconds: routeResult.durationSeconds,
        })
          .then((record) => {
            setLastSearchId(record.id);
            setIsCurrentSaved(record.isSaved);
            setRecentSearches((prev) => dedupeByDestination([record, ...prev]));
          })
          .catch(() => {
            // Best-effort history logging — a failed save shouldn't block routing.
          });
      } catch {
        setError("Couldn't get directions for that trip.");
        setRoute(null);
        setRouteCoords([]);
      } finally {
        setIsRouting(false);
      }
    },
    [clearRevealTimer, avoidTolls, avoidHighways, arrivalTime]
  );

  useEffect(() => clearRevealTimer, [clearRevealTimer]);

  // Handles a NEW prefill arriving after mount (tapping a friend's marker, or
  // "Track" from the Friends list) — this screen used to remount fresh every
  // time ExploreScreen swapped modes, so prefillDestination only needed to be
  // read once, at mount, above. Now that it stays permanently mounted (see
  // ExploreScreen.tsx), a later prefill has to be applied reactively instead.
  const isFirstPrefillRef = useRef(true);
  useEffect(() => {
    if (isFirstPrefillRef.current) {
      isFirstPrefillRef.current = false;
      return; // already handled by the mount effect above
    }
    if (!prefillDestination) return;
    setFieldText((prev) => ({ ...prev, to: prefillDestination.label }));
    setWaypoints((prev) => {
      const next = prev.map((w, i) =>
        i === prev.length - 1
          ? { ...w, label: prefillDestination.label, coords: prefillDestination.coords, isCurrentLocation: false }
          : w
      );
      if (next.every((w) => w.coords !== null)) runRoute(next);
      return next;
    });
    onPrefillConsumedRef.current?.();
  }, [prefillDestination, runRoute]);

  const onFocusField = useCallback((id: string) => {
    setActiveFieldId(id);
    setSuggestions([]);
  }, []);

  const onChangeFieldText = useCallback(
    (id: string, text: string) => {
      setFieldText((prev) => ({ ...prev, [id]: text }));
      setWaypoints((prev) => prev.map((w) => (w.id === id ? { ...w, isCurrentLocation: false, coords: null } : w)));

      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!text.trim()) {
        setSuggestions([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        setIsSearching(true);
        try {
          const results = await autocompletePlaces(text, myLocation);
          setSuggestions(results);
        } catch {
          setError("Couldn't search destinations right now.");
        } finally {
          setIsSearching(false);
        }
      }, DEBOUNCE_MS);
    },
    [myLocation]
  );

  const onSelectSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      if (!activeFieldId) return;
      const fieldId = activeFieldId;
      setFieldText((prev) => ({ ...prev, [fieldId]: suggestion.description }));
      setSuggestions([]);
      setActiveFieldId(null);

      try {
        const coords = await getPlaceLocation(suggestion.id);
        setWaypoints((prev) => {
          const next = prev.map((w) =>
            w.id === fieldId ? { ...w, label: suggestion.description, coords, isCurrentLocation: false } : w
          );
          runRoute(next);
          return next;
        });
      } catch {
        setError("Couldn't resolve that place.");
      }
    },
    [activeFieldId, runRoute]
  );

  const onUseCurrentLocation = useCallback(() => {
    if (!myLocation) return;
    setFieldText((prev) => ({ ...prev, from: 'Your location' }));
    setSuggestions([]);
    setActiveFieldId(null);
    setWaypoints((prev) => {
      const next = prev.map((w) =>
        w.id === 'from' ? { ...w, label: 'Your location', coords: myLocation, isCurrentLocation: true } : w
      );
      runRoute(next);
      return next;
    });
  }, [myLocation, runRoute]);

  const onSelectRecentSearch = useCallback(
    (record: DirectionSearchRecord) => {
      const fieldId = activeFieldId ?? 'to';
      setFieldText((prev) => ({ ...prev, [fieldId]: record.destLabel }));
      setSuggestions([]);
      setActiveFieldId(null);

      setWaypoints((prev) => {
        const next = prev.map((w) =>
          w.id === fieldId
            ? { ...w, label: record.destLabel, coords: { latitude: record.destLat, longitude: record.destLng }, isCurrentLocation: false }
            : w
        );
        runRoute(next);
        return next;
      });
    },
    [activeFieldId, runRoute]
  );

  const stopTracking = useCallback(() => {
    watchSubscriptionRef.current?.remove();
    watchSubscriptionRef.current = null;
    setIsTripActive(false);
  }, []);

  const startTrip = useCallback(async () => {
    const destinationWaypoint = waypoints[waypoints.length - 1];
    if (!destinationWaypoint.coords) return;
    const destination = { label: destinationWaypoint.label, coords: destinationWaypoint.coords };
    tripDestinationRef.current = destination;
    lastRerouteRef.current = null;
    setHasArrived(false);
    setIsTripActive(true);

    if (lastSearchId) {
      markDirectionSearchStarted(lastSearchId).catch(() => {});
    }

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      stopTracking();
      return;
    }

    watchSubscriptionRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, timeInterval: 4000, distanceInterval: 15 },
      (position) => {
        const here = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        const dest = tripDestinationRef.current;
        if (!dest) return;

        setMyLocation(here);
        setWaypoints((prev) => prev.map((w, i) => (i === 0 ? { ...w, coords: here } : w)));
        const remaining = haversineMeters(here, dest.coords);

        if (remaining < ARRIVAL_THRESHOLD_METERS) {
          setHasArrived(true);
          stopTracking();
          return;
        }

        const last = lastRerouteRef.current;
        const movedFar = !last || haversineMeters(here, last.coords) > REROUTE_MIN_DISTANCE_METERS;
        const longEnough = !last || Date.now() - last.at > REROUTE_MIN_INTERVAL_MS;
        if (!movedFar && !longEnough) return;

        lastRerouteRef.current = { at: Date.now(), coords: here };
        getRoute([here, dest.coords])
          .then((routeResult) => {
            const decoded = decodePolyline(routeResult.encodedPolyline);
            setRoute(routeResult);
            setRouteCoords(decoded);
            mapRef.current?.fitToCoordinates([here, dest.coords, ...decoded]);
          })
          .catch(() => {
            // Keep showing the last known route rather than erroring mid-trip.
          });
      }
    );
  }, [waypoints, lastSearchId, stopTracking]);

  useEffect(() => () => watchSubscriptionRef.current?.remove(), []);

  // Clears the current destination/route entirely and resets the planner
  // back to its initial state (just "Your location" → empty destination).
  const onCancelRoute = useCallback(() => {
    clearRevealTimer();
    stopTracking();
    setRoute(null);
    setRouteCoords([]);
    setError(null);
    setLastSearchId(null);
    setIsCurrentSaved(false);
    setHasArrived(false);
    setActiveFieldId(null);
    setSuggestions([]);
    setFieldText({ from: 'Your location', to: '' });
    setWaypoints([
      { id: 'from', label: 'Your location', coords: myLocation, isCurrentLocation: true },
      { id: 'to', label: '', coords: null },
    ]);
  }, [clearRevealTimer, stopTracking, myLocation]);

  const onRecenter = useCallback(() => {
    if (myLocation) mapRef.current?.recenter(myLocation);
  }, [myLocation]);

  // Re-runs the current route whenever there's already a destination set —
  // used both by the explicit Refresh menu action and by toggling an
  // avoid-tolls/avoid-highways option, since either invalidates the last
  // computed route.
  const rerouteIfReady = useCallback(() => {
    if (waypoints[waypoints.length - 1].coords) runRoute(waypoints);
  }, [waypoints, runRoute]);

  const onToggleAvoidTolls = useCallback(() => {
    setAvoidTolls((prev) => !prev);
  }, []);

  const onToggleAvoidHighways = useCallback(() => {
    setAvoidHighways((prev) => !prev);
  }, []);

  // Re-route once a toggle actually changes (not on every render) — mirrors
  // rerouteIfReady's own guard, just triggered by the option itself rather
  // than an explicit tap.
  const isFirstOptionsRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstOptionsRenderRef.current) {
      isFirstOptionsRenderRef.current = false;
      return;
    }
    rerouteIfReady();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avoidTolls, avoidHighways, arrivalTime]);

  const onRefresh = useCallback(() => {
    setIsMenuOpen(false);
    rerouteIfReady();
  }, [rerouteIfReady]);

  const onToggleSave = useCallback(async () => {
    if (!lastSearchId || isSavingRoute) return;
    const nextSaved = !isCurrentSaved;
    setIsCurrentSaved(nextSaved);
    setIsSavingRoute(true);
    try {
      const record = nextSaved ? await saveDirectionSearch(lastSearchId) : await unsaveDirectionSearch(lastSearchId);
      setSavedSearches((prev) =>
        nextSaved ? dedupeByDestination([record, ...prev]) : prev.filter((r) => r.id !== lastSearchId)
      );
    } catch {
      setIsCurrentSaved(!nextSaved);
    } finally {
      setIsSavingRoute(false);
    }
  }, [lastSearchId, isCurrentSaved, isSavingRoute]);

  // Waits for the action sheet's own Modal to finish closing before opening
  // the time picker — both render as real native dialogs on Android
  // (RN's Modal is backed by one, same as DateTimePicker's default display),
  // and closing one while immediately opening another in the same tick can
  // silently drop the second one instead of showing it.
  const onOpenTimePicker = useCallback(() => {
    setIsMenuOpen(false);
    setTimeout(() => setShowTimePicker(true), 300);
  }, []);

  const onCloseTimePicker = useCallback(() => setShowTimePicker(false), []);

  const onClearArrivalTime = useCallback(() => {
    setIsMenuOpen(false);
    setArrivalTime(null);
    if (reminderId) {
      cancelLeaveReminder(reminderId);
      setReminderId(null);
    }
  }, [reminderId]);

  // Only meaningful alongside an arrival time and a computed route — needs
  // both to know when "leave by" actually is.
  const onToggleReminder = useCallback(async () => {
    setIsMenuOpen(false);
    if (reminderId) {
      await cancelLeaveReminder(reminderId);
      setReminderId(null);
      return;
    }
    if (!arrivalTime || !route) return;
    const leaveAt = new Date(arrivalTime.getTime() - route.durationSeconds * 1000);
    if (leaveAt.getTime() <= Date.now()) {
      setError("That arrival time doesn't leave enough time to get there — pick a later one.");
      return;
    }
    const destination = waypoints[waypoints.length - 1];
    const id = await scheduleLeaveReminder(
      leaveAt,
      'Time to leave',
      `Leave now to arrive at ${destination.label || 'your destination'} by ${formatTime(arrivalTime)}`
    );
    setReminderId(id);
  }, [reminderId, arrivalTime, route, waypoints]);

  // Keeps the reminder in sync with the route's current duration — a
  // traffic-driven reroute can change how long the trip takes, so a "leave
  // by" time computed from a stale duration would drift from reality.
  useEffect(() => {
    if (!reminderId || !arrivalTime || !route) return;
    const leaveAt = new Date(arrivalTime.getTime() - route.durationSeconds * 1000);
    const staleId = reminderId;
    const destination = waypoints[waypoints.length - 1];
    (async () => {
      await cancelLeaveReminder(staleId);
      if (leaveAt.getTime() <= Date.now()) {
        setReminderId(null);
        return;
      }
      const id = await scheduleLeaveReminder(
        leaveAt,
        'Time to leave',
        `Leave now to arrive at ${destination.label || 'your destination'} by ${formatTime(arrivalTime)}`
      );
      setReminderId(id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route?.durationSeconds]);

  // Cancels any pending reminder if the screen unmounts (e.g. switching to
  // the Friends sub-tab) with one still scheduled — otherwise it fires later
  // for a trip the user isn't even planning anymore.
  useEffect(() => {
    return () => {
      if (reminderIdRef.current) cancelLeaveReminder(reminderIdRef.current);
    };
  }, []);

  const onShare = useCallback(async () => {
    setIsMenuOpen(false);
    const destination = waypoints[waypoints.length - 1];
    if (!destination.coords) return;
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.coords.latitude},${destination.coords.longitude}`;
    try {
      await Share.share({
        message: `Directions to ${destination.label || 'my destination'}: ${mapsUrl}`,
      });
    } catch {
      // Best-effort — a cancelled/failed share sheet isn't an app error.
    }
  }, [waypoints]);

  const onAddStop = useCallback(() => {
    setIsMenuOpen(false);
    const id = `stop-${nextStopId++}`;
    setFieldText((prev) => ({ ...prev, [id]: '' }));
    setWaypoints((prev) => [...prev.slice(0, -1), { id, label: '', coords: null }, prev[prev.length - 1]]);
  }, []);

  const onRemoveStop = useCallback(
    (id: string) => {
      setWaypoints((prev) => {
        const next = prev.filter((w) => w.id !== id);
        runRoute(next);
        return next;
      });
      setFieldText((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    },
    [runRoute]
  );

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const list: MapMarkerSpec[] = [];
    waypoints.forEach((w, index) => {
      if (!w.coords) return;
      const isFrom = index === 0;
      const isTo = index === waypoints.length - 1;
      // Matches FriendsMapView's "You" marker — shows your own avatar at your
      // current-location origin instead of a plain dot, only when it's
      // actually your live position (not a manually-entered origin).
      const showMyAvatar = isFrom && Boolean(w.isCurrentLocation) && currentUser;
      list.push({
        id: w.id,
        coordinate: w.coords,
        color: isFrom ? COLORS.primary : isTo ? COLORS.statusAlert : COLORS.statusStale,
        pulse: isFrom && Boolean(w.isCurrentLocation),
        ...(showMyAvatar ? { avatarIndex: currentUser.avatarIndex, name: 'You' } : null),
      });
    });
    return list;
  }, [waypoints, currentUser]);

  const initialRegion = myLocation
    ? { ...myLocation, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }
    : quickRegion
      ? { ...quickRegion, latitudeDelta: DEFAULT_DELTA, longitudeDelta: DEFAULT_DELTA }
      : null;

  return (
    <>
      <View style={styles.mapContainer}>
        {initialRegion ? (
          <FreeMapView ref={mapRef} initialRegion={initialRegion} markers={markers} polyline={routeCoords} showsTraffic />
        ) : (
          <View style={styles.mapPlaceholder}>
            {permissionDenied ? (
              <Text style={styles.mapPlaceholderText}>
                Location permission is off — enable it in Settings to explore from here.
              </Text>
            ) : (
              <Skeleton width="100%" height="100%" borderRadius={0} />
            )}
          </View>
        )}

        {isRouting && (
          <View style={styles.routingOverlay}>
            <ActivityIndicator size="small" color={COLORS.primary} />
          </View>
        )}

        {initialRegion && <RecenterButton onPress={onRecenter} style={styles.recenterButton} />}

        {route && !isRouting && (
          <View style={styles.routeCard}>
            <View style={styles.routeInfo}>
              <Text style={styles.routeDistance}>{(route.distanceMeters / 1000).toFixed(1)} km</Text>
              <Text style={styles.routeDuration}>
                {hasArrived
                  ? "You've arrived"
                  : isTripActive
                    ? `${Math.round(route.durationSeconds / 60)} min remaining`
                    : arrivalTime
                      ? `Arrive by ${formatTime(arrivalTime)}`
                      : `${Math.round(route.durationSeconds / 60)} min from your stop`}
              </Text>
            </View>
            <Pressable style={styles.cancelRouteButton} onPress={onCancelRoute} hitSlop={8}>
              <Ionicons name="close" size={20} color={COLORS.textMuted} />
            </Pressable>
            {isTripActive || hasArrived ? (
              <Pressable style={styles.endTripButton} onPress={stopTracking}>
                <Text style={styles.endTripLabel}>{hasArrived ? 'Done' : 'End trip'}</Text>
              </Pressable>
            ) : (
              <Pressable style={styles.startTripButton} onPress={startTrip}>
                <Ionicons name="navigate" size={16} color="#FFFFFF" />
                <Text style={styles.startTripLabel}>Start</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>

      {!isTripActive && (
        <View style={[styles.topOverlay, { top: insets.top + 12 }]} pointerEvents="box-none">
          <View style={styles.searchCard}>
            <View style={styles.searchCardRow}>
              <View style={styles.waypointsColumn}>
                {waypoints.map((waypoint, index) => {
                  const isFrom = index === 0;
                  const isTo = index === waypoints.length - 1;
                  const isStop = !isFrom && !isTo;
                  return (
                    <View key={waypoint.id} style={styles.plannerRow}>
                      <View
                        style={[styles.rowDot, isFrom && styles.rowDotFrom, isTo && styles.rowDotTo, isStop && styles.rowDotStop]}
                      />
                      <TextInput
                        style={styles.rowInput}
                        placeholder={isFrom ? 'Your location' : isTo ? 'Choose destination' : 'Add a stop'}
                        placeholderTextColor={COLORS.textMuted}
                        value={fieldText[waypoint.id] ?? ''}
                        onFocus={() => onFocusField(waypoint.id)}
                        onChangeText={(text) => onChangeFieldText(waypoint.id, text)}
                      />
                      {isFrom && !waypoint.isCurrentLocation && (
                        <Pressable onPress={onUseCurrentLocation} hitSlop={8}>
                          <Ionicons name="locate" size={18} color={COLORS.primary} />
                        </Pressable>
                      )}
                      {isStop && (
                        <Pressable onPress={() => onRemoveStop(waypoint.id)} hitSlop={8}>
                          <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
                        </Pressable>
                      )}
                    </View>
                  );
                })}
              </View>

              <Pressable onPress={() => setIsMenuOpen(true)} hitSlop={8} style={styles.menuButton}>
                <Ionicons name="ellipsis-vertical" size={20} color={COLORS.textMuted} />
              </Pressable>
            </View>
          </View>

          {isSearching && activeFieldId && (
            <View style={styles.suggestionsLoading}>
              <ActivityIndicator size="small" color={COLORS.primary} />
            </View>
          )}

          {activeFieldId && suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((item) => (
                <Pressable key={item.id} style={styles.suggestionRow} onPress={() => onSelectSuggestion(item)}>
                  <Ionicons name="location-outline" size={16} color={COLORS.textMuted} />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {item.description}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {activeFieldId && !fieldText[activeFieldId]?.trim() && suggestions.length === 0 && savedSearches.length > 0 && (
            <View style={styles.suggestions}>
              <Text style={styles.recentHeading}>Saved</Text>
              {savedSearches.map((item) => (
                <Pressable key={item.id} style={styles.suggestionRow} onPress={() => onSelectRecentSearch(item)}>
                  <Ionicons name="bookmark" size={16} color={COLORS.primary} />
                  <Text style={styles.suggestionText} numberOfLines={1}>
                    {item.destLabel}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          {activeFieldId &&
            !fieldText[activeFieldId]?.trim() &&
            suggestions.length === 0 &&
            recentSearches.length > 0 && (
              <View style={styles.suggestions}>
                <Text style={styles.recentHeading}>Recent</Text>
                {recentSearches.map((item) => (
                  <Pressable key={item.id} style={styles.suggestionRow} onPress={() => onSelectRecentSearch(item)}>
                    <Ionicons name="time-outline" size={16} color={COLORS.textMuted} />
                    <Text style={styles.suggestionText} numberOfLines={1}>
                      {item.destLabel}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      )}

      <Modal transparent visible={isMenuOpen} animationType="fade" onRequestClose={() => setIsMenuOpen(false)}>
        <Pressable style={[StyleSheet.absoluteFill, styles.modalBackdrop]} onPress={() => setIsMenuOpen(false)}>
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.actionSheetTitle}>Route options</Text>
            <Pressable style={styles.actionRow} onPress={onAddStop}>
              <Ionicons name="add" size={20} color={COLORS.text} />
              <Text style={styles.actionLabel}>Add stop</Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={onRefresh}>
              <Ionicons name="refresh" size={20} color={COLORS.text} />
              <Text style={styles.actionLabel}>Refresh</Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={onShare}>
              <Ionicons name="share-outline" size={20} color={COLORS.text} />
              <Text style={styles.actionLabel}>Share</Text>
            </Pressable>
            <Pressable
              style={[styles.actionRow, (!lastSearchId || isSavingRoute) && styles.actionRowDisabled]}
              onPress={onToggleSave}
              disabled={!lastSearchId || isSavingRoute}
            >
              <Ionicons
                name={isCurrentSaved ? 'bookmark' : 'bookmark-outline'}
                size={20}
                color={isCurrentSaved ? COLORS.primary : COLORS.text}
              />
              <Text style={styles.actionLabel}>{isCurrentSaved ? 'Saved' : 'Save route'}</Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={onToggleAvoidTolls}>
              <Ionicons
                name={avoidTolls ? 'checkbox' : 'square-outline'}
                size={20}
                color={avoidTolls ? COLORS.primary : COLORS.text}
              />
              <Text style={styles.actionLabel}>Avoid tolls</Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={onToggleAvoidHighways}>
              <Ionicons
                name={avoidHighways ? 'checkbox' : 'square-outline'}
                size={20}
                color={avoidHighways ? COLORS.primary : COLORS.text}
              />
              <Text style={styles.actionLabel}>Avoid highways</Text>
            </Pressable>
            <Pressable style={styles.actionRow} onPress={onOpenTimePicker}>
              <Ionicons name="time-outline" size={20} color={COLORS.text} />
              <Text style={styles.actionLabel}>
                {arrivalTime ? `Arrive by ${formatTime(arrivalTime)}` : 'Set arrival time'}
              </Text>
            </Pressable>
            {arrivalTime && (
              <Pressable style={styles.actionRow} onPress={onClearArrivalTime}>
                <Ionicons name="close-circle-outline" size={20} color={COLORS.statusAlert} />
                <Text style={[styles.actionLabel, styles.actionLabelDanger]}>Clear arrival time</Text>
              </Pressable>
            )}
            {arrivalTime && (
              <Pressable style={[styles.actionRow, !route && styles.actionRowDisabled]} onPress={onToggleReminder} disabled={!route}>
                <Ionicons
                  name={reminderId ? 'notifications' : 'notifications-outline'}
                  size={20}
                  color={reminderId ? COLORS.primary : COLORS.text}
                />
                <Text style={styles.actionLabel}>{reminderId ? 'Leave-by reminder set' : 'Remind me to leave'}</Text>
              </Pressable>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <TimePickerField
        visible={showTimePicker}
        value={arrivalTime ?? new Date()}
        onChange={setArrivalTime}
        onClose={onCloseTimePicker}
      />
    </>
  );
}

const styles = StyleSheet.create({
  mapContainer: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  mapPlaceholderText: {
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    textAlign: 'center',
  },
  routingOverlay: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 10,
  },
  recenterButton: {
    position: 'absolute',
    bottom: 190,
    right: 16,
  },
  routeCard: {
    position: 'absolute',
    bottom: 90,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  routeInfo: {
    flex: 1,
  },
  routeDistance: {
    fontSize: 18,
    fontFamily: FONTS.bold,
    color: COLORS.text,
  },
  routeDuration: {
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  cancelRouteButton: {
    padding: 6,
  },
  startTripButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  startTripLabel: {
    color: '#FFFFFF',
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  endTripButton: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: COLORS.statusAlert,
  },
  endTripLabel: {
    color: COLORS.statusAlert,
    fontFamily: FONTS.semiBold,
    fontSize: 14,
  },
  recentHeading: {
    fontSize: 12,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    paddingTop: 10,
    paddingHorizontal: 2,
  },
  topOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
  },
  searchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  searchCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  waypointsColumn: {
    flex: 1,
  },
  menuButton: {
    padding: 6,
    marginLeft: 4,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(18, 33, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingBottom: 32,
    paddingHorizontal: 8,
  },
  actionSheetTitle: {
    fontSize: 13,
    fontFamily: FONTS.semiBold,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  actionRowDisabled: {
    opacity: 0.4,
  },
  actionLabel: {
    fontSize: 16,
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
  },
  actionLabelDanger: {
    color: COLORS.statusAlert,
  },
  plannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowDotFrom: {
    backgroundColor: COLORS.primary,
  },
  rowDotTo: {
    backgroundColor: COLORS.statusAlert,
  },
  rowDotStop: {
    backgroundColor: COLORS.statusStale,
  },
  rowInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: FONTS.regular,
    color: COLORS.text,
    paddingVertical: 6,
  },
  suggestionsLoading: {
    alignItems: 'center',
    paddingVertical: 8,
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  suggestions: {
    maxHeight: 200,
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    fontFamily: FONTS.regular,
    color: COLORS.text,
  },
  errorText: {
    fontFamily: FONTS.regular,
    color: COLORS.statusAlert,
    fontSize: 13,
    marginTop: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 10,
    paddingHorizontal: 14,
    overflow: 'hidden',
  },
});
