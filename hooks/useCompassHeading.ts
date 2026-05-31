'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCompassHeadingOptions {
  smoothing?: number; // 0.1 - 0.3 typical
}

export function useCompassHeading(options: UseCompassHeadingOptions = {}) {
  const { smoothing = 0.18 } = options;

  const [heading, setHeading] = useState(0);
  const [supported, setSupported] = useState(true);

  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  // Shortest angle lerp (prevents spinning the long way)
  const shortestLerp = (start: number, end: number, t: number) => {
    let diff = ((end - start + 180) % 360) - 180;
    return start + diff * t;
  };

  const animate = useCallback(() => {
    currentRef.current = shortestLerp(currentRef.current, targetRef.current, smoothing);
    setHeading(Math.round(currentRef.current));
    frameRef.current = requestAnimationFrame(animate);
  }, [smoothing]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    let h = 0;

    // iOS Safari - best absolute heading
    if ((event as any).webkitCompassHeading != null) {
      h = (event as any).webkitCompassHeading;
    } else if (event.alpha != null) {
      // Android + others. Common adjustment.
      const screenAngle = (window.screen as any)?.orientation?.angle || 0;
      h = (360 - event.alpha + screenAngle) % 360;
    }

    targetRef.current = h;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSupported(false);
      return;
    }

    // Start the smooth animation loop
    frameRef.current = requestAnimationFrame(animate);

    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [animate, handleOrientation]);

  return { heading, supported };
}
