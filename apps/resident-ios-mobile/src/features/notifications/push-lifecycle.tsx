import { useEffect } from 'react';
import { AppState } from 'react-native';
import { residentApi } from '../../data/resident-api';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { configureForegroundPresentation, nativePushPort, onDeviceTokenChange } from './native-push';
import { pushQueue, registerDevice, releaseDevice, retryPendingRelease } from './push-controller';
import { pushRecordStore } from './push-store';

/**
 * Keeps this iPhone's push registration in step with the signed-in resident (A44-004…006). It registers when an eligible
 * session starts and each time the app returns to the foreground or the device's push address changes, and removes the token
 * when the saved switch is off. It never shows the permission prompt: only turning alerts on in Settings may. Failures are not
 * shown here; Settings → Notifications reads the real state, and every trigger tries again.
 */
export function PushLifecycle() {
  const { client, config, session, profile } = useResident();
  const userId = session?.user.id;
  // A profile exists only after account setup; the column defaults to on.
  const eligible = releaseGates.remotePush && !!userId && profile !== null && profile.role === 'resident';
  const enabled = profile?.push_notifications_enabled ?? true;

  // A removal that could not be confirmed is retried with or without a session, because the server needs only the token.
  useEffect(() => {
    if (!releaseGates.remotePush) return;
    const api = residentApi(client, config.barangayId, userId);
    const store = pushRecordStore(new URL(config.url).hostname);
    let alive = true;
    const retry = () => { void pushQueue(async () => { if (alive) await retryPendingRelease({ api, store }); }).catch(() => undefined); };
    retry();
    const lifecycle = AppState.addEventListener('change', (next) => { if (next === 'active') retry(); });
    return () => { alive = false; lifecycle.remove(); };
  }, [userId, client, config.barangayId, config.url]);

  useEffect(() => {
    if (!eligible || !userId) return;
    configureForegroundPresentation();
    const api = residentApi(client, config.barangayId, userId);
    const store = pushRecordStore(new URL(config.url).hostname);
    let alive = true;
    const sync = () => {
      void pushQueue(async () => {
        if (!alive) return;
        if (enabled) await registerDevice({ port: nativePushPort, api, store, userId, enabled, askPermission: false });
        else await releaseDevice({ api, store, userId });
      }).catch(() => undefined);
    };
    sync();
    const lifecycle = AppState.addEventListener('change', (next) => { if (next === 'active') sync(); });
    const unsubscribe = onDeviceTokenChange(sync);
    return () => { alive = false; lifecycle.remove(); unsubscribe(); };
  }, [eligible, enabled, userId, client, config.barangayId, config.url]);

  return null;
}
