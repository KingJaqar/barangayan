import type { LocationFix, LocationFixSource, LocationPermission } from '@barangayan/shared';

/**
 * Pure SDK 57 → shared-controller mapping for iOS (plan §6.4, P02-T06). iOS reports
 * precision through `ios.accuracy` ('full' | 'reduced'), not Android's coarse flag.
 * "Allow Once" is indistinguishable from When In Use in the response; the controller
 * re-checks permission whenever the app returns to the foreground.
 */
export function iosPermission(response: { granted: boolean; canAskAgain: boolean; status: string; ios?: { accuracy?: string } }): LocationPermission {
  return {
    state: response.granted ? 'granted' : response.status === 'undetermined' ? 'prompt' : 'denied',
    canAskAgain: response.canAskAgain,
    approximate: response.granted && response.ios?.accuracy === 'reduced',
  };
}

export function iosFix(location: { coords: { latitude: number; longitude: number; accuracy: number | null }; timestamp: number }, source: LocationFixSource, receivedAt = Date.now()): LocationFix {
  return { lat: location.coords.latitude, lng: location.coords.longitude, accuracyMeters: location.coords.accuracy, deviceTimestamp: location.timestamp, receivedAt, source };
}
