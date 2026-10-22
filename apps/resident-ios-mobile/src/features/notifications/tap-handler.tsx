import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { residentApi } from '../../data/resident-api';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { clearNotificationTap, useNotificationTap } from './native-push';
import { createReplayGuard, resolveTap, type TapOutcome } from './tap-routing';

/**
 * Opens the screen a tapped notification points at (A52-009, G13). The tap arrives the same way from a cold start, a warm
 * app and a foreground banner. The payload is only a pointer: `resolveTap` reads the signed-in resident's own inbox row and
 * opens its stored destination, and any mismatch, purged entry or other account's notification lands in the inbox with an
 * explanation instead. A tap while signed out is dropped. Each response is handled once.
 */
export function NotificationTapHandler() {
  const { client, config, session } = useResident();
  const router = useRouter();
  const tap = useNotificationTap();
  const [guard] = useState(() => createReplayGuard());
  const userId = session?.user.id;
  const latest = useLatest({ router, client, barangayId: config.barangayId });

  useEffect(() => {
    if (!tap) return;
    if (!userId || !releaseGates.remotePush) { clearNotificationTap(); return; }
    if (guard.handled(tap.id)) return;
    const controller = new AbortController();
    const { client: current, barangayId } = latest.current;
    const api = residentApi(current, barangayId, userId);
    void (async () => {
      let outcome: TapOutcome;
      try {
        outcome = await resolveTap(tap.data, (inboxId, signal) => api.inboxItem(inboxId, signal), controller.signal);
      } catch {
        outcome = { kind: 'inbox', reason: 'unreachable' };
      }
      if (controller.signal.aborted) return;
      clearNotificationTap();
      if (outcome.kind === 'open') {
        // Opening it is reading it; a failed mark leaves it unread, which is accurate.
        void api.setInboxRead(outcome.inboxId, true).catch(() => undefined);
        latest.current.router.push(outcome.href);
      } else {
        latest.current.router.push({ pathname: '/notifications', params: { notice: outcome.reason } });
      }
    })();
    return () => controller.abort();
  }, [tap, userId, guard, latest]);

  return null;
}
