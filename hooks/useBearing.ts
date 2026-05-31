'use client';

import { useState, useEffect } from 'react';
import { calculateBearing, haversineDistance, estimateWalkingMinutes, LatLng } from '@/lib/geo';

interface UseBearingResult {
  bearing: number;
  distance: number;
  etaMinutes: number;
  userPos: LatLng | null;
}

export function useBearing(target: LatLng | null): UseBearingResult {
  const [userPos, setUserPos] = useState<LatLng | null>(null);
  const [bearing, setBearing] = useState(0);
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    if (!target) return;

    let watchId: number | null = null;

    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newPos = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          };
          setUserPos(newPos);

          const b = calculateBearing(newPos, target);
          const d = haversineDistance(newPos, target);

          setBearing(b);
          setDistance(d);
        },
        (err) => {
          console.warn('Geolocation error in useBearing:', err.message);
        },
        { enableHighAccuracy: true, maximumAge: 8000, timeout: 15000 }
      );
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [target?.lat, target?.lng]);

  const etaMinutes = estimateWalkingMinutes(distance);

  return { bearing, distance, etaMinutes, userPos };
}
