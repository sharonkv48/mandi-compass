'use client';

import { useState, useCallback, useEffect } from 'react';

function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function useCompassPermission() {
  const [status, setStatus] = useState<'idle' | 'granted' | 'denied'>('idle');
  const [error, setError] = useState<string | null>(null);
  const isIOS = isIOSDevice();

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError(null);

    try {
      // iOS 13+ requires an explicit user-gesture to unlock DeviceOrientationEvent
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        const response = await (DeviceOrientationEvent as any).requestPermission();
        if (response === 'granted') {
          setStatus('granted');
          return true;
        } else {
          setStatus('denied');
          setError('Compass permission denied. Enable in Safari Settings → Website Settings.');
          return false;
        }
      } else {
        // Android / desktop / older browsers — permission is implicit.
        // DeviceOrientationEvent fires without a gate; mark as granted.
        setStatus('granted');
        return true;
      }
    } catch (e) {
      setStatus('denied');
      setError('Failed to request device orientation permission.');
      return false;
    }
  }, []);

  // Auto-grant on non-iOS devices — they don't require user gesture
  useEffect(() => {
    if (!isIOS && status === 'idle') {
      requestPermission();
    }
  }, [isIOS, status, requestPermission]);

  return { status, error, requestPermission, isIOS };
}
