import {
  DeviceLocationController,
  type LocationAdapter,
  type LocationFix,
  type LocationFixSource,
  type LocationPermission,
} from '@barangayan/shared';
import * as Location from 'expo-location';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';

function toPermission(response: Location.LocationPermissionResponse): LocationPermission {
  return {
    state: response.granted ? 'granted' : response.status === Location.PermissionStatus.UNDETERMINED ? 'prompt' : 'denied',
    canAskAgain: response.canAskAgain,
    approximate: response.android?.accuracy === 'coarse',
  };
}

function toFix(location: Location.LocationObject, source: LocationFixSource): LocationFix {
  return {
    lat: location.coords.latitude,
    lng: location.coords.longitude,
    accuracyMeters: location.coords.accuracy,
    deviceTimestamp: location.timestamp,
    receivedAt: Date.now(),
    source,
  };
}

const expoLocationAdapter: LocationAdapter = {
  availability: () => 'ok',
  getPermission: async () => toPermission(await Location.getForegroundPermissionsAsync()),
  requestPermission: async () => toPermission(await Location.requestForegroundPermissionsAsync()),
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  watch: async (onFix, onError) => {
    const subscription = await Location.watchPositionAsync(
      // The improve-accuracy system dialog would background the app, which stops and
      // restarts acquisition; disabled-services is reported by servicesEnabled instead.
      { accuracy: Location.Accuracy.High, timeInterval: 1000, distanceInterval: 0, mayShowUserSettingsDialog: false },
      (location) => onFix(toFix(location, 'current')),
      () => onError('unavailable'),
    );
    return () => subscription.remove();
  },
  lastKnown: async () => {
    const location = await Location.getLastKnownPositionAsync();
    return location ? toFix(location, 'last-known') : null;
  },
};

/**
 * One device-location controller per Centers screen (DRRM routing plan R1). While
 * `active`, it acquires automatically when permission is already granted, stops when the
 * app is backgrounded, and re-checks permission/services when the app returns (e.g.
 * from Settings). Coordinates stay in memory only.
 */
export function useDeviceLocation(active: boolean) {
  const [controller] = useState(() => new DeviceLocationController(expoLocationAdapter));
  const state = useSyncExternalStore(controller.subscribe, controller.getState);

  useEffect(() => {
    if (!active) return;
    void controller.start('auto');
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') void controller.resume();
      else if (next === 'background') controller.pause();
    });
    return () => {
      subscription.remove();
      controller.cancel();
    };
  }, [active, controller]);

  return {
    state,
    locate: () => {
      void controller.start('explicit');
    },
    cancel: () => controller.cancel(),
    confirm: () => controller.confirmPending(),
    reject: () => controller.rejectPending(),
    openSettings: () => {
      void Linking.openSettings();
    },
  };
}
