'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useBarangaySettings } from '@/hooks/use-barangay-settings';

import {
  barangaySettingsSchema,
  DEFAULT_AUDIT_PREFERENCES,
  type AdminAuditLogCategory,
  type AdminAuditLogPreferences,
  type BarangaySettings,
  type ContactSettings,
  type DayHours,
  type OperatingHours,
} from '@barangayan/shared';

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
const DAY_LABELS: Record<string, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const AUDIT_CATEGORY_LABELS: { key: keyof AdminAuditLogCategory; label: string }[] = [
  { key: 'service_requests', label: 'Service Requests' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'incidents', label: 'Incident Reports' },
  { key: 'residents', label: 'Residents' },
  { key: 'waste_management', label: 'Waste Management' },
  { key: 'health', label: 'Health Drives' },
  { key: 'evacuation_centers', label: 'Evacuation Centers' },
  { key: 'staff', label: 'Staff' },
  { key: 'system', label: 'System (login / logout)' },
];

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

export function SettingsForm({ barangayId }: { barangayId: string }) {
  const router = useRouter();
  const { settings, loading, error, saving, updateSettings } = useBarangaySettings(barangayId);

  const [contact, setContact] = useState<ContactSettings>({ email: '', phone: '', address: '' });
  const [operatingHours, setOperatingHours] = useState<OperatingHours>(() =>
    DAYS.reduce((acc, day) => {
      acc[day] = { open: '08:00', close: '17:00' };
      return acc;
    }, {} as OperatingHours),
  );
  const [features, setFeatures] = useState({
    allowGuestCheckIn: true,
    requireIdVerification: true,
    enableWasteNotifications: true,
    enableEmergencyAlerts: true,
    enableAdminAuditLog: true,
  });
  const [auditPrefs, setAuditPrefs] = useState<AdminAuditLogPreferences>(DEFAULT_AUDIT_PREFERENCES);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setContact(settings.contact);
      setOperatingHours(settings.operatingHours);
      setFeatures(settings.features);
      setAuditPrefs(settings.adminAuditLogPreferences ?? DEFAULT_AUDIT_PREFERENCES);
    }
  }, [settings]);

  const handleContactChange = useCallback((field: keyof ContactSettings, value: string) => {
    setContact((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleHoursChange = useCallback((day: (typeof DAYS)[number], field: keyof DayHours, value: string) => {
    setOperatingHours((prev) => {
      const current = prev[day] ?? { open: '', close: '' };
      return { ...prev, [day]: { ...current, [field]: value } };
    });
  }, []);

  const handleFeatureToggle = useCallback((field: keyof typeof features) => {
    setFeatures((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleCategoryToggle = useCallback((key: keyof AdminAuditLogCategory) => {
    setAuditPrefs((prev) => ({
      ...prev,
      enabledCategories: { ...prev.enabledCategories, [key]: !prev.enabledCategories[key] },
    }));
  }, []);

  const handleAuditPrefToggle = useCallback((field: 'notifyOnLogin' | 'notifyOnLogout') => {
    setAuditPrefs((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFormError(null);

    const payload: BarangaySettings = {
      contact,
      operatingHours,
      features,
      adminAuditLogPreferences: auditPrefs,
    };

    const validation = barangaySettingsSchema.safeParse(payload);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid input';
      setFormError(message);
      return;
    }

    await updateSettings(validation.data);
    router.refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="text-sm text-zinc-500">Loading settings…</span>
      </div>
    );
  }

  if (error && !settings) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <p className="font-semibold">Failed to load settings</p>
        <p className="mt-1">{error}</p>
        <button
          onClick={() => router.refresh()}
          className="mt-3 rounded-full bg-red-100 px-4 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-200 dark:bg-red-900 dark:text-red-100">
          Retry
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {/* Contact */}
      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Contact Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <label className="col-span-2 text-sm">
            <span className="mb-1 block font-medium">Barangay Email</span>
            <input
              className={inputClass}
              type="email"
              value={contact.email}
              onChange={(e) => handleContactChange('email', e.target.value)}
              placeholder="barangay@example.com"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Phone Number</span>
            <input
              className={inputClass}
              type="tel"
              value={contact.phone}
              onChange={(e) => handleContactChange('phone', e.target.value)}
              placeholder="+63 900 000 0000"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-medium">Office Address</span>
            <input
              className={inputClass}
              type="text"
              value={contact.address}
              onChange={(e) => handleContactChange('address', e.target.value)}
              placeholder="Purok 1, Barangay Name"
            />
          </label>
        </div>
      </div>

      {/* Operating Hours */}
      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Operating Hours</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DAYS.map((day) => (
            <div key={day} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm font-medium text-zinc-600 dark:text-zinc-300">{DAY_LABELS[day]}</span>
              <input
                className={inputClass}
                type="time"
                value={operatingHours[day]?.open ?? ''}
                onChange={(e) => handleHoursChange(day, 'open', e.target.value)}
              />
              <span className="text-xs text-zinc-500">to</span>
              <input
                className={inputClass}
                type="time"
                value={operatingHours[day]?.close ?? ''}
                onChange={(e) => handleHoursChange(day, 'close', e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Feature Flags */}
      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Feature Flags</h2>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={features.allowGuestCheckIn}
              onChange={() => handleFeatureToggle('allowGuestCheckIn')}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium">Allow Guest Check-In</span>
            <span className="text-xs text-zinc-500">Guests can mark themselves present at evacuation centers</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={features.requireIdVerification}
              onChange={() => handleFeatureToggle('requireIdVerification')}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium">Require ID Verification</span>
            <span className="text-xs text-zinc-500">Residents must verify a government ID before accessing services</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={features.enableWasteNotifications}
              onChange={() => handleFeatureToggle('enableWasteNotifications')}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium">Waste Collection Notifications</span>
            <span className="text-xs text-zinc-500">Push reminders before scheduled pickups</span>
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={features.enableEmergencyAlerts}
              onChange={() => handleFeatureToggle('enableEmergencyAlerts')}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span className="font-medium">Emergency Alerts</span>
            <span className="text-xs text-zinc-500">Broadcast DRRM advisories to residents</span>
          </label>
        </div>
      </div>

      {/* Audit Notification Preferences */}
      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Audit Notification Preferences</h2>
        <p className="mb-4 text-xs text-zinc-500">
          Control which admin actions appear in the notification bell. Disabling the master switch hides all notifications.
        </p>

        {/* Master toggle */}
        <label className="mb-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={features.enableAdminAuditLog}
            onChange={() => handleFeatureToggle('enableAdminAuditLog')}
            className="h-4 w-4 rounded border-zinc-300"
          />
          <span className="font-medium">Enable Admin Audit Notifications</span>
        </label>

        {/* Per-category checkboxes — disabled when master is off */}
        <fieldset disabled={!features.enableAdminAuditLog} className="space-y-2 disabled:opacity-50">
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Categories</legend>
          {AUDIT_CATEGORY_LABELS.map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={auditPrefs.enabledCategories[key]}
                onChange={() => handleCategoryToggle(key)}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>{label}</span>
            </label>
          ))}

          <div className="mt-3 border-t border-black/5 pt-3 dark:border-white/5">
            <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Auth Events</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={auditPrefs.notifyOnLogin}
                onChange={() => handleAuditPrefToggle('notifyOnLogin')}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Log admin logins</span>
            </label>
            <label className="mt-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={auditPrefs.notifyOnLogout}
                onChange={() => handleAuditPrefToggle('notifyOnLogout')}
                className="h-4 w-4 rounded border-zinc-300"
              />
              <span>Log admin logouts</span>
            </label>
          </div>
        </fieldset>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={saving}
          className="rounded-full bg-zinc-200 px-5 py-2 text-sm font-semibold disabled:opacity-50 dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </form>
  );
}
