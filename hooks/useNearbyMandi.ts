'use client';

import { useState, useCallback } from 'react';
import type { MandiSpot } from '@/types';
import { haversineDistance } from '@/lib/geo';

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export interface RealMandiSpot extends MandiSpot {
  distance?: number;
}

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

export function useNearbyMandi(): UseNearbyMandiResult {
  const [spots, setSpots] = useState<RealMandiSpot[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionState, setPermissionState] = useState<'prompt' | 'granted' | 'denied' | 'unknown'>('unknown');

  const searchNearby = useCallback(async (lat: number, lng: number, radiusMeters = 30000) => {
    if (!GOOGLE_MAPS_KEY) {
      setError('Add your Google Maps API key to enable live search.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Ensure Google Maps JS is loaded
      if (!(window as any).google?.maps) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_KEY}&libraries=places`;
          script.async = true;
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load Google Maps'));
          document.head.appendChild(script);
        });
      }

      const { Place } = await (window as any).google.maps.importLibrary('places') as any;

      const center = { lat, lng };

      // Request the fields we need, including photos
      const request = {
        textQuery: 'mandi restaurant OR yemeni mandi OR mandi rice',
        locationBias: { center, radius: radiusMeters },
        maxResultCount: 20,
        language: 'en',
        fields: [
          'displayName',
          'formattedAddress',
          'location',
          'rating',
          'userRatingCount',
          'priceLevel',
          'photos',
        ],
      };

      const { places } = await Place.searchByText(request);

      if (!places || places.length === 0) {
        setError('No mandi spots found in this area yet. Try a bigger city (Dubai, Jeddah, Hyderabad...).');
        setSpots([]);
        return;
      }

      const formatted: RealMandiSpot[] = await Promise.all(
        places.slice(0, 15).map(async (place: any) => {
          let photoUrl: string | undefined;

          try {
            // If photos weren't returned in the initial search, fetch them explicitly
            if (!place.photos?.length) {
              await place.fetchFields({ fields: ['photos'] });
            }

            if (place.photos?.length > 0) {
              photoUrl = place.photos[0].getURI({ maxHeight: 600, maxWidth: 800 });
            }
          } catch (photoErr) {
            console.warn('Photo fetch failed for place', place.id, photoErr);
          }

          const spotLat = place.location?.lat?.() ?? place.location?.latitude ?? lat;
          const spotLng = place.location?.lng?.() ?? place.location?.longitude ?? lng;

          const distance = haversineDistance(
            { lat, lng },
            { lat: spotLat, lng: spotLng }
          );

          return {
            id: place.id || place.name || Math.random().toString(36).slice(2),
            name: place.displayName || place.name || 'Mandi Restaurant',
            lat: spotLat,
            lng: spotLng,
            address: place.formattedAddress || place.address || 'Nearby',
            rating: place.rating,
            userRatingCount: place.userRatingCount,
            priceLevel: place.priceLevel ? Number(place.priceLevel) : undefined,
            photoUrl: photoUrl || `https://picsum.photos/id/${Math.floor(Math.random() * 50) + 10}/600/400`,
            distance,
          };
        })
      );

      // Sort by distance (closest first)
      formatted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));

      setSpots(formatted);
      setUserLocation({ lat, lng });
    } catch (err: any) {
      console.error('Google Places search failed:', err);
      setError('Search failed. Showing demo spots instead.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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
    const radiusMeters = Math.min(radiusKm * 1000, 100000); // cap at 100km
    await requestLocationAndSearch(radiusMeters);
  }, [requestLocationAndSearch]);

  const clearRealData = useCallback(() => {
    setSpots([]);
    setUserLocation(null);
    setError(null);
  }, []);

  const hasRealData = !!GOOGLE_MAPS_KEY;

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
