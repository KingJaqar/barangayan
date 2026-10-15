/**
 * Device-location controller for the Centers screens (DRRM routing plan, phase R1).
 *
 * One controller per Centers screen. It separates the raw `LocationFix` from the
 * `ConfirmedOrigin` used for routing; map viewport state never lives here, so panning
 * the map can never move the origin (plan invariant 1). Platform code supplies a
 * `LocationAdapter` (expo-location on Android, the Geolocation API on web).
 *
 * Deliberately import-free so the same file can be imported by Edge Functions by path
 * (R0 bundling decision) without pulling the shared package index.
 */

/** A high-accuracy fix with no age/accuracy concern is accepted without confirmation. */
export const LOCATION_AUTO_ACCEPT_MAX_AGE_MS = 2 * 60 * 1000;
export const LOCATION_AUTO_ACCEPT_MAX_ACCURACY_M = 50;
/** Acquisition shows "still searching" after this long... */
export const LOCATION_SLOW_AFTER_MS = 10 * 1000;
/** ...and stops after this long. */
export const LOCATION_ACQUISITION_TIMEOUT_MS = 45 * 1000;

export type LocationFixSource = 'current' | 'last-known';

export interface LocationFix {
  lat: number;
  lng: number;
  /** Radius of uncertainty in meters; null when the provider does not report one. */
  accuracyMeters: number | null;
  /** Provider timestamp (ms since epoch). */
  deviceTimestamp: number;
  /** When the app received the fix (ms since epoch). */
  receivedAt: number;
  source: LocationFixSource;
}

export interface ConfirmedOrigin {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  deviceTimestamp: number;
  /** 'device-auto' passed the quality checks; 'device-confirmed' was accepted by the resident. */
  source: 'device-auto' | 'device-confirmed';
  fixSource: LocationFixSource;
  /** Increases by one every time a new origin is accepted. Routes are keyed on it. */
  revision: number;
}

export type LocationStatus =
  | 'idle'
  | 'requesting-permission'
  | 'locating'
  | 'confirmation-required'
  | 'ready'
  | 'denied'
  | 'services-disabled'
  | 'unavailable'
  | 'timed-out';

/** Why a fix needs the resident's confirmation instead of being accepted automatically. */
export type FixConcern = 'last-known' | 'stale' | 'inaccurate' | 'accuracy-unknown' | 'approximate-permission';

export interface PendingFix {
  fix: LocationFix;
  concerns: FixConcern[];
}

export type LocationUnavailableReason = 'unsupported' | 'insecure-context' | 'provider';

export interface DeviceLocationState {
  status: LocationStatus;
  /** Non-null while an acquisition session owns the controller. */
  activeRequestId: number | null;
  /** The active acquisition has run past LOCATION_SLOW_AFTER_MS. */
  slow: boolean;
  /** Best unconfirmed fix of the latest session. Never used for routing until confirmed. */
  pending: PendingFix | null;
  /** Kept until a replacement is accepted, including across later failures. */
  origin: ConfirmedOrigin | null;
  /** Meaningful when status is 'denied': false means the OS/browser will not prompt again. */
  canAskAgain: boolean;
  /** The granted permission only allows approximate location (Android "Approximate", iOS Precise Location off). */
  approximate: boolean;
  unavailableReason: LocationUnavailableReason | null;
}

export interface LocationPermission {
  state: 'granted' | 'prompt' | 'denied';
  canAskAgain: boolean;
  approximate: boolean;
}

export type LocationWatchError = 'denied' | 'unavailable' | 'timed-out';

export interface LocationAdapter {
  /** Environment problems that make acquisition impossible before any request is made. */
  availability(): 'ok' | 'unsupported' | 'insecure-context';
  getPermission(): Promise<LocationPermission>;
  /** Absent when the platform prompts as part of `watch` (the browser Geolocation API). */
  requestPermission?(): Promise<LocationPermission>;
  servicesEnabled(): Promise<boolean>;
  /** Starts foreground high-accuracy updates; resolves to a function that stops them. */
  watch(onFix: (fix: LocationFix) => void, onError: (error: LocationWatchError) => void): Promise<() => void>;
  lastKnown?(): Promise<LocationFix | null>;
}

export const initialDeviceLocationState: DeviceLocationState = {
  status: 'idle',
  activeRequestId: null,
  slow: false,
  pending: null,
  origin: null,
  canAskAgain: true,
  approximate: false,
  unavailableReason: null,
};

export function isValidLocationFix(fix: LocationFix): boolean {
  return (
    Number.isFinite(fix.lat) &&
    Number.isFinite(fix.lng) &&
    Math.abs(fix.lat) <= 90 &&
    Math.abs(fix.lng) <= 180 &&
    Number.isFinite(fix.deviceTimestamp) &&
    Number.isFinite(fix.receivedAt) &&
    (fix.accuracyMeters === null || (Number.isFinite(fix.accuracyMeters) && fix.accuracyMeters >= 0))
  );
}

/** Age of the fix when the app received it, in ms (absolute, so clock skew counts as age). */
export function locationFixAgeMs(fix: LocationFix): number {
  return Math.abs(fix.receivedAt - fix.deviceTimestamp);
}

/**
 * Quality checks that decide automatic acceptance. An empty result means the fix may be
 * accepted without confirmation. Graph-attachment ambiguity joins these checks once the
 * routing graph exists (R2/R3).
 */
export function assessLocationFix(fix: LocationFix, approximatePermission: boolean): FixConcern[] {
  const concerns: FixConcern[] = [];
  if (fix.source === 'last-known') concerns.push('last-known');
  if (locationFixAgeMs(fix) > LOCATION_AUTO_ACCEPT_MAX_AGE_MS) concerns.push('stale');
  if (fix.accuracyMeters === null) concerns.push('accuracy-unknown');
  else if (fix.accuracyMeters > LOCATION_AUTO_ACCEPT_MAX_ACCURACY_M) concerns.push('inaccurate');
  if (approximatePermission) concerns.push('approximate-permission');
  return concerns;
}

export type LocationAction = 'locate' | 'retry' | 'cancel' | 'confirm' | 'reject' | 'open-settings';

export interface LocationStatusMessage {
  tone: 'info' | 'warning' | 'error';
  title: string;
  detail: string | null;
  /** An acquisition is still running (show a spinner). */
  busy: boolean;
  actions: LocationAction[];
}

function minutesText(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  return `${minutes} min`;
}

export type LocationPlatform = 'android' | 'ios' | 'web';

function concernText(concern: FixConcern, fix: LocationFix, platform: LocationPlatform): string {
  switch (concern) {
    case 'last-known':
      return `This is your last known location, about ${minutesText(locationFixAgeMs(fix))} old.`;
    case 'stale':
      return `This fix is about ${minutesText(locationFixAgeMs(fix))} old.`;
    case 'inaccurate':
      return `Accuracy is about ±${Math.round(fix.accuracyMeters ?? 0)} m.`;
    case 'accuracy-unknown':
      return 'Its accuracy is unknown.';
    case 'approximate-permission':
      if (platform === 'android') return 'Only approximate location is allowed. Turn on Precise location in Settings for a better fix.';
      if (platform === 'ios') return 'Only approximate location is allowed. Turn on Precise Location for Barangayan in Settings for a better fix.';
      return 'Only approximate location is available.';
  }
}

/**
 * Resident-facing wording for the current state, or null when nothing needs saying
 * (a fresh accepted origin). Shared so Android, iOS and web describe states identically.
 */
export function describeDeviceLocation(state: DeviceLocationState, platform: LocationPlatform): LocationStatusMessage | null {
  const native = platform !== 'web';
  const keptOrigin = state.origin ? ' Your previous location is still being used.' : '';
  switch (state.status) {
    case 'idle':
      return {
        tone: 'info',
        title: "Your location isn't set",
        detail: 'Use your location to sort centers by distance and show a walking route.',
        busy: false,
        actions: ['locate'],
      };
    case 'requesting-permission':
      return { tone: 'info', title: 'Checking location permission…', detail: null, busy: true, actions: [] };
    case 'locating':
      return {
        tone: 'info',
        title: 'Finding your location…',
        detail: state.slow ? 'Still searching. Moving near a window or into the open can help.' : null,
        busy: true,
        actions: ['cancel'],
      };
    case 'confirmation-required': {
      const pending = state.pending;
      if (!pending) return null;
      const details = pending.concerns.map((concern) => concernText(concern, pending.fix, platform));
      if (state.activeRequestId !== null) details.push('Still looking for a better fix…');
      const actions: LocationAction[] = ['confirm', 'reject'];
      if (native && pending.concerns.includes('approximate-permission')) actions.push('open-settings');
      return { tone: 'warning', title: 'Confirm your location', detail: details.join(' '), busy: state.activeRequestId !== null, actions };
    }
    case 'ready':
      if (state.origin?.fixSource !== 'last-known') return null;
      return {
        tone: 'info',
        title: 'Using your last known location',
        detail: 'Update it when you can get a fresh fix.',
        busy: false,
        actions: ['retry'],
      };
    case 'denied':
      if (state.canAskAgain) {
        return {
          tone: 'warning',
          title: 'Location permission is off',
          detail: (platform === 'web'
            ? "Allow location so Barangayan can find your nearest center. If you blocked it, allow it in your browser's site settings."
            : 'Allow location so Barangayan can find your nearest center.') + keptOrigin,
          busy: false,
          actions: ['locate'],
        };
      }
      return native
        ? { tone: 'warning', title: 'Location is blocked for Barangayan', detail: `Allow location in Settings, then come back.${keptOrigin}`, busy: false, actions: ['open-settings'] }
        : { tone: 'warning', title: 'Location is blocked for this site', detail: `Allow location in your browser's site settings, then try again.${keptOrigin}`, busy: false, actions: ['retry'] };
    case 'services-disabled':
      return {
        tone: 'warning',
        title: 'Location services are off',
        // iOS cannot deep-link to Location Services, so say where it is instead of offering Settings.
        detail: platform === 'ios'
          ? `Turn on Location Services in Settings > Privacy & Security, then try again.${keptOrigin}`
          : `Turn on location in your phone's settings.${keptOrigin}`,
        busy: false,
        actions: platform === 'android' ? ['open-settings', 'retry'] : ['retry'],
      };
    case 'unavailable':
      if (state.unavailableReason === 'insecure-context') {
        return { tone: 'error', title: 'Location needs a secure connection', detail: 'Open this page over https to use your location.', busy: false, actions: [] };
      }
      if (state.unavailableReason === 'unsupported') {
        return { tone: 'error', title: "This browser can't share your location", detail: null, busy: false, actions: [] };
      }
      return { tone: 'error', title: "Couldn't get your location", detail: `Try again in a moment.${keptOrigin}`, busy: false, actions: ['retry'] };
    case 'timed-out':
      return {
        tone: 'error',
        title: `No location fix after ${LOCATION_ACQUISITION_TIMEOUT_MS / 1000} seconds`,
        detail: `Try again outdoors or near a window.${keptOrigin}`,
        busy: false,
        actions: ['retry'],
      };
  }
}

function isBetterFix(candidate: LocationFix, current: LocationFix): boolean {
  if (candidate.source !== current.source) return candidate.source === 'current';
  const a = candidate.accuracyMeters ?? Infinity;
  const b = current.accuracyMeters ?? Infinity;
  if (a !== b) return a < b;
  return candidate.deviceTimestamp > current.deviceTimestamp;
}

interface Session {
  id: number;
  stopWatch: (() => void) | null;
  timers: ReturnType<typeof setTimeout>[];
}

export class DeviceLocationController {
  private state: DeviceLocationState = initialDeviceLocationState;
  private readonly listeners = new Set<() => void>();
  private session: Session | null = null;
  private nextRequestId = 1;
  private lastPermission: LocationPermission | null = null;
  /** A session was stopped by backgrounding and should restart on resume. */
  private interrupted = false;

  constructor(private readonly adapter: LocationAdapter) {}

  getState = (): DeviceLocationState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Starts an acquisition session. 'auto' (entering Centers) never prompts for permission;
   * 'explicit' ("Use my location") may prompt unless the platform said it will not ask again.
   */
  async start(mode: 'auto' | 'explicit'): Promise<void> {
    this.endSession();
    this.interrupted = false;
    const id = this.nextRequestId++;
    const session: Session = { id, stopWatch: null, timers: [] };
    this.session = session;

    const environment = this.adapter.availability();
    if (environment !== 'ok') {
      this.finish(id, { status: 'unavailable', unavailableReason: environment });
      return;
    }

    this.set({ status: 'requesting-permission', activeRequestId: id, slow: false, pending: null, unavailableReason: null });

    try {
      let permission = await this.adapter.getPermission();
      if (!this.owns(id)) return;
      this.lastPermission = permission;

      if (permission.state !== 'granted') {
        if (mode === 'auto') {
          this.finish(id, permission.state === 'denied'
            ? { status: 'denied', canAskAgain: permission.canAskAgain }
            : { status: this.restingStatus() });
          return;
        }
        if (permission.state === 'denied' && !permission.canAskAgain) {
          this.finish(id, { status: 'denied', canAskAgain: false });
          return;
        }
        if (this.adapter.requestPermission) {
          permission = await this.adapter.requestPermission();
          if (!this.owns(id)) return;
          this.lastPermission = permission;
          if (permission.state !== 'granted') {
            this.finish(id, { status: 'denied', canAskAgain: permission.canAskAgain });
            return;
          }
        }
      }
      this.set({ approximate: permission.state === 'granted' && permission.approximate, canAskAgain: true });

      const servicesEnabled = await this.adapter.servicesEnabled();
      if (!this.owns(id)) return;
      if (!servicesEnabled) {
        this.finish(id, { status: 'services-disabled' });
        return;
      }

      this.set({ status: 'locating' });
      session.timers.push(
        setTimeout(() => {
          if (this.owns(id)) this.set({ slow: true });
        }, LOCATION_SLOW_AFTER_MS),
        setTimeout(() => {
          void this.handleTimeout(id);
        }, LOCATION_ACQUISITION_TIMEOUT_MS),
      );

      const stopWatch = await this.adapter.watch(
        (fix) => this.handleFix(id, fix),
        (error) => this.handleWatchError(id, error),
      );
      // The subscription may finish initializing after the session was cancelled,
      // superseded or already satisfied; remove it immediately in that case.
      if (!this.owns(id)) {
        stopWatch();
        return;
      }
      session.stopWatch = stopWatch;
    } catch {
      if (this.owns(id)) this.failWith(id, 'unavailable');
    }
  }

  /** Stops any acquisition (user cancel, screen departure). Keeps origin and pending fix. */
  cancel(): void {
    if (!this.session) return;
    this.endSession();
    this.set({ status: this.restingStatus(), activeRequestId: null, slow: false });
  }

  /** App/page went to the background: stop, and restart on `resume` if a session was running. */
  pause(): void {
    if (!this.session) return;
    this.cancel();
    this.interrupted = true;
  }

  /**
   * App/page returned to the foreground, or the browser reported a permission change.
   * A changed permission invalidates the pending fix and restarts automatic acquisition;
   * it never fabricates or silently reuses a fix.
   */
  async resume(): Promise<void> {
    if (this.adapter.availability() !== 'ok') return;
    let permission: LocationPermission;
    try {
      permission = await this.adapter.getPermission();
    } catch {
      return;
    }
    const previous = this.lastPermission;
    const changed =
      previous !== null &&
      (previous.state !== permission.state ||
        previous.canAskAgain !== permission.canAskAgain ||
        previous.approximate !== permission.approximate);
    if (changed) {
      this.endSession();
      this.set({ pending: null });
      await this.start('auto');
      return;
    }
    if (this.interrupted || this.state.status === 'services-disabled') {
      await this.start('auto');
    }
  }

  /** Accepts the pending fix as the routing origin. */
  confirmPending(): void {
    const pending = this.state.pending;
    if (!pending) return;
    this.endSession();
    this.accept(pending.fix, 'device-confirmed');
  }

  /** Discards the pending fix and stops searching; the previous origin stays. */
  rejectPending(): void {
    if (!this.state.pending) return;
    this.endSession();
    this.set({ pending: null, activeRequestId: null, slow: false, status: this.state.origin ? 'ready' : 'idle' });
  }

  private handleFix(id: number, fix: LocationFix): void {
    if (!this.owns(id) || !isValidLocationFix(fix)) return;
    const concerns = assessLocationFix(fix, this.state.approximate);
    if (concerns.length === 0) {
      this.endSession();
      this.accept(fix, 'device-auto');
      return;
    }
    const current = this.state.pending;
    if (!current || isBetterFix(fix, current.fix)) {
      this.set({ pending: { fix, concerns }, status: 'confirmation-required' });
    }
  }

  private handleWatchError(id: number, error: LocationWatchError): void {
    if (!this.owns(id)) return;
    if (error === 'denied') {
      this.endSession();
      this.set({ status: 'denied', canAskAgain: true, activeRequestId: null, slow: false, pending: null });
      return;
    }
    this.failWith(id, error);
  }

  private async handleTimeout(id: number): Promise<void> {
    if (!this.owns(id)) return;
    this.stopWatching();
    if (this.state.pending) {
      this.finish(id, { status: 'confirmation-required' });
      return;
    }
    if (this.adapter.lastKnown) {
      try {
        const fix = await this.adapter.lastKnown();
        if (!this.owns(id)) return;
        if (fix && isValidLocationFix(fix)) {
          // Last-known fixes are labelled and never promoted without confirmation.
          const concerns = assessLocationFix({ ...fix, source: 'last-known' }, this.state.approximate);
          this.finish(id, { status: 'confirmation-required', pending: { fix: { ...fix, source: 'last-known' }, concerns } });
          return;
        }
      } catch {
        if (!this.owns(id)) return;
      }
    }
    this.finish(id, { status: 'timed-out' });
  }

  private failWith(id: number, error: 'unavailable' | 'timed-out'): void {
    if (this.state.pending) {
      this.finish(id, { status: 'confirmation-required' });
      return;
    }
    this.finish(id, error === 'timed-out'
      ? { status: 'timed-out' }
      : { status: 'unavailable', unavailableReason: 'provider' });
  }

  private accept(fix: LocationFix, source: ConfirmedOrigin['source']): void {
    const revision = (this.state.origin?.revision ?? 0) + 1;
    this.set({
      status: 'ready',
      activeRequestId: null,
      slow: false,
      pending: null,
      unavailableReason: null,
      origin: {
        lat: fix.lat,
        lng: fix.lng,
        accuracyMeters: fix.accuracyMeters,
        deviceTimestamp: fix.deviceTimestamp,
        source,
        fixSource: fix.source,
        revision,
      },
    });
  }

  private restingStatus(): LocationStatus {
    if (this.state.pending) return 'confirmation-required';
    return this.state.origin ? 'ready' : 'idle';
  }

  private owns(id: number): boolean {
    return this.session?.id === id;
  }

  private finish(id: number, patch: Partial<DeviceLocationState>): void {
    if (!this.owns(id)) return;
    this.endSession();
    this.set({ activeRequestId: null, slow: false, ...patch });
  }

  private stopWatching(): void {
    const session = this.session;
    if (!session) return;
    session.timers.forEach(clearTimeout);
    session.timers = [];
    const stop = session.stopWatch;
    session.stopWatch = null;
    stop?.();
  }

  private endSession(): void {
    this.stopWatching();
    this.session = null;
  }

  private set(patch: Partial<DeviceLocationState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }
}
