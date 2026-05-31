'use client';

import { useState, useCallback } from 'react';

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
      // iOS 13+ requires explicit user-gesture call
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
        // Android / desktop / older browsers — assume granted or will fail gracefully on listen
        setStatus('granted');
        return true;
      }
    } catch (e) {
      setStatus('denied');
      setError('Failed to request device orientation permission.');
      return false;
    }
  }, []);

  return { status, error, requestPermission, isIOS };
}
