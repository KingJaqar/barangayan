// Synthetic DTOs only. No credentials, network calls, SQL inserts, or production IDs.
export const sizes = [0, 1, 7, 10, 11, 23, 100, 101, 1505];
export const pageSizes = [10, 20, 30, 50, 100];
export const edgeValues = [' Ana ', 'ana', 'Ána', 'Zoë', '李明', '', null, 'A'.repeat(280), '100%_literal,(x)', 'REF-2', 'REF-10', 'REF-0002', 'custom'];
export const permissions = [
  { actor: 'admin-a', tenant: 'a', deleted: false, expectedTenant: 'a', scores: true },
  { actor: 'admin-b', tenant: 'b', deleted: false, expectedTenant: 'b', scores: true },
  { actor: 'resident-a', tenant: 'a', deleted: false, expectedTenant: null, scores: false },
  { actor: 'removed-admin-a', tenant: 'a', deleted: true, expectedTenant: null, scores: false },
];
// Schedules for later integration tests, not evidence that these flows currently pass.
export const concurrency = [
  { name: 'out-of-order-search', events: ['q=old start', 'q=new start', 'q=new resolves', 'q=old resolves'], expected: 'new' },
  { name: 'edit-refresh-failure', events: ['edit start', 'realtime burst 10', 'save fails'], expected: 'draft retained; bounded reconciliation' },
  { name: 'selected-record-removal', events: ['select id=7', 'page change', 'delete id=7'], expected: 'independent revalidation; unavailable detail' },
  { name: 'mount-cleanup', events: ['mount', 'unmount', 'mount', 'unmount'], expected: 'zero remaining subscriptions/listeners' },
  { name: 'history-navigation', events: ['type search draft', 'filter immediately', 'Back', 'Forward'], expected: 'canonical query with one cancelled debounce' },
  { name: 'independent-errors', events: ['rows succeed', 'summary fails', 'options fail'], expected: 'rows usable; separate failures; no invented zero totals' },
  { name: 'membership-change', events: ['last page', 'add row', 'edit removes match', 'delete last match'], expected: 'valid page after at most one correction' },
  { name: 'permission-loss', events: ['select record', 'admin removed', 'refresh', 'attempt action'], expected: 'no protected scores; unavailable details; no stale action success' },
];
export function rows(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `fixture-${String(i).padStart(5, '0')}`, tenant: i % 2 ? 'b' : 'a',
    full_name: i === count - 1 ? 'beyond-cap-needle' : `Name ${i % 7}`,
    name: `Name ${i % 7}`, reference_number: `REQ-${i % 11}`, applicant_number: `VAC-${i % 11}`,
    created_at: `2026-10-${String(1 + i % 3).padStart(2, '0')}T00:00:00Z`,
    updated_at: '2026-10-11T00:00:00Z', drive_date: '2026-10-11',
    status: 'pending', method: 'pickup', role: 'resident', official_role: 'staff',
    deleted_at: null, is_active: true, is_checked_in: false, relation: 'child',
    email: `fixture-${i}@example.invalid`, email_verification_status: 'unverified',
    id_photo_urls: [], household_members: [], amount_centavos: 100, is_pwd: false,
    title: `Drive ${i % 5}`, location: 'Synthetic location', eligible_criteria: 'Synthetic criteria', type: 'dental',
    description: 'Synthetic description', comorbidities: ['Synthetic'],
    resident_id: `resident-${i}`, document_type_id: 'doc', category_id: 'category',
    drive_id: `drive-${i % 3}`, user_id: `resident-${i}`, profile_id: `resident-${i}`,
    document_types: { name: 'Synthetic Document' }, profiles: { full_name: `Name ${i % 7}`, email: 'fixture@example.invalid' },
    medical_drives: { id: `drive-${i % 3}`, title: 'Synthetic Drive', type: 'dental', drive_date: '2026-10-11' },
    incident_categories: { name: 'Synthetic Category' }, score: { priority_score: i % 4 },
    profile: { id: `resident-${i}`, full_name: `Name ${i % 7}` },
    service_requests: { reference_number: `REQ-${i % 11}`, profiles: { full_name: 'Synthetic Resident' }, document_types: { name: 'Synthetic Document' } },
    collector: { full_name: 'Synthetic Collector' },
  }));
}
