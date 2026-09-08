import { useCallback, useState } from 'react';
import { getMe, setMe as persistMe } from '../lib/identity.js';

export function useMe(): [string, (name: string) => void] {
  const [me, setMeState] = useState(getMe);
  const update = useCallback((name: string) => {
    persistMe(name);
    setMeState(name);
  }, []);
  return [me, update];
}
