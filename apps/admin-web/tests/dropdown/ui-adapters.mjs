export { mutateAdminRecord, logAdminAction, loadRequestReview } from '../table-browse/record-adapters.js';

const audit = { id: 'notification-1', barangay_id: 'fixture-barangay', admin_id: null, action: 'create', entity_type: 'announcement',
  entity_id: 'fixture-announcement', entity_label: 'Fixture Announcement', changes: null, metadata: null, is_read: false, created_at: '2026-10-14T08:00:00Z' };
export function createSupabaseBrowserClient() {
  return { auth: { getUser: async () => ({ data: { user: null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {},
    from(table) {
      let update = false;
      const query = new Proxy({}, { get(_target, name) {
        if (name === 'then') return resolve => Promise.resolve({ data: table === 'admin_audit_log' && !update ? [{ ...audit }] : [], error: null }).then(resolve);
        if (name === 'update') return () => { update = true; window.popupWrites = (window.popupWrites ?? 0) + 1; return query; };
        return () => query;
      } });
      return query;
    },
  };
}
export function useRouter() {
  return { push(href) { window.popupNavigation = href; }, replace(href) { window.popupNavigation = href; }, refresh() {} };
}
export function useSearchParams() { return new URLSearchParams(location.search); }
export function usePathname() { return location.pathname; }
