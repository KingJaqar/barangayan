'use client';
import { notify as toast } from '@/lib/notify';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { LoadingStatus } from '@/components/loading/loading-status';
import { useBarangaySettings } from '@/hooks/use-barangay-settings';
import { CATEGORY_LABELS, CATEGORY_ORDER } from '@/lib/audit-notifications';

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
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { Spinner } from '@/components/loading/spinner';
import { ArrowUpRight, Check, Clock3 } from 'lucide-react';
import styles from './settings.module.css';

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

const inputClass = styles.input;

function SettingSwitch({ title, description, checked, onChange }: { title: string; description?: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={styles.switchRow}>
      <span className={styles.switchCopy}><span>{title}</span>{description && <small>{description}</small>}</span>
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} aria-label={title} className={styles.switch} />
    </label>
  );
}

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
      toast.error('Review the highlighted fields before continuing.');
      const message = validation.error.issues[0]?.message ?? 'Invalid input';
      setFormError(message);
      return;
    }

    await updateSettings(validation.data);
    router.refresh();
  }

  if (loading) {
    return (
      <>
        <LoadingStatus message="Loading settings" />
        <div aria-busy="true" className={styles.loading}>
          <div aria-hidden="true" className="flex items-center gap-3">
            <Spinner size="regular" />
            <span className={styles.muted}>Loading settings...</span>
          </div>
        </div>
      </>
    );
  }

  if (error && !settings) {
    return (
      <div className={`${styles.workspace} ${styles.notice}`} role="alert">
        <p className="font-semibold">Failed to load settings</p>
        <p className="mt-1">{error}</p>
        <button
          onClick={() => router.refresh()}
          className={styles.secondaryButton}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={styles.workspace}>
      <header className={styles.hero}>
        <div className={styles.eyebrow}>Administration / Settings</div>
        <h1 className="sr-only">Settings</h1>
      </header>

      <nav className={styles.navigation} aria-label="Settings sections">
        <a href="#settings-contact"><span>01</span> Contact information <ArrowUpRight size={13} /></a>
        <a href="#settings-hours"><span>02</span> Operating hours <ArrowUpRight size={13} /></a>
        <a href="#settings-features"><span>03</span> Features <ArrowUpRight size={13} /></a>
        <a href="#settings-audit"><span>04</span> Audit notifications <ArrowUpRight size={13} /></a>
      </nav>

      <form onSubmit={handleSubmit}>
        {formError ? <p role="alert" className={styles.notice}>{formError}</p> : null}
        {error ? <p role="alert" className={styles.notice}>{error}</p> : null}

        <section id="settings-contact" aria-labelledby="contact-heading" className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>01 / Get in touch</span>
            <h2 id="contact-heading">Contact information</h2>
            <p>The everyday details that help residents reach your barangay office.</p>
          </div>
          <div className={styles.panel}>
            <label className={styles.field}>
              <span>Barangay Email</span>
              <input className={inputClass} type="email" value={contact.email} onChange={(e) => handleContactChange('email', e.target.value)} placeholder="barangay@example.com" />
            </label>
            <label className={styles.field}>
              <span>Phone Number</span>
              <input className={inputClass} type="tel" value={contact.phone} onChange={(e) => handleContactChange('phone', e.target.value)} placeholder="+63 900 000 0000" />
            </label>
            <label className={styles.field}>
              <span>Office Address</span>
              <input className={inputClass} type="text" value={contact.address} onChange={(e) => handleContactChange('address', e.target.value)} placeholder="Purok 1, Barangay Name" />
            </label>
          </div>
        </section>

        <section id="settings-hours" aria-labelledby="hours-heading" className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>02 / Office schedule</span>
            <h2 id="hours-heading">Operating hours</h2>
            <p>Set opening and closing times for each day of the week.</p>
            <span className={styles.asideNote}><Clock3 size={14} /> Your regular weekly schedule</span>
          </div>
          <div className={styles.hoursPanel}>
            <div className={styles.hoursHeading} aria-hidden="true"><span>Day</span><span>Opens</span><span /><span>Closes</span></div>
            {DAYS.map((day) => (
              <div key={day} className={styles.hoursRow}>
                <span className={styles.day}>{DAY_LABELS[day]}</span>
                <input className={inputClass} type="time" aria-label={`${DAY_LABELS[day]} opening time`} value={operatingHours[day]?.open ?? ''} onChange={(e) => handleHoursChange(day, 'open', e.target.value)} />
                <span className={styles.timeSeparator} aria-hidden="true">&ndash;</span>
                <input className={inputClass} type="time" aria-label={`${DAY_LABELS[day]} closing time`} value={operatingHours[day]?.close ?? ''} onChange={(e) => handleHoursChange(day, 'close', e.target.value)} />
              </div>
            ))}
          </div>
        </section>

        <section id="settings-features" aria-labelledby="features-heading" className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>03 / Community services</span>
            <h2 id="features-heading">Features</h2>
            <p>Choose how residents access services and receive community updates.</p>
          </div>
          <div className={styles.togglePanel}>
            <SettingSwitch title="Allow Guest Check-In" description="Guests can mark themselves present at evacuation centers." checked={features.allowGuestCheckIn} onChange={() => handleFeatureToggle('allowGuestCheckIn')} />
            <SettingSwitch title="Require ID Verification" description="Residents must verify a government ID before accessing services." checked={features.requireIdVerification} onChange={() => handleFeatureToggle('requireIdVerification')} />
            <SettingSwitch title="Waste Collection Notifications" description="Push reminders before scheduled pickups." checked={features.enableWasteNotifications} onChange={() => handleFeatureToggle('enableWasteNotifications')} />
            <SettingSwitch title="Emergency Alerts" description="Broadcast DRRM advisories to residents." checked={features.enableEmergencyAlerts} onChange={() => handleFeatureToggle('enableEmergencyAlerts')} />
          </div>
        </section>

        <section id="settings-audit" aria-labelledby="audit-heading" className={styles.section}>
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>04 / Stay informed</span>
            <h2 id="audit-heading">Audit notifications</h2>
            <p>Choose which admin actions appear in your notification bell.</p>
          </div>
          <div className={styles.auditPanel}>
            <SettingSwitch title="Enable Admin Audit Notifications" description="Turn off to hide all admin audit notifications." checked={features.enableAdminAuditLog} onChange={() => handleFeatureToggle('enableAdminAuditLog')} />
            <fieldset disabled={!features.enableAdminAuditLog} className={styles.preferences}>
              <legend>Notification categories</legend>
              <div className={styles.categories}>
                {CATEGORY_ORDER.map((key) => (
                  <label key={key} className={styles.checkboxRow}>
                    <input type="checkbox" checked={auditPrefs.enabledCategories[key]} onChange={() => handleCategoryToggle(key)} />
                    <span>{CATEGORY_LABELS[key]}</span>
                  </label>
                ))}
              </div>
              <div className={styles.authEvents}>
                <h3>Authentication events</h3>
                <div className={styles.categories}>
                  <label className={styles.checkboxRow}><input type="checkbox" checked={auditPrefs.notifyOnLogin} onChange={() => handleAuditPrefToggle('notifyOnLogin')} /><span>Log admin logins</span></label>
                  <label className={styles.checkboxRow}><input type="checkbox" checked={auditPrefs.notifyOnLogout} onChange={() => handleAuditPrefToggle('notifyOnLogout')} /><span>Log admin logouts</span></label>
                </div>
              </div>
            </fieldset>
          </div>
        </section>

        <footer className={styles.saveBar}>
          <div className={styles.saveNote}><Check size={16} /><span>Make it yours.<small>Changes apply when you save.</small></span></div>
          <div className={styles.actions}>
            <button type="button" onClick={() => router.back()} disabled={saving} className={styles.secondaryButton}>Cancel</button>
            <button type="submit" disabled={saving} aria-busy={saving} className={styles.primaryButton}>
              <LoadingButtonContent pending={saving} pendingLabel="Saving...">Save Settings <ArrowUpRight size={14} /></LoadingButtonContent>
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}
