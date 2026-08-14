import { z } from 'zod';

import { adminAuditLogPreferencesSchema, DEFAULT_AUDIT_PREFERENCES } from './admin-audit-log';

export const contactSettingsSchema = z.object({
  email: z.string().email('Enter a valid email address').or(z.literal('')).optional(),
  phone: z.string().max(50).optional().or(z.literal('')),
  address: z.string().max(500).optional().or(z.literal('')),
});

export const dayHoursSchema = z.object({
  open: z.string().optional().or(z.literal('')),
  close: z.string().optional().or(z.literal('')),
});

export const operatingHoursSchema = z.object({
  monday: dayHoursSchema,
  tuesday: dayHoursSchema,
  wednesday: dayHoursSchema,
  thursday: dayHoursSchema,
  friday: dayHoursSchema,
  saturday: dayHoursSchema,
  sunday: dayHoursSchema,
});

export const featureFlagsSchema = z.object({
  allowGuestCheckIn: z.boolean(),
  requireIdVerification: z.boolean(),
  enableWasteNotifications: z.boolean(),
  enableEmergencyAlerts: z.boolean(),
  enableAdminAuditLog: z.boolean().default(true),
});

export const barangaySettingsSchema = z.object({
  contact: contactSettingsSchema,
  operatingHours: operatingHoursSchema,
  features: featureFlagsSchema,
  adminAuditLogPreferences: adminAuditLogPreferencesSchema.optional().default(DEFAULT_AUDIT_PREFERENCES),
});

export type ContactSettings = z.infer<typeof contactSettingsSchema>;
export type DayHours = z.infer<typeof dayHoursSchema>;
export type OperatingHours = z.infer<typeof operatingHoursSchema>;
export type FeatureFlags = z.infer<typeof featureFlagsSchema>;
export type BarangaySettings = z.infer<typeof barangaySettingsSchema>;
export type BarangaySettingsFormValues = BarangaySettings;
