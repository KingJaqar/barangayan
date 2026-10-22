import { createSingleFlight } from '../../data/mutation';
import type { SavedPreferences } from '../../data/resident-api';
import { residentError } from '../../lib/errors';
import type { NotificationKind } from './model';
import { pushQueue, readRecord, registerDevice, releaseDevice, type PermissionState, type PushApi, type PushPort, type RecordStore, type RegistrationResult } from './push-controller';

export type PreferenceDeps = {
  api: PushApi & {
    saveNotificationPreferences(change: { pushEnabled?: boolean; kinds?: Record<string, boolean> }): Promise<SavedPreferences>;
    notificationKinds(signal: AbortSignal): Promise<Record<string, boolean>>;
  };
  port: PushPort;
  store: RecordStore;
  userId: string;
  /** Called after the saved global switch changed, so the signed-in profile copy follows. */
  onSaved: () => Promise<void>;
};

/** Where this iPhone stands for phone alerts, apart from the resident's saved switch. */
export type DeviceStatus = RegistrationResult['status'] | 'unchecked';

export type PreferenceState = {
  loaded: boolean;
  pushEnabled: boolean;
  kinds: Readonly<Record<string, boolean>>;
  permission: PermissionState | 'unknown';
  device: DeviceStatus;
  busy: boolean;
  /** The outcome of the last action, shown beside the controls. `failed` says the choice was not kept. */
  message: string;
  failed: boolean;
};

const NOT_SAVED = 'Your choice was not saved, so it was put back.';
const UNCONFIRMED = ' It may have been saved; the switches show what is stored.';

/**
 * The phone-alert choices on Settings → Notifications (A44-001…003, 006, 014, 015).
 *
 * - The saved switch is the resident's choice and is applied by the server when each alert is sent. The device token is separate:
 *   it can be missing (permission off, no connection) while the switch stays on, and that is shown as such, never as "off".
 * - A switch shows the new value at once and is put back, with a message, when the server did not keep it.
 * - Turning alerts on is the only action that may show the iPhone permission prompt. A refusal leaves the saved choice on and
 *   explains how to allow notifications in iPhone Settings. Turning alerts off removes this device's token; when that cannot
 *   be confirmed the retry marker stays and alerts have already stopped on the server.
 * - One action runs at a time. Nothing is written after `dispose`.
 */
export class PreferenceActions {
  private state: PreferenceState;
  private readonly listeners = new Set<() => void>();
  private readonly gate = createSingleFlight();
  private readonly controller = new AbortController();
  private disposed = false;

  constructor(private readonly deps: PreferenceDeps, pushEnabled: boolean) {
    this.state = { loaded: false, pushEnabled, kinds: {}, permission: 'unknown', device: 'unchecked', busy: false, message: '', failed: false };
  }

  getState = (): PreferenceState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  dispose(): void {
    this.disposed = true;
    this.controller.abort();
    this.listeners.clear();
  }

  private set(patch: Partial<PreferenceState>): void {
    if (this.disposed) return;
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => listener());
  }

  /** Reads the saved per-kind switches and the iPhone permission. Called on open and on every return to the app. */
  async load(): Promise<void> {
    if (this.disposed) return;
    try {
      const [kinds, permission, record] = await Promise.all([this.deps.api.notificationKinds(this.controller.signal), this.deps.port.permission(), readRecord(this.deps.store)]);
      const registered = record !== null && record.userId === this.deps.userId && !record.pendingRelease;
      const device: DeviceStatus = !this.state.pushEnabled ? 'off' : permission === 'denied' ? 'denied' : permission === 'undetermined' ? 'needs-permission' : registered ? 'registered' : 'unavailable';
      this.set({ loaded: true, kinds, permission, device });
    } catch (error) {
      if (this.controller.signal.aborted) return;
      this.set({ loaded: true, failed: true, message: `Your saved choices could not be loaded. ${residentError(error)}` });
    }
  }

  async setPushEnabled(next: boolean): Promise<void> {
    if (this.disposed || this.gate.running) return;
    const previous = this.state.pushEnabled;
    this.set({ busy: true, pushEnabled: next, message: '', failed: false });
    const saved = await this.gate.run(() => this.deps.api.saveNotificationPreferences({ pushEnabled: next }));
    if (saved.status === 'busy' || this.disposed) return;
    if (saved.status !== 'committed') {
      this.set({ busy: false, pushEnabled: previous, failed: true, message: `${NOT_SAVED} ${residentError(saved.error)}${saved.status === 'unknown' ? UNCONFIRMED : ''}` });
      if (saved.status === 'unknown') await this.load();
      return;
    }
    this.set({ pushEnabled: saved.value.push_enabled, kinds: saved.value.kinds });
    try { await this.deps.onSaved(); } catch { /* the profile copy refreshes on the next foreground */ }
    if (!next) {
      const released = await pushQueue(() => releaseDevice({ api: this.deps.api, store: this.deps.store, userId: this.deps.userId, port: this.deps.port }));
      this.set({
        busy: false, device: 'off', failed: false,
        message: released === 'pending'
          ? 'Phone alerts are off. This iPhone could not be removed right now and will be removed when it can; alerts have already stopped.'
          : 'Phone alerts are off. Everything still appears in your inbox.',
      });
      return;
    }
    const result = await pushQueue(() => registerDevice({ port: this.deps.port, api: this.deps.api, store: this.deps.store, userId: this.deps.userId, enabled: true, askPermission: true }));
    this.set({ busy: false, device: result.status, permission: await this.deps.port.permission().catch(() => 'unknown' as const), ...registrationMessage(result) });
  }

  async setKind(kind: NotificationKind, value: boolean): Promise<void> {
    if (this.disposed || this.gate.running) return;
    const previous = this.state.kinds;
    this.set({ busy: true, kinds: { ...previous, [kind]: value }, message: '', failed: false });
    const saved = await this.gate.run(() => this.deps.api.saveNotificationPreferences({ kinds: { [kind]: value } }));
    if (saved.status === 'busy' || this.disposed) return;
    if (saved.status !== 'committed') {
      this.set({ busy: false, kinds: previous, failed: true, message: `${NOT_SAVED} ${residentError(saved.error)}${saved.status === 'unknown' ? UNCONFIRMED : ''}` });
      if (saved.status === 'unknown') await this.load();
      return;
    }
    this.set({ busy: false, kinds: saved.value.kinds, pushEnabled: saved.value.push_enabled, failed: false, message: 'Saved.' });
  }
}

function registrationMessage(result: RegistrationResult): { message: string; failed: boolean } {
  switch (result.status) {
    case 'registered': return { message: 'Phone alerts are on for this iPhone.', failed: false };
    case 'denied': return { message: 'Alerts are on in Barangayan, but notifications are turned off for this app on your iPhone. Open iPhone Settings to allow them.', failed: true };
    case 'needs-permission': return { message: 'Alerts are on. Allow notifications when your iPhone asks to receive them.', failed: false };
    case 'unavailable': return { message: 'Alerts are on, but this iPhone could not get a notification address right now. Check your connection; the app will try again when you open it.', failed: true };
    case 'failed': return { message: `Alerts are on, but this iPhone could not be registered. ${residentError(result.error)} The app will try again when you open it.`, failed: true };
    case 'off': return { message: '', failed: false };
  }
}
