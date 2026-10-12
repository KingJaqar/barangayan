'use client';

import {
  DeviceLocationController,
  LOCATION_ACQUISITION_TIMEOUT_MS,
  type LocationAdapter,
  type LocationPermission,
} from '@barangayan/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';

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

  useEffect(() => {
    void controller.start('auto');

    function handleVisibility() {
      if (document.visibilityState === 'hidden') controller.pause();
      else void controller.resume();
    }
    document.addEventListener('visibilitychange', handleVisibility);

    let permissionStatus: PermissionStatus | null = null;
    let disposed = false;
    const handlePermissionChange = () => {
      void controller.resume();
    };
    void queryPermission().then((status) => {
      if (disposed || !status) return;
      permissionStatus = status;
      status.addEventListener('change', handlePermissionChange);
    });

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      permissionStatus?.removeEventListener('change', handlePermissionChange);
      controller.cancel();
    };
  }, [controller]);

  return {
    state,
    locate: () => {
      void controller.start('explicit');
    },
    cancel: () => controller.cancel(),
    confirm: () => controller.confirmPending(),
    reject: () => controller.rejectPending(),
  };
}
