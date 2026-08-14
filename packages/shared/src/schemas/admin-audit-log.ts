import { z } from 'zod';

// ---------------------------------------------------------------------------
// Action & entity-type enums
// ---------------------------------------------------------------------------

export const adminAuditActionSchema = z.enum([
  'create',
  'update',
  'delete',
  'status_change',
  'login',
  'logout',
]);
export type AdminAuditAction = z.infer<typeof adminAuditActionSchema>;

export const adminEntityTypeSchema = z.enum([
  'service_request',
  'announcement',
  'incident',
  'resident',
  'waste_zone',
  'waste_schedule',
  'medical_drive',
  'drive_registration',
  'evacuation_center',
  'document_type',
  'faq_article',
  'emergency_information',
  'payment',
  'staff',
  'system',
]);
export type AdminEntityType = z.infer<typeof adminEntityTypeSchema>;

// ---------------------------------------------------------------------------
// Notification category schema (used in Settings)
// ---------------------------------------------------------------------------

export const adminAuditLogCategorySchema = z.object({
  service_requests: z.boolean().default(true),
  announcements: z.boolean().default(true),
  incidents: z.boolean().default(true),
  residents: z.boolean().default(true),
  waste_management: z.boolean().default(true),
  health: z.boolean().default(true),
  evacuation_centers: z.boolean().default(true),
  staff: z.boolean().default(true),
  system: z.boolean().default(true),
});
export type AdminAuditLogCategory = z.infer<typeof adminAuditLogCategorySchema>;

export const adminAuditLogPreferencesSchema = z.object({
  enabledCategories: adminAuditLogCategorySchema,
  notifyOnLogin: z.boolean().default(true),
  notifyOnLogout: z.boolean().default(true),
});
export type AdminAuditLogPreferences = z.infer<typeof adminAuditLogPreferencesSchema>;

// ---------------------------------------------------------------------------
// Row shape returned from the DB (matches admin_audit_log table)
// ---------------------------------------------------------------------------

export const adminAuditLogRowSchema = z.object({
  id: z.string().uuid(),
  barangay_id: z.string().uuid().nullable(),
  admin_id: z.string().uuid().nullable(),
  action: adminAuditActionSchema,
  entity_type: adminEntityTypeSchema,
  entity_id: z.string().uuid().nullable(),
  entity_label: z.string().nullable(),
  changes: z
    .object({
      before: z.record(z.unknown()),
      after: z.record(z.unknown()),
    })
    .nullable()
    .optional(),
  metadata: z.record(z.unknown()).nullable().optional(),
  is_read: z.boolean(),
  created_at: z.string(),
});
export type AdminAuditLogRow = z.infer<typeof adminAuditLogRowSchema>;

// ---------------------------------------------------------------------------
// Mapping: entity type → notification category key
// (exposed so the helper and the hook can share the same lookup)
// ---------------------------------------------------------------------------

const ENTITY_TO_CATEGORY: Record<AdminEntityType, keyof AdminAuditLogCategory> = {
  service_request: 'service_requests',
  announcement: 'announcements',
  incident: 'incidents',
  resident: 'residents',
  waste_zone: 'waste_management',
  waste_schedule: 'waste_management',
  medical_drive: 'health',
  drive_registration: 'health',
  evacuation_center: 'evacuation_centers',
  document_type: 'service_requests', // lumped under service_requests (document types back services)
  faq_article: 'system',
  emergency_information: 'system',
  payment: 'service_requests',
  staff: 'staff',
  system: 'system',
};

export function entityTypeToCategory(entityType: AdminEntityType): keyof AdminAuditLogCategory {
  return ENTITY_TO_CATEGORY[entityType];
}

// Default preferences (used to initialise form state)
export const DEFAULT_AUDIT_PREFERENCES: AdminAuditLogPreferences = {
  enabledCategories: {
    service_requests: true,
    announcements: true,
    incidents: true,
    residents: true,
    waste_management: true,
    health: true,
    evacuation_centers: true,
    staff: true,
    system: true,
  },
  notifyOnLogin: true,
  notifyOnLogout: true,
};
