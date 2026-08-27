'use client';

import { useCallback, useEffect, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import {
  barangaySettingsSchema,
  DEFAULT_AUDIT_PREFERENCES,
  type BarangaySettings,
  type ContactSettings,
  type FeatureFlags,
  type OperatingHours,
} from '@barangayan/shared';

export type BarangaySettingsState = {
  barangayId: string | null;
  settings: BarangaySettings | null;
  loading: boolean;
  error: string | null;
  saving: boolean;
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

/** Readable names for the top-level BarangaySettings sections, used to build a dynamic
 * entityLabel for the settings audit log entry (e.g. "Updated Contact Info, Feature Flags"). */
const SETTINGS_SECTION_LABELS: Record<keyof BarangaySettings, string> = {
  contact: 'Contact Info',
  operatingHours: 'Operating Hours',
  features: 'Feature Flags',
  adminAuditLogPreferences: 'Audit Log Preferences',
};

function buildSettingsChangeLabel(before: BarangaySettings, after: BarangaySettings): string {
  const changedSections = (Object.keys(SETTINGS_SECTION_LABELS) as (keyof BarangaySettings)[]).filter(
    (key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  );
  if (!changedSections.length) return 'Barangay Settings';
  return `Updated ${changedSections.map((key) => SETTINGS_SECTION_LABELS[key]).join(', ')}`;
}

const DEFAULT_SETTINGS: BarangaySettings = {
  contact: { email: '', phone: '', address: '' },
  operatingHours: DAYS.reduce((acc, day) => {
    acc[day] = {
      open: day === 'sunday' ? '' : '08:00',
      close: day === 'saturday' ? '12:00' : '17:00',
    };
    return acc;
  }, {} as OperatingHours),
  features: {
    allowGuestCheckIn: true,
    requireIdVerification: true,
    enableWasteNotifications: true,
    enableEmergencyAlerts: true,
    enableAdminAuditLog: true,
  },
  adminAuditLogPreferences: DEFAULT_AUDIT_PREFERENCES,
};

export function useBarangaySettings(barangayId: string | null) {
  const toast = useToast();
  const [state, setState] = useState<BarangaySettingsState>({
    barangayId: null,
    settings: null,
    loading: true,
    error: null,
    saving: false,
  });

  const parseSettings = useCallback((raw: unknown): BarangaySettings => {
    if (!raw || typeof raw !== 'object') return DEFAULT_SETTINGS;
    const parsed = barangaySettingsSchema.safeParse(raw);
    if (parsed.success) return parsed.data;

    const partial = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    if (raw && typeof raw === 'object') {
      const source = raw as Record<string, unknown>;
      if (source.contact && typeof source.contact === 'object') partial.contact = { ...DEFAULT_SETTINGS.contact, ...(source.contact as Partial<ContactSettings>) };
      if (source.operatingHours && typeof source.operatingHours === 'object') {
        partial.operatingHours = {
          ...DEFAULT_SETTINGS.operatingHours,
          ...(source.operatingHours as Partial<OperatingHours>),
        };
      }
      if (source.features && typeof source.features === 'object') partial.features = { ...DEFAULT_SETTINGS.features, ...(source.features as Partial<FeatureFlags>) };
    }
    return partial as BarangaySettings;
  }, []);

  const fetchSettings = useCallback(async () => {
    if (!barangayId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    const supabase = createSupabaseBrowserClient();
    const { data: barangay, error } = await supabase
      .from('barangays')
      .select('config')
      .eq('id', barangayId)
      .single();

    if (error || !barangay) {
      setState((s) => ({
        ...s,
        loading: false,
        error: error?.message ?? 'Failed to load barangay settings',
      }));
      return;
    }

    setState((s) => ({
      ...s,
      barangayId,
      settings: parseSettings(barangay.config),
      loading: false,
      error: null,
    }));
  }, [barangayId, parseSettings]);

  useEffect(() => {
    // Data-fetching on mount is a legitimate pattern; eslint-disable is scoped to this call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings();
  }, [fetchSettings]);

  async function updateSettings(next: Partial<BarangaySettings>) {
    if (!barangayId || !state.settings) return;
    const previousSettings = state.settings;
    setState((s) => ({ ...s, saving: true, error: null }));
    const supabase = createSupabaseBrowserClient();
    const merged = { ...previousSettings, ...next };
    const validation = barangaySettingsSchema.safeParse(merged);
    if (!validation.success) {
      const message = validation.error.issues[0]?.message ?? 'Invalid settings';
      setState((s) => ({ ...s, saving: false, error: message }));
      toast.showError(message);
      return;
    }

    const { error } = await supabase
      .from('barangays')
      .update({ config: validation.data })
      .eq('id', barangayId);

    setState((s) => ({ ...s, saving: false }));

    if (error) {
      setState((s) => ({ ...s, error: error.message }));
      toast.showError(`Failed to save settings: ${error.message}`);
      return;
    }

    logAdminAction({
      action: 'update',
      entityType: 'settings',
      entityLabel: buildSettingsChangeLabel(previousSettings, validation.data),
      changes: {
        before: previousSettings as unknown as Record<string, unknown>,
        after: validation.data as unknown as Record<string, unknown>,
      },
    }).catch(() => {});

    setState((s) => ({ ...s, settings: validation.data }));
    toast.showSuccess('Settings saved.');
  }

  return {
    ...state,
    refetch: fetchSettings,
    updateSettings,
    defaultSettings: DEFAULT_SETTINGS,
  };
}
