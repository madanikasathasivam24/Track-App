// A bright, playful "Snap Map"-style skin (cream/mint land, cheerful blue
// water, thinned road labels, no default POI icon clutter — Explore's own
// category pins take that role) authored in Google's legacy client-side
// style-array format (featureType/elementType/stylers). Consumed two ways:
// as a literal customMapStyle prop on native's <MapView>, and pasted into
// Google Cloud Console's Map Styles JSON tab to back the Map ID web's
// AdvancedMarker requires (see FreeMapView.web.tsx) — one artifact, authored
// once. Google Maps Platform Styling Wizard (mapstyle.withgoogle.com) is the
// practical way to iterate on this visually rather than hand-tuning.
export const TRACK_MAP_STYLE_GOOGLE = [
  { elementType: 'geometry', stylers: [{ color: '#FDF6EC' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7A8B90' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FDF6EC' }, { weight: 1.4 }] },

  // POI icon/label clutter hidden by default — Explore's own pins take over.
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#CFEFDA' }] },

  // Land
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#D9EFD3' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#F5E9D6' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry.stroke', stylers: [{ color: '#EFE3D3' }] },

  // Water
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#7FD3E8' }] },
  { featureType: 'water', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  // Roads — color-coded by class, same hierarchy as the MapLibre style
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#FFF6E9' }] },
  { featureType: 'road.arterial', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#FFDDBB' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#7A8B90' }] },

  // Transit clutter hidden
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Administrative boundaries hidden except locality (city/town) labels
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#12212A' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#FDF6EC' }, { weight: 1.6 }],
  },
];

// Route line color — a vivid accent deliberately outside the grey/black chrome
// palette, same exception as the map terrain itself.
export const ROUTE_LINE_COLOR = '#3D5AFE';
