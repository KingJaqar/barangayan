# Admin Audit Notification Plan

## Overview

Transform the decorative notification bell in the web admin header into a functional, admin-only audit log system. Every CRUD action and auth event performed by admins is captured, displayed in a dropdown, and filterable by preference toggles in Settings.

---

## Database

### New table: `admin_audit_log`

```sql
CREATE TABLE public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barangay_id uuid REFERENCES public.barangays(id),
  admin_id uuid REFERENCES auth.users(id),
  action TEXT NOT NULL,         -- 'create' | 'update' | 'delete' | 'status_change' | 'login' | 'logout'
  entity_type TEXT NOT NULL,    -- 'service_request' | 'announcement' | 'incident' | 'resident' |
                               -- 'waste_zone' | 'waste_schedule' | 'medical_drive' |
                               -- 'evacuation_center' | 'document_type' | 'faq_article' |
                               -- 'emergency_information' | 'payment' | 'staff' | 'drive_registration' | 'system'
  entity_id uuid,               -- nullable for login/logout
  entity_label TEXT,            -- human-readable summary, e.g. "Request #REQ-001" or "Announcement: Typhoon Advisory"
  changes JSONB,                -- optional diff: { before: {...}, after: {...} }
  metadata JSONB,               -- extra context (reference_number, status, category, etc.)
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_log_barangay_created ON public.admin_audit_log(barangay_id, created_at DESC);
CREATE INDEX idx_admin_audit_log_admin_id ON public.admin_audit_log(admin_id);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read own barangay audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (
    public.current_role() = 'admin'
    AND barangay_id = public.current_barangay_id()
  );

-- Only Supabase service role can INSERT (server-side inserts via direct DB or edge function)
-- No INSERT policy for authenticated; all writes bypass client RLS via service_role.
```

**Drop the old view** in a follow-up migration:
```sql
DROP VIEW IF EXISTS public.admin_notifications;
```

### Migration order

1. Create `admin_audit_log` table + indexes + RLS
2. Drop `admin_notifications` view
3. Update `packages/shared/src/types/database.ts` — move `admin_notifications` from `Views` to `Tables` (or regenerate via `supabase gen types`)

---

## Shared Schema

**File:** `packages/shared/src/schemas/admin-audit-log.ts` (new)

```ts
export const adminAuditLogCategorySchema = z.object({
  service_requests: z.boolean().default(true),
  announcements: z.boolean().default(true),
  incidents: z.boolean().default(true),
  residents: z.boolean().default(true),
  waste_management: z.boolean().default(true),
  health: z.boolean().default(true),
  evacuation_centers: z.boolean().default(true),
  staff: z.boolean().default(true),
  system: z.boolean().default(true),   // login/logout
});

export const adminAuditLogPreferencesSchema = z.object({
  enabledCategories: adminAuditLogCategorySchema,
  notifyOnLogin: z.boolean().default(true),
  notifyOnLogout: z.boolean().default(true),
});

export type AdminAuditLogCategory = z.infer<typeof adminAuditLogCategorySchema>;
export type AdminAuditLogPreferences = z.infer<typeof adminAuditLogPreferencesSchema>;
```

**Update:** `packages/shared/src/schemas/settings.ts`

Add `adminAuditLogPreferences` to `featureFlagsSchema` or as a sibling field in `barangaySettingsSchema`:

```ts
export const featureFlagsSchema = z.object({
  allowGuestCheckIn: z.boolean(),
  requireIdVerification: z.boolean(),
  enableWasteNotifications: z.boolean(),
  enableEmergencyAlerts: z.boolean(),
  enableAdminAuditLog: z.boolean().default(true),   // master on/off
});

// Add top-level field to barangaySettingsSchema:
export const barangaySettingsSchema = z.object({
  contact: contactSettingsSchema,
  operatingHours: operatingHoursSchema,
  features: featureFlagsSchema,
  adminAuditLogPreferences: adminAuditLogPreferencesSchema.optional(),
});
```

---

## Settings UI

**File:** `apps/web/src/app/(admin)/settings/settings-form.tsx`

Add a new card "Audit Notification Preferences" below Feature Flags:

- Master toggle: "Enable Admin Audit Notifications" (maps to `features.enableAdminAuditLog`)
- Per-category checkboxes (maps to `adminAuditLogPreferences.enabledCategories`):
  - Service Requests
  - Announcements
  - Incidents
  - Residents
  - Waste Management
  - Health Drives
  - Evacuation Centers
  - Staff
- Auth event toggles: "Log admin logins", "Log admin logouts"

These bind into the existing `features` state object and `barangaySettingsSchema`. The `useBarangaySettings` hook already handles JSONB `config` reads/writes — no backend changes needed.

---

## Notification Bell Hook

**New file:** `apps/web/src/hooks/use-admin-audit-notifications.ts`

```ts
export function useAdminAuditNotifications(barangayId: string | null) {
  const [notifications, setNotifications] = useState<AdminAuditNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createSupabaseBrowserClient();

  async function fetchNotifications() { ... }
  async function markAsRead(id: string) { ... }
  async function markAllAsRead() { ... }

  // Realtime subscription on admin_audit_log for this barangay
  useEffect(() => { ... }, [barangayId]);

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
}
```

---

## Header Bell Dropdown

**File:** `apps/web/src/components/admin/header.tsx`

Changes:
1. Replace `useEffect` count query with `useAdminAuditNotifications(barangayId)` (barangayId must flow down from `AdminShell` → `Header`)
2. Wire `onClick` on bell button to toggle `showNotifications` dropdown
3. Dropdown shows:
   - Header: "Notifications" + "Mark all as read" button
   - List of notification items (icon + entity label + timestamp + relative time)
   - Clicking an item: marks read, navigates to entity page (or shows detail)
   - Empty state: "No notifications"
4. Red dot badge becomes a count badge when `unreadCount > 0`

**Prop change:** `HeaderProps` needs `barangayId: string` added.

---

## Admin Shell Prop Pass-through

**File:** `apps/web/src/components/admin/admin-shell.tsx`

Pass `barangayId` (already available in layout) to `<Header barangayId={barangayId} ... />`.

---

## Audit Log Insertion Points

Insert a row into `admin_audit_log` after every successful mutation. Use a shared helper so it's not copy-pasted everywhere.

**New file:** `apps/web/src/lib/admin-audit.ts`

```ts
export async function logAdminAction(params: {
  supabase: SupabaseClient;
  adminId: string;
  barangayId: string;
  action: AdminAuditAction;
  entityType: AdminEntityType;
  entityId?: string;
  entityLabel?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}) {
  const preferences = await fetchPreferences(barangayId);
  if (!preferences?.enableAdminAuditLog) return;
  if (!preferences?.enabledCategories[entityTypeToCategory(entityType)]) return;

  await supabase.from('admin_audit_log').insert({ ... });
}
```

**`entityTypeToCategory` mapping:**
- `service_requests` → `service_requests`
- `announcements` → `announcements`
- `incidents` → `incidents`
- `profiles` (resident edits) → `residents`
- `waste_zones`, `waste_schedules`, `incidents` (waste) → `waste_management`
- `medical_drives`, `drive_registrations` → `health`
- `evacuation_centers` → `evacuation_centers`
- `staff` → `staff`
- `document_types`, `faq_articles`, `emergency_information`, `payments` → respective categories

**Insert the helper call at each mutation site:**

| File | Mutation | Action |
|------|----------|--------|
| `requests-table.tsx` AddRequestForm | `service_requests.insert` | `create` |
| `requests-table.tsx` inline update | `service_requests.update` | `update` |
| `request-status-actions.tsx` beginProcessing | RPC → status change | `status_change` |
| `request-status-actions.tsx` completeRequest | RPC → status change | `status_change` |
| `request-status-actions.tsx` markOutForDelivery | RPC → status change | `status_change` |
| `request-status-actions.tsx` handleCancel | RPC → status change | `status_change` |
| `request-status-actions.tsx` markPaymentCollected | `payments.update` | `update` |
| `announcement-form.tsx` | `announcements.insert` | `create` |
| `announcement-row.tsx` (if delete) | `announcements.delete` | `delete` |
| `incident-table.tsx` | `incidents.insert` | `create` |
| `incident-table.tsx` | `incidents.update` | `update` |
| `trash-incident-table.tsx` | `incidents.update` (status) | `status_change` |
| `households-table.tsx` | `household_members.update` | `update` |
| `households-table.tsx` | `household_members.delete` | `delete` |
| `resident-directory.tsx` | `profiles.update` | `update` |
| `document-type-form.tsx` | `document_types.insert` | `create` |
| `document-type-row.tsx` (if edit/delete) | `document_types.update/delete` | `update`/`delete` |
| `schedule-form.tsx` | `waste_collection_schedules.insert` | `create` |
| `zone-form.tsx` | `waste_zones.insert` | `create` |
| `transactions-table.tsx` | `payments.insert/update` | `create`/`update` |
| `transactions-table.tsx` soft-delete | `payments.update(deleted_at)` | `delete` |
| `health/drive-table.tsx` | `medical_drives.insert/update` | `create`/`update` |
| `health/drive-table.tsx` soft-delete | `medical_drives.update(deleted_at)` | `delete` |
| `health/applicant-detail-modal.tsx` | `drive_registrations.update` | `update` |
| `health/applicants-table.tsx` | `drive_registrations.update/status` | `update`/`status_change` |
| `evacuation-center-form.tsx` | `evacuation_centers.insert` | `create` |
| `evacuation-center-row.tsx` (if edit/delete) | `evacuation_centers.update/delete` | `update`/`delete` |
| `hub/emergency-form.tsx` | `emergency_information.insert` | `create` |
| `faq-form.tsx` | `faq_articles.insert` | `create` |
| `faq-list.tsx` (if edit/delete) | `faq_articles.update/delete` | `update`/`delete` |
| `staff-form.tsx` | `staff.insert` | `create` |
| `staff-row.tsx` (if edit/delete) | `staff.update/delete` | `update`/`delete` |
| Login/logout | `admin_audit_log.insert` via server action or client after auth event | `login`/`logout` |

> **Note:** Auth events (login/logout) need a server-side hook since the client's `onAuthStateChange` fires after redirect. See Implementation Notes below.

---

## Auth Event Capture (Login/Logout)

**New file:** `apps/web/src/actions/admin-audit-actions.ts` (server action)

```ts
'use server';

export async function logAdminLogin() { ... }
export async function logAdminLogout() { ... }
```

- Called from a client-side auth listener in `admin-layout.tsx` or a dedicated client component near the admin shell.
- The server action gets the session user via `createSupabaseServerClient()` and inserts directly with `service_role` to bypass RLS.

Alternatively, use a Postgres `auth.login` / `auth.logout` trigger via `auth.users` — but Supabase Auth doesn't expose reliable row-level hooks without custom auth logic. Server action is the pragmatic choice.

---

## Realtime

Subscribe to `admin_audit_log` Postgres changes in `useAdminAuditNotifications`:

```ts
supabase
  .channel(`admin_audit_log:${barangayId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'admin_audit_log',
    filter: `barangay_id=eq.${barangayId}`,
  }, (payload) => {
    setNotifications(prev => [payload.new as AdminAuditNotification, ...prev]);
    setUnreadCount(prev => payload.new.is_read ? prev : prev + 1);
  })
  .subscribe();
```

Add `admin_audit_log` to the Supabase Realtime publication (same migration as table creation):

```sql
ALTER publication supabase_realtime ADD table public.admin_audit_log;
```

---

## Database Types

Regenerate: `npx supabase gen types typescript --project-id <id> > packages/shared/src/types/database.ts`

Or manually add `admin_audit_log` under `Tables` and remove from `Views`.

---

## Implementation Notes

- **`entity_label` format:** `[Category icon] Action: <label>` e.g. `📋 Created: Announcement "Typhoon Advisory"`, `👤 Updated: Resident Juan Dela Cruz`
- **`changes` field:** For updates, store `{ before: { status: "submitted" }, after: { status: "in_progress" } }`. Omit for create/delete/login/logout.
- **`metadata` field:** Store entity-specific context: `{ reference_number, status, category, document_type_name }`.
- **Pagination:** Fetch last 50 notifications in the dropdown. Infinite scroll if needed later.
- **Relative timestamps:** Use `formatDistanceToNow` from `date-fns` (already in deps) — check existing usage.
- **Navigation:** Clicking a notification navigates to the relevant admin page (e.g., `/requests/{id}`, `/announcements`, `/residents?q=...`). For non-linkable entities (e.g., generic system events), show a tooltip or no-op.

---

## Validation

After implementation:

1. **Typecheck:** `npx tsc --noEmit` at repo root and `apps/web`
2. **Lint:** `npm run lint` at repo root (or project's lint command — check `package.json`)
3. **Manual smoke test:**
   - Toggle preferences in Settings → verify mutations stop/start generating notifications
   - Create announcement → verify notification appears in bell dropdown
   - Update request status → verify notification appears
   - Login/logout → verify system notification appears
   - Mark single notification as read → unread count decreases
   - "Mark all as read" → all cleared
   - Realtime: open two admin tabs, mutate in one → notification appears in other

---

## Files Modified/Created Summary

**New files:**
- `supabase/migrations/00XX_admin_audit_log.sql`
- `packages/shared/src/schemas/admin-audit-log.ts`
- `apps/web/src/hooks/use-admin-audit-notifications.ts`
- `apps/web/src/lib/admin-audit.ts`
- `apps/web/src/actions/admin-audit-actions.ts`

**Modified files:**
- `supabase/migrations/00XX_drop_admin_notifications_view.sql` (or combined with above)
- `packages/shared/src/schemas/settings.ts`
- `packages/shared/src/types/database.ts`
- `apps/web/src/components/admin/header.tsx`
- `apps/web/src/components/admin/admin-shell.tsx`
- `apps/web/src/app/(admin)/settings/settings-form.tsx`
- `apps/web/src/app/(admin)/layout.tsx` (for auth listener)
- All mutation components listed in "Audit Log Insertion Points" table above
