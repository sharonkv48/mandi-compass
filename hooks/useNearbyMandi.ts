'use client';

import { useCallback, useEffect, useState } from 'react';
import type { MandiSpot } from '@/types';

export interface RealMandiSpot extends MandiSpot {
  distance?: number;
}

type CachedRealMandiState = {
  spots: RealMandiSpot[];
  userLocation: { lat: number; lng: number } | null;
};

interface UseNearbyMandiResult {
  spots: RealMandiSpot[];
  userLocation: { lat: number; lng: number } | null;
  isLoading: boolean;
  error: string | null;
  permissionState: 'prompt' | 'granted' | 'denied' | 'unknown';
  findNearbyMandi: (radiusKm?: number) => Promise<void>;
  requestLocationAndSearch: () => Promise<void>;
  hasRealData: boolean;
  clearRealData: () => void;
}

function haversineDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
) {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;

  return 2 * R * Math.asin(Math.sqrt(h));
}

const REAL_SPOTS_CACHE_KEY = 'mandi-compass-real-spots-cache';

function loadCachedRealMandiState(): CachedRealMandiState {
  if (typeof window === 'undefined') {
    return { spots: [], userLocation: null };
  }

  try {
    const raw = localStorage.getItem(REAL_SPOTS_CACHE_KEY);
    if (!raw) {
      return { spots: [], userLocation: null };
    }

    const parsed = JSON.parse(raw) as CachedRealMandiState;
    if (!Array.isArray(parsed.spots)) {
      return { spots: [], userLocation: null };
    }

    return {
      spots: parsed.spots,
      userLocation: parsed.userLocation ?? null,
    };
  } catch {
    return { spots: [], userLocation: null };
  }
}

function saveCachedRealMandiState(state: CachedRealMandiState) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(REAL_SPOTS_CACHE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures and keep the live flow working.
  }
}

export function useNearbyMandi(): UseNearbyMandiResult {
  const [spots, setSpots] = useState<RealMandiSpot[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const restoreCachedResults = () => {
      const cachedState = loadCachedRealMandiState();

      if (!cancelled && cachedState.spots.length > 0) {
        setSpots(cachedState.spots);
        setUserLocation(cachedState.userLocation);
        setHasRealData(true);
      }
    };

    const checkConfig = async () => {
      try {
        const response = await fetch('/api/places/config');
        const payload = await response.json();
        if (!cancelled) {
          setHasRealData(Boolean(payload?.enabled));
        }
      } catch {
        if (!cancelled) {
          setHasRealData(false);
        }
      }
    };

    restoreCachedResults();
    checkConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  const searchNearby = useCallback(async (lat: number, lng: number, radiusMeters = 30000) => {
    if (!hasRealData) {
      setError('Real search is not configured yet.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radiusMeters: String(radiusMeters),
      });

      const response = await fetch(`/api/places/nearby?${params.toString()}`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Search failed.');
      }

      const formatted: RealMandiSpot[] = (payload.spots || []).map((spot: RealMandiSpot) => {
        const distance = spot.distance ?? haversineDistanceMeters(
          { lat, lng },
          { lat: spot.lat, lng: spot.lng }
        );

        return {
          ...spot,
          distance,
        };
      });

      formatted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

      setSpots(formatted);
      setUserLocation({ lat, lng });
      setPermissionState('granted');
      saveCachedRealMandiState({
        spots: formatted,
        userLocation: { lat, lng },
      });
    } catch (err) {
      console.error('Nearby mandi search failed:', err);
      setError('Search failed. Showing demo spots instead.');
      // Keep any previously cached live results visible.
    } finally {
      setIsLoading(false);
    }
  }, [hasRealData]);

  const requestLocationAndSearch = useCallback(async (radiusMeters = 30000) => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }

    setIsLoading(true);
    setError(null);

    return new Promise<void>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          setPermissionState('granted');
          const { latitude, longitude } = pos.coords;
          await searchNearby(latitude, longitude, radiusMeters);
          resolve();
        },
        (err) => {
          if (err.code === 1) {
            setPermissionState('denied');
            setError('Location permission denied. You can still explore the demo spots.');
          } else {
            setError('Could not get your location.');
          }
          setIsLoading(false);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 12000 }
      );
    });
  }, [searchNearby]);

  const findNearbyMandi = useCallback(async (radiusKm = 30) => {
    const radiusMeters = Math.min(radiusKm * 1000, 100000);
    await requestLocationAndSearch(radiusMeters);
  }, [requestLocationAndSearch]);

  const clearRealData = useCallback(() => {
    setSpots([]);
    setUserLocation(null);
    setError(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(REAL_SPOTS_CACHE_KEY);
    }
  }, []);

  return {
    spots,
    userLocation,
    isLoading,
    error,
    permissionState,
    findNearbyMandi,
    requestLocationAndSearch,
    hasRealData,
    clearRealData,
  };
}
