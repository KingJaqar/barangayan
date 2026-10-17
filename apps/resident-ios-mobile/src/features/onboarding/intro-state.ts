import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/** Device-level, non-sensitive marker: the introduction has been opened or skipped before. */
export const INTRO_SEEN_KEY = 'resident-ios.intro-seen.v1';

export async function readIntroSeen(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === '1'; } catch { return false; }
}
export async function markIntroSeen(): Promise<void> {
  try { await AsyncStorage.setItem(INTRO_SEEN_KEY, '1'); } catch { /* The introduction simply stays offered; nothing the resident needs is lost. */ }
}

/** `null` while unknown. Never blocks anything: the account-choice screen is the signed-out root either way. */
export function useIntroSeen(): boolean | null {
  const [seen, setSeen] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void readIntroSeen().then((value) => { if (active) setSeen(value); });
    return () => { active = false; };
  }, []);
  return seen;
}
