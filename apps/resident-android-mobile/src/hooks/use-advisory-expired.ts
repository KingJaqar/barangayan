import type { Tables } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';
import { advisoryExpiry } from '@/lib/home-announcement';

/** One future expiry callback while the existing feed/detail is visible. */
export function useAdvisoryExpired(item: Tables<'announcements'> | null, visible = true) {
  const expiry = item ? advisoryExpiry(item) : null;
  const [now, setNow] = useState(Date.now);
  useFocusEffect(useCallback(() => {
    if (!visible || expiry === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = () => {
      clearTimeout(timer);
      const time = Date.now();
      setNow(time);
      if (expiry > time) timer = setTimeout(tick, Math.min(expiry - time, 2_147_483_647));
    };
    if (AppState.currentState !== 'background' && AppState.currentState !== 'inactive') tick();
    const listener = AppState.addEventListener('change', state => { clearTimeout(timer); if (state === 'active') tick(); });
    return () => { clearTimeout(timer); listener.remove(); };
  }, [expiry, visible]));
  return expiry !== null && expiry <= now;
}
