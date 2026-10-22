import { z } from 'zod';

/**
 * Export contract v2 as the app accepts it (plan P03-T07 section 2). The envelope is validated before anything is written or
 * shared: a payload that is missing a required section, marks one failed or truncated, or whose row counts do not match its rows
 * is refused, so the app can never present a partial export as complete.
 */
export const EXPORT_CONTRACT_VERSION = 2;

export const EXPORT_SECTIONS = [
  { name: 'profile', label: 'Profile' },
  { name: 'household_members', label: 'Household members' },
  { name: 'service_requests', label: 'Service requests' },
  { name: 'payments', label: 'Payments' },
  { name: 'request_attachments', label: 'Request attachments' },
  { name: 'id_submissions', label: 'ID submissions' },
  { name: 'incident_reports', label: 'Incident reports' },
  { name: 'incident_corroborations', label: 'Report corroborations' },
  { name: 'announcement_reads', label: 'Announcement read state' },
  { name: 'medical_drive_registrations', label: 'Medical drive registrations' },
  { name: 'evacuation_center_checkins', label: 'Evacuation center check-ins' },
  { name: 'household_attendance', label: 'Household attendance' },
  { name: 'household_attendance_receipts', label: 'Household attendance confirmations' },
  { name: 'notification_preferences', label: 'Notification preferences' },
  { name: 'notification_inbox', label: 'Notification inbox' },
  { name: 'registered_devices', label: 'Registered devices' },
] as const;
export type SectionName = (typeof EXPORT_SECTIONS)[number]['name'];

const completeSection = z.object({
  status: z.literal('complete'),
  label: z.string(),
  rowCount: z.number().int().min(0),
  truncated: z.literal(false),
  rows: z.array(z.record(z.unknown())),
});

export const exportEnvelopeSchema = z.object({
  contractVersion: z.literal(EXPORT_CONTRACT_VERSION),
  exportedAt: z.string().refine((value) => !Number.isNaN(new Date(value).getTime()), 'exportedAt must be a date'),
  account: z.object({ id: z.string().uuid(), email: z.string().nullable() }),
  sections: z.record(z.unknown()),
});
export type ExportRow = Record<string, unknown>;
export type ExportSection = { name: SectionName; label: string; rows: ExportRow[] };
export type ValidExport = { exportedAt: string; account: { id: string; email: string | null }; sections: ExportSection[] };

export type ExportValidation = { ok: true; value: ValidExport } | { ok: false; reason: 'format' | 'incomplete' | 'wrong-account'; sections: string[] };

/**
 * Checks the envelope against the signed-in account. `sections` lists, for a refusal, the labels of every required section that
 * is absent, failed, truncated or inconsistent, so the message can name what is missing.
 */
export function validateExport(payload: unknown, accountId: string): ExportValidation {
  const envelope = exportEnvelopeSchema.safeParse(payload);
  if (!envelope.success) return { ok: false, reason: 'format', sections: [] };
  if (envelope.data.account.id !== accountId) return { ok: false, reason: 'wrong-account', sections: [] };
  const bad: string[] = [];
  const sections: ExportSection[] = [];
  for (const required of EXPORT_SECTIONS) {
    const parsed = completeSection.safeParse(envelope.data.sections[required.name]);
    if (!parsed.success || parsed.data.rowCount !== parsed.data.rows.length) { bad.push(required.label); continue; }
    sections.push({ name: required.name, label: required.label, rows: parsed.data.rows });
  }
  // A resident always has a profile row; an export without one is not an export of this account.
  const profile = sections.find((section) => section.name === 'profile');
  if (profile && profile.rows.length !== 1) bad.push(profile.label);
  if (bad.length > 0) return { ok: false, reason: 'incomplete', sections: bad };
  return { ok: true, value: { exportedAt: envelope.data.exportedAt, account: envelope.data.account, sections } };
}
