/// <reference types="google.maps" />
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  APIProvider,
  Map,
  Polyline,
  useMap,
  type MapCameraChangedEvent,
  type MapMouseEvent,
} from '@vis.gl/react-google-maps';
import { MarkerContent } from './MarkerContent';
import { ROUTE_LINE_COLOR } from './mapStyle';
import type { FreeMapViewHandle, FreeMapViewProps } from './FreeMapView.types';

const GOOGLE_MAPS_API_KEY_WEB = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY_WEB ?? '';
const GOOGLE_MAPS_MAP_ID_WEB = process.env.EXPO_PUBLIC_MAP_ID ?? '';
// Only one FreeMapView is ever mounted at a time (screen-level component), so
// a fixed id is enough for useMap(id) below to find this instance.
const MAP_ID = 'track-map';
const CAMERA_FIT_PADDING = { top: 80, right: 60, bottom: 220, left: 60 };

// Google's zoom is a power-of-two tile subdivision, not a lat/lng span the
// way FreeMapViewRegion's deltas are (native's react-native-maps takes those
// deltas directly) — this is the standard approximate conversion, good enough
// since it only sets the *initial* camera framing.
function deltaToZoom(longitudeDelta: number): number {
  return Math.round(Math.log2(360 / longitudeDelta));
}

// Reads the map instance via useMap(MAP_ID), which resolves against
// APIProvider's instance registry rather than JSX ancestry — so this can sit
// alongside <Map> instead of inside it and still find the same instance.
// Writes the imperative handle into handleRef via an effect (rather than
// during render) since it's the map instance appearing that drives the
// update, not this component's own props.
function MapController({ handleRef }: { handleRef: React.MutableRefObject<FreeMapViewHandle> }) {
  const map = useMap(MAP_ID);

  useEffect(() => {
    handleRef.current = {
      fitToCoordinates: (coords) => {
        if (!map || coords.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        coords.forEach((c) => bounds.extend({ lat: c.latitude, lng: c.longitude }));
        map.fitBounds(bounds, CAMERA_FIT_PADDING);
      },
      recenter: (coord) => {
        map?.panTo({ lat: coord.latitude, lng: coord.longitude });
      },
    };
  }, [handleRef, map]);

  return null;
}

// No <TrafficLayer> component is exported by @vis.gl/react-google-maps —
// this drives the raw google.maps.TrafficLayer directly, the same way
// MapController above reaches into the raw map instance for imperative
// camera control.
function TrafficLayerControl({ show }: { show: boolean }) {
  const map = useMap(MAP_ID);

  useEffect(() => {
    if (!map || !show) return;
    const trafficLayer = new google.maps.TrafficLayer();
    trafficLayer.setMap(map);
    return () => trafficLayer.setMap(null);
  }, [map, show]);

  return null;
}

export const FreeMapView = forwardRef<FreeMapViewHandle, FreeMapViewProps>(
  ({ initialRegion, markers, polyline, routes, showsTraffic, onRegionChange, onMarkerPress, onMapPress }, ref) => {
    const handleRef = useRef<FreeMapViewHandle>({ fitToCoordinates: () => {}, recenter: () => {} });

    useImperativeHandle(
      ref,
      () => ({
        fitToCoordinates: (coords) => handleRef.current.fitToCoordinates(coords),
        recenter: (coord) => handleRef.current.recenter(coord),
      }),
      []
    );

    const handleCameraChanged = useCallback(
      (event: MapCameraChangedEvent) => {
        if (!onRegionChange) return;
        const { center, bounds } = event.detail;
        onRegionChange({
          latitude: center.lat,
          longitude: center.lng,
          latitudeDelta: bounds.north - bounds.south,
          longitudeDelta: bounds.east - bounds.west,
        });
      },
      [onRegionChange]
    );

    const handleClick = useCallback(
      (event: MapMouseEvent) => {
        if (!onMapPress || !event.detail.latLng) return;
        onMapPress({ latitude: event.detail.latLng.lat, longitude: event.detail.latLng.lng });
      },
      [onMapPress]
    );

    return (
      <View style={StyleSheet.absoluteFill}>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY_WEB}>
          <Map
            id={MAP_ID}
            mapId={GOOGLE_MAPS_MAP_ID_WEB}
            style={{ width: '100%', height: '100%' }}
            defaultCenter={{ lat: initialRegion.latitude, lng: initialRegion.longitude }}
            defaultZoom={deltaToZoom(initialRegion.longitudeDelta)}
            disableDefaultUI
            zoomControl
            onCameraChanged={handleCameraChanged}
            onClick={handleClick}
          >
            <MapController handleRef={handleRef} />
            <TrafficLayerControl show={Boolean(showsTraffic)} />

            {polyline && polyline.length > 0 && (
              <Polyline path={polyline.map((p) => ({ lat: p.latitude, lng: p.longitude }))} strokeColor={ROUTE_LINE_COLOR} strokeWeight={5} />
            )}

            {routes?.map((r) => (
              <Polyline key={r.id} path={r.coords.map((p) => ({ lat: p.latitude, lng: p.longitude }))} strokeColor={r.color} strokeWeight={4} />
            ))}

            {markers.map((marker) => (
              <AdvancedMarker
                key={marker.id}
                position={{ lat: marker.coordinate.latitude, lng: marker.coordinate.longitude }}
                anchorPoint={
                  marker.label || (marker.name && marker.etaMinutes === undefined)
                    ? AdvancedMarkerAnchorPoint.BOTTOM_CENTER
                    : AdvancedMarkerAnchorPoint.CENTER
                }
                onClick={() => onMarkerPress?.(marker.id)}
              >
                <MarkerContent marker={marker} />
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>
      </View>
    );
  }
);
FreeMapView.displayName = 'FreeMapView';
