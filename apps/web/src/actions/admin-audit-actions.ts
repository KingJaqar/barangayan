'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';

import {
  adminAuditActionSchema,
  adminEntityTypeSchema,
  entityTypeToCategory,
  type AdminAuditAction,
  type AdminAuditLogPreferences,
  type AdminEntityType,
  type BarangaySettings,
} from '@barangayan/shared';

// ---------------------------------------------------------------------------
// Core insert helper
// ---------------------------------------------------------------------------

interface LogParams {
  action: AdminAuditAction;
  entityType: AdminEntityType;
  entityId?: string;
  entityLabel?: string;
  changes?: { before: Record<string, unknown>; after: Record<string, unknown> };
  metadata?: Record<string, unknown>;
  /**
   * Pass the caller's already-loaded `barangaySettings` to skip a DB round-trip.
   * Omit for infrequent events (login/logout) — the helper fetches settings itself.
   */
  barangaySettings?: BarangaySettings | null;
}

/**
 * Insert one row into admin_audit_log from a Server Action context.
 * The server session cookie identifies the acting admin; no admin_id/barangay_id
 * is accepted from the caller to prevent spoofing.
 *
 * Callers should pass `barangaySettings` from their own hook/context to avoid an
 * extra per-call DB read. If omitted, settings are fetched once internally.
 */
export async function logAdminAction({
  action,
  entityType,
  entityId,
  entityLabel,
  changes,
  metadata,
  barangaySettings,
}: LogParams): Promise<void> {
  // Validate enums — fail loudly in development.
  adminAuditActionSchema.parse(action);
  adminEntityTypeSchema.parse(entityType);

  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  // Fetch admin profile + barangay config in one query.
  const { data: profile } = await supabase
    .from('profiles')
    .select('barangay_id, full_name, barangays(config)')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.barangay_id) return;

  // Resolve settings: use passed-in value, or parse from the fetched config.
  const config = barangaySettings
    ?? ((profile.barangays as { config?: BarangaySettings } | null)?.config ?? null);

  // Master on/off switch.
  if (config?.features?.enableAdminAuditLog === false) return;

  // Per-category filter (skip when prefs absent — default is to log everything).
  const prefs = config?.adminAuditLogPreferences as AdminAuditLogPreferences | undefined;
  if (prefs) {
    const category = entityTypeToCategory(entityType);
    if (!prefs.enabledCategories[category]) return;
  }

  await supabase.from('admin_audit_log').insert({
    barangay_id: profile.barangay_id,
    admin_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId ?? null,
    entity_label: entityLabel ?? null,
    changes: changes ?? null,
    // Always include admin_name so the notification bell can display who acted.
    // Caller-supplied metadata is spread last so it can override if needed.
    metadata: { admin_name: profile.full_name, ...(metadata ?? {}) },
  });
}

// ---------------------------------------------------------------------------
// Auth event helpers — called around sign-in / sign-out
// ---------------------------------------------------------------------------

/** Call server-side immediately after a successful admin login. */
export async function logAdminLogin(): Promise<void> {
  await logAdminAction({
    action: 'login',
    entityType: 'system',
    entityLabel: 'Admin login',
  });
}

/** Call before sign-out (after sign-out the session is gone and the insert would fail). */
export async function logAdminLogout(): Promise<void> {
  await logAdminAction({
    action: 'logout',
    entityType: 'system',
    entityLabel: 'Admin logout',
  });
}
