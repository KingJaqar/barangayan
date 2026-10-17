import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { subscribeToChanges } from '../../data/realtime';
import { uuid } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { residentError } from '../../lib/errors';
import { useResident } from '../../lib/runtime';
import { qrFunctions } from './qr-functions';
import { POLL_INTERVAL_MS, QrSession } from './qr-session';

/**
 * One QR PH attempt bound to the signed-in account and one request. The provider is checked
 * every few seconds only while this screen is focused and the app is in the foreground, a
 * realtime change of the payment row triggers a re-read, and everything stops on leaving.
 */
export function useQrSession(requestId: string) {
  const api = useApi();
  const { client } = useResident();
  const [session] = useState(() => {
    const functions = qrFunctions(client);
    const id = uuid.parse(requestId);
    return new QrSession({
      functions: { create: (signal) => functions.create(id, signal), check: (paymentId, signal) => functions.check(paymentId, signal), cancel: (paymentId) => functions.cancel(paymentId) },
      reads: {
        openAttempt: (signal) => api.openQrAttempt(id, signal),
        status: (paymentId, signal) => api.paymentStatus(paymentId, signal),
        hasPaid: async (signal) => (await api.paidReceipt(id, signal)) !== null,
      },
      now: () => Date.now(),
      describe: residentError,
    });
  });
  const state = useSyncExternalStore(session.subscribe, session.getState);

  useEffect(() => {
    session.open();
    void session.start();
    return () => session.close();
  }, [session]);

  const watching = state.phase === 'pending';
  const paymentId = state.source?.paymentId ?? null;
  useFocusEffect(useCallback(() => {
    if (!watching) return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => { if (timer) clearInterval(timer); timer = undefined; };
    const run = () => { stop(); timer = setInterval(() => void session.poll(), POLL_INTERVAL_MS); };
    if (AppState.currentState === 'active') run();
    const lifecycle = AppState.addEventListener('change', (next) => {
      if (next === 'active') { run(); void session.check(); } else stop();
    });
    const unsubscribe = paymentId
      ? subscribeToChanges(client, 'qr-payment', [{ table: 'payments', filter: `id=eq.${paymentId}` }], () => void session.refreshFromRecord())
      : undefined;
    return () => { stop(); lifecycle.remove(); unsubscribe?.(); };
  }, [watching, paymentId, session, client]));

  return { session, state };
}
