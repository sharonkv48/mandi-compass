/**
 * Pure geo utilities for Mandi Compass
 * Bearing + distance formulas adapted from research + standard movable-type.co.uk
 * Lightweight, no external deps needed (geolib also installed as alternative)
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculate initial bearing (great-circle) from point A to B in degrees (0-360, clockwise from North)
 */
export function calculateBearing(from: LatLng, to: LatLng): number {
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const λ1 = (from.lng * Math.PI) / 180;
  const λ2 = (to.lng * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Haversine distance in meters
 */
export function haversineDistance(from: LatLng, to: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Estimate walking time in minutes (avg 5 km/h)
 */
export function estimateWalkingMinutes(distanceMeters: number, speedKmh = 5): number {
  if (distanceMeters <= 0) return 0;
  const speedMps = (speedKmh * 1000) / 3600;
  return Math.max(1, Math.ceil(distanceMeters / speedMps / 60));
}

/**
 * Difference between two angles (shortest path, -180 to +180)
 */
export function angleDiff(a: number, b: number): number {
  let diff = ((a - b + 180) % 360) - 180;
  return diff;
}

/**
 * Returns true if user heading is reasonably aligned with bearing to target (±threshold)
 */
export function isAligned(heading: number, bearing: number, thresholdDeg = 18): boolean {
  return Math.abs(angleDiff(heading, bearing)) <= thresholdDeg;
}

/**
 * Format distance nicely for UI
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
