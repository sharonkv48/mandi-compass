'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface UseCompassHeadingOptions {
  smoothing?: number; // 0.05 - 0.25 typical
}

export function useCompassHeading(options: UseCompassHeadingOptions = {}) {
  const { smoothing = 0.16 } = options;

  const [heading, setHeading] = useState(0);
  const [supported, setSupported] = useState(true);

  const targetRef = useRef(0);
  const currentRef = useRef(0);
  const frameRef = useRef<number | null>(null);
  const hasRealDataRef = useRef(false);

  // Shortest-path lerp — prevents spinning the long way around 360/0 wrap
  const shortestLerp = (start: number, end: number, t: number) => {
    let diff = ((end - start + 540) % 360) - 180;
    return (start + diff * t + 360) % 360;
  };

  const animate = useCallback(() => {
    currentRef.current = shortestLerp(currentRef.current, targetRef.current, smoothing);
    setHeading(Math.round(currentRef.current * 10) / 10);
    frameRef.current = requestAnimationFrame(animate);
  }, [smoothing]);

  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    let h = 0;
    hasRealDataRef.current = true;

    // iOS Safari — provides webkitCompassHeading which is already true North
    if ((event as any).webkitCompassHeading != null) {
      h = (event as any).webkitCompassHeading;
    } else if (event.alpha != null) {
      // Android Chrome & others:
      // event.alpha = rotation around Z-axis (0-360). On most Android browsers
      // alpha=0 corresponds to the device pointing to North when 'absolute' is true.
      // Screen orientation angle must be SUBTRACTED (not added) to compensate for
      // how the browser measures alpha relative to the screen's natural orientation.
      const screenAngle = (window.screen as any)?.orientation?.angle ?? 0;
      h = (360 - event.alpha - screenAngle + 720) % 360;
    }

    targetRef.current = h;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setSupported(false);
      return;
    }

    // Start smooth animation loop
    frameRef.current = requestAnimationFrame(animate);

    // `deviceorientationabsolute` gives true-north readings on Android Chrome
    // without needing any additional calibration. Fall back to `deviceorientation`
    // which uses an arbitrary reference on Android but is the only option on iOS.
    const supportsAbsolute = 'ondeviceorientationabsolute' in window;

    if (supportsAbsolute) {
      window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
    }
    // Always also listen to deviceorientation (for iOS webkitCompassHeading)
    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (supportsAbsolute) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener, true);
      }
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [animate, handleOrientation]);

  return { heading, supported };
}
