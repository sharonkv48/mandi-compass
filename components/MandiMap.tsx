'use client';

import React from 'react';
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { MandiSpot } from '@/types';

interface MandiMapProps {
  spots: MandiSpot[];
  onSpotSelect?: (spot: MandiSpot) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  showUserLocation?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

const GOOGLE_MAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function MandiMap({
  spots,
  onSpotSelect,
  center = { lat: 24.5, lng: 55.0 }, // Middle East default
  zoom = 5,
  className = 'h-64 w-full rounded-2xl overflow-hidden',
  showUserLocation = false,
  userLocation,
}: MandiMapProps) {
  if (!GOOGLE_MAPS_KEY) {
    return (
      <div className={`${className} bg-[#F5EDE3] flex flex-col items-center justify-center border border-[#EDE4D8] text-center p-6`}>
        <div className="text-[#C45C26] mb-2">🗺️</div>
        <div className="font-medium text-sm">Live map disabled</div>
        <div className="text-xs text-[#6B5F55] mt-1 max-w-[220px]">
          Add <code className="font-mono">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code> to .env.local to enable beautiful Google Maps with real Mandi spots.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <APIProvider apiKey={GOOGLE_MAPS_KEY}>
        <Map
          defaultCenter={center}
          defaultZoom={zoom}
          gestureHandling="greedy"
          disableDefaultUI={true}
          mapId="mandi-compass-map"
          style={{ width: '100%', height: '100%' }}
        >
          {spots.map((spot) => (
            <AdvancedMarker
              key={spot.id}
              position={{ lat: spot.lat, lng: spot.lng }}
              title={spot.name}
              onClick={() => onSpotSelect?.(spot)}
            >
              <Pin 
                background="#C45C26" 
                borderColor="#2C2522" 
                glyphColor="#FDF8F3" 
              />
            </AdvancedMarker>
          ))}

          {showUserLocation && userLocation && (
            <AdvancedMarker position={userLocation}>
              <div className="w-3.5 h-3.5 bg-blue-500 rounded-full ring-2 ring-white shadow" />
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
