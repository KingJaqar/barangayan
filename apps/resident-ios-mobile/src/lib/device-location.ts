import { DeviceLocationController, describeDeviceLocation, type LocationAdapter } from '@barangayan/shared';
import * as Location from 'expo-location';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';
import { iosFix, iosPermission } from './location-core';

const iosLocationAdapter: LocationAdapter = {
  availability: () => 'ok',
  getPermission: async () => iosPermission(await Location.getForegroundPermissionsAsync()),
  requestPermission: async () => iosPermission(await Location.requestForegroundPermissionsAsync()),
  servicesEnabled: () => Location.hasServicesEnabledAsync(),
  watch: async (onFix, onError) => {
    const subscription = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, distanceInterval: 0 },
      (location) => onFix(iosFix(location, 'current')),
      () => onError('unavailable'),
    );
    return () => subscription.remove();
  },
  lastKnown: async () => {
    const location = await Location.getLastKnownPositionAsync();
    return location ? iosFix(location, 'last-known') : null;
  },
};

/**
 * Foreground-only device location for one screen (plan P02-T06): one controller per
 * screen, stopped in the background, re-checked on return (including from Settings), and
 * cancelled when the screen goes away so late callbacks are ignored. Coordinates stay in
 * memory only. Feature journeys (Maps, centers, location verification) own the UI.
 */
export function useDeviceLocation(active: boolean) {
  const [controller] = useState(() => new DeviceLocationController(iosLocationAdapter));
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
    message: describeDeviceLocation(state, 'ios'),
    locate: () => { void controller.start('explicit'); },
    cancel: () => controller.cancel(),
    confirm: () => controller.confirmPending(),
    reject: () => controller.rejectPending(),
    openSettings: () => { void Linking.openSettings(); },
  };
}
