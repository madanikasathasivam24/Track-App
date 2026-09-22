import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { PoiCategory } from './FreeMapView.types';

const ICON_BY_CATEGORY: Record<PoiCategory, keyof typeof Ionicons.glyphMap> = {
  restaurant: 'restaurant',
  cafe: 'cafe',
  // Ionicons has no dedicated bakery glyph — storefront is the closest generic stand-in.
  bakery: 'storefront',
  hospital: 'medkit',
};

interface PoiIconProps {
  category?: PoiCategory;
  size?: number;
  color?: string;
}

export function PoiIcon({ category, size = 16, color = '#FFFFFF' }: PoiIconProps) {
  const name = category ? ICON_BY_CATEGORY[category] : 'location';
  return <Ionicons name={name} size={size} color={color} />;
}
