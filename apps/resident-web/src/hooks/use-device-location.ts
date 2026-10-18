'use client';

import {
  DeviceLocationController,
  LOCATION_ACQUISITION_TIMEOUT_MS,
  type LocationAdapter,
  type LocationPermission,
} from '@barangayan/shared';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { beginAttempt, notify, type OperationId } from '@/lib/notify';

const PROMPT: LocationPermission = { state: 'prompt', canAskAgain: true, approximate: false };

async function queryPermission(): Promise<PermissionStatus | null> {
  if (!navigator.permissions?.query) return null;
  try {
    return await navigator.permissions.query({ name: 'geolocation' });
  } catch {
    return null;
  }
}

const browserLocationAdapter: LocationAdapter = {
  availability: () => {
    if (!window.isSecureContext) return 'insecure-context';
    if (!('geolocation' in navigator)) return 'unsupported';
    return 'ok';
  },
  // Without the Permissions API the state is unknown, so automatic acquisition waits for
  // an explicit "Use my location" (the browser prompts as part of the watch).
  getPermission: async () => {
    const status = await queryPermission();
    if (!status) return PROMPT;
    return { state: status.state, canAskAgain: status.state !== 'denied', approximate: false };
  },
  servicesEnabled: async () => true,
  watch: async (onFix, onError) => {
    const watchId = navigator.geolocation.watchPosition(
      (position) =>
        onFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
          deviceTimestamp: position.timestamp,
          receivedAt: Date.now(),
          source: 'current',
        }),
      (error) =>
        onError(
          error.code === error.PERMISSION_DENIED ? 'denied' : error.code === error.TIMEOUT ? 'timed-out' : 'unavailable',
        ),
      { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATION_ACQUISITION_TIMEOUT_MS },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  },
};

/**
 * One device-location controller per Centers screen (DRRM routing plan R1). Acquires
 * automatically only when the browser reports permission as already granted, stops while
 * the tab is hidden, and restarts when the site permission changes.
 */
export function useDeviceLocation() {
  const [controller] = useState(() => new DeviceLocationController(browserLocationAdapter));
  const state = useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
  const attempt = useRef<OperationId | null>(null);
  const [explicitOriginRevision, setExplicitOriginRevision] = useState<number | null>(null);
  const [originNotificationId, setOriginNotificationId] = useState<OperationId | null>(null);
  const routeAttempt = useRef<OperationId | null>(null);
  const [outcomeAnnounced, setOutcomeAnnounced] = useState(false);

  useEffect(() => controller.subscribe(() => {
    const id = attempt.current;
    if (!id) { setOutcomeAnnounced(false); return; }
    const next = controller.getState();
    if (next.status === 'ready' || next.pending) {
      attempt.current = null;
      setOutcomeAnnounced(true);
      if (next.status === 'ready') { setExplicitOriginRevision(next.origin?.revision ?? null); setOriginNotificationId(routeAttempt.current); }
      notify.success('Location found. Review it before continuing.', { id });
    } else if (['denied', 'services-disabled', 'unavailable', 'timed-out'].includes(next.status)) {
      attempt.current = null;
      setOutcomeAnnounced(true);
      notify.error("Couldn't find your location. Check location access and try again.", { id });
    }
  }), [controller]);

  useEffect(() => {
    void controller.start('auto');

    function handleVisibility() {
      if (document.visibilityState === 'hidden') { attempt.current = null; controller.pause(); }
      else void controller.resume();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    let permissionStatus: PermissionStatus | null = null;
    let disposed = false;
    const handlePermissionChange = () => {
      // A granted browser prompt can restart acquisition. Its result still belongs
      // to the explicit locate that opened the prompt; later idle changes stay quiet.
      void controller.resume();
    };
    void queryPermission().then((status) => {
      if (disposed || !status) return;
      permissionStatus = status;
      status.addEventListener('change', handlePermissionChange);
    });

    return () => {
      disposed = true;
      attempt.current = null;
      document.removeEventListener('visibilitychange', handleVisibility);
      permissionStatus?.removeEventListener('change', handlePermissionChange);
      controller.cancel();
    };
  }, [controller]);

  return {
    state,
    outcomeAnnounced,
    explicitOriginRevision,
    originNotificationId,
    locate: () => {
      if (controller.getState().activeRequestId !== null) return;
      attempt.current = beginAttempt('centers-location');
      setOutcomeAnnounced(false);
      routeAttempt.current = beginAttempt('walking-route');
      void controller.start('explicit');
    },
    cancel: () => { attempt.current = null; controller.cancel(); },
    confirm: () => {
      if (!controller.getState().pending) return;
      attempt.current = null;
      controller.confirmPending();
      setOutcomeAnnounced(true);
      setExplicitOriginRevision(controller.getState().origin?.revision ?? null);
      setOriginNotificationId(beginAttempt('walking-route'));
      notify.success('Location selected for route planning.', { id: beginAttempt('centers-confirm-location') });
    },
    reject: () => {
      if (!controller.getState().pending) return;
      attempt.current = null;
      controller.rejectPending();
      setOutcomeAnnounced(true);
      notify.info('Location discarded.', { id: beginAttempt('centers-discard-location') });
    },
  };
}
