import { idVerificationState } from '@barangayan/shared';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAuthFlow } from '../../auth/auth-flow';
import { residentError } from '../../lib/errors';
import { useLatest } from '../../lib/use-latest';
import { useResident } from '../../lib/runtime';
import type { IdReadiness } from './catalog';

/**
 * What a signed-in resident still needs before a service can be requested. The profile is
 * re-read each time the screen gains focus; a failed read is reported and never shown as an
 * approved ID. The server repeats every check at submission.
 */
export function useServiceReadiness() {
  const { session, profile, refreshProfile } = useResident();
  const { setup } = useAuthFlow();
  const refresh = useLatest(refreshProfile);
  const signedIn = !!session;
  const [check, setCheck] = useState<{ busy: boolean; error: string | null; confirmed: boolean }>({ busy: false, error: null, confirmed: false });
  const retry = useCallback(async () => {
    setCheck((previous) => ({ ...previous, busy: true, error: null }));
    try {
      await refresh.current();
      setCheck({ busy: false, error: null, confirmed: true });
    } catch (failure) {
      setCheck({ busy: false, error: residentError(failure), confirmed: false });
    }
  }, [refresh]);
  useFocusEffect(useCallback(() => { if (signedIn) void retry(); }, [signedIn, retry]));

  // Setup status that is still loading or unreadable must not claim an incomplete profile;
  // the setup enforcer owns that route.
  const profileComplete = setup.state !== 'ready' || setup.status.profileComplete;
  const idStatus: IdReadiness = check.error ? 'unknown' : check.busy && !check.confirmed ? 'unknown' : idVerificationState(profile);
  return { signedIn, profileComplete, idStatus, checking: check.busy, error: check.error, retry };
}
