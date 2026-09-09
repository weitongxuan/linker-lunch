import { useCallback, useState } from 'react';
import type { LatLng } from '@lunch-map/shared';

export type LocationStatus = 'idle' | 'locating' | 'ready' | 'denied' | 'unavailable';

interface MyLocation {
  coords: LatLng | null;
  status: LocationStatus;
  request: () => void;
  clear: () => void;
}

/**
 * 用瀏覽器定位取代 config.office 當作距離計算的原點。
 * 只存在記憶體裡,重新整理就回到辦公室座標。
 */
export function useMyLocation(): MyLocation {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setStatus('ready');
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus('idle');
  }, []);

  return { coords, status, request, clear };
}
