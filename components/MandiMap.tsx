'use client';

import React from 'react';
import type { MandiSpot } from '@/types';

interface MandiMapProps {
  spots: MandiSpot[];
  onSpotSelect?: (spot: MandiSpot) => void;
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
  showUserLocation?: boolean;
  userLocation?: { lat: number; lng: number } | null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function toPercentPoint(
  lat: number,
  lng: number,
  center: { lat: number; lng: number },
  zoom: number
) {
  const scale = Math.max(zoom, 1);
  const latSpan = Math.max(0.04, 0.9 / scale);
  const lngSpan = Math.max(0.06, 1.1 / scale);

  const x = 50 + ((lng - center.lng) / lngSpan) * 50;
  const y = 50 - ((lat - center.lat) / latSpan) * 50;

  return {
    left: `${clamp(x, 8, 92)}%`,
    top: `${clamp(y, 8, 92)}%`,
  };
}

export function MandiMap({
  spots,
  onSpotSelect,
  center = { lat: 24.5, lng: 55.0 },
  zoom = 5,
  className = 'h-64 w-full rounded-2xl overflow-hidden',
  showUserLocation = false,
  userLocation,
}: MandiMapProps) {
  const visibleSpots = spots.slice(0, 8);

  return (
    <div
      className={`${className} relative isolate overflow-hidden border border-[#EDE4D8] bg-gradient-to-br from-[#F7EFE5] via-[#F2E7DA] to-[#E9DDCF]`}
    >
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(180,83,42,0.12) 0, transparent 22%), radial-gradient(circle at 80% 30%, rgba(42,63,53,0.10) 0, transparent 20%), linear-gradient(rgba(31,26,23,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(31,26,23,0.06) 1px, transparent 1px)',
          backgroundSize: 'auto, auto, 32px 32px, 32px 32px',
        }}
      />

      <div className="absolute left-3 top-3 z-10 rounded-full bg-white/80 px-3 py-1 text-[10px] font-semibold tracking-[1.5px] text-[#5C5148] backdrop-blur">
        LOCAL MAP
      </div>
      <div className="absolute right-3 top-3 z-10 rounded-full bg-[#2A3F35] px-3 py-1 text-[10px] font-semibold tracking-[1.5px] text-[#F9F4ED] shadow-sm">
        {visibleSpots.length} SPOTS
      </div>

      <div className="absolute inset-0">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <circle cx="50" cy="50" r="38" fill="none" stroke="#1F1A17" strokeOpacity="0.08" strokeWidth="0.5" />
          <circle cx="50" cy="50" r="24" fill="none" stroke="#1F1A17" strokeOpacity="0.06" strokeWidth="0.5" />
          <line x1="50" y1="6" x2="50" y2="94" stroke="#1F1A17" strokeOpacity="0.07" strokeWidth="0.4" />
          <line x1="6" y1="50" x2="94" y2="50" stroke="#1F1A17" strokeOpacity="0.07" strokeWidth="0.4" />
        </svg>

        {visibleSpots.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <div>
              <div className="text-lg font-semibold text-[#2C2522]">No spots yet</div>
              <div className="mt-1 text-xs text-[#6B5F55]">
                Search for nearby mandi places to populate this map.
              </div>
            </div>
          </div>
        ) : (
          visibleSpots.map((spot, index) => {
            const point = toPercentPoint(spot.lat, spot.lng, center, zoom);
            const isPrimary = index === 0;

            return (
              <button
                key={spot.id}
                type="button"
                onClick={() => onSpotSelect?.(spot)}
                className="group absolute z-10 -translate-x-1/2 -translate-y-1/2"
                style={point}
                title={spot.name}
              >
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-full border shadow-md transition-transform duration-200 group-hover:scale-110 ${
                    isPrimary
                      ? 'border-[#8C3F20] bg-[#B4532A] text-white'
                      : 'border-[#2A3F35]/20 bg-white text-[#2A3F35]'
                  }`}
                >
                  <span className="text-[10px] font-bold tracking-wide">
                    {spot.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="mt-1 max-w-28 rounded-full bg-black/70 px-2 py-0.5 text-[10px] leading-tight text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  {spot.name}
                </div>
              </button>
            );
          })
        )}

        {showUserLocation && userLocation && (
          <div
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={toPercentPoint(userLocation.lat, userLocation.lng, center, zoom)}
          >
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-500/30" />
              <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-md" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
