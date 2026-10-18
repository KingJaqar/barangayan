import React from 'react';
const fixture = () => window.__guards;
export default React.forwardRef(function Link({ href, onClick, ...props }, ref) {
  return <a {...props} ref={ref} href={href} onClick={event => { event.preventDefault(); fixture().destination = href; onClick?.(event); }} />;
});
const router = { push: href => { fixture().destination = href; }, refresh() {} };
export const useRouter = () => router;
const client = {
  auth: { getUser: async () => ({ data: { user: fixture().authenticated ? { id: fixture().id } : null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from(table) {
    const result = async () => {
      if (table === 'profiles') fixture().reads++;
      const data = table === 'profiles' ? { ...fixture().profile } : table === 'medical_drives' ? fixture().drive : table === 'document_types' ? fixture().doc
        : table === 'id_submissions' ? { id: fixture().id, decision: 'verified', front_path: null } : table === 'barangays' ? { boundary: null } : [];
      const error = table === 'profiles' && fixture().error ? { message: 'Synthetic read failure' } : null;
      const delay = fixture().delay;
      if (delay) await new Promise(resolve => setTimeout(resolve, delay));
      return { data: error ? null : data, error };
    };
    const query = { select: () => query, eq: () => query, is: () => query, order: () => query, abortSignal: () => query, single: result, maybeSingle: result,
      then: (resolve, reject) => result().then(resolve, reject), insert: async value => { fixture().writes.push({ table, value }); return { error: null }; } };
    return query;
  },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }) }) },
  channel() { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel() {},
};
export const createSupabaseBrowserClient = () => client;
export const driveTypeConfig = () => ({ label: 'Vaccination' });
export const useMedicalDrives = () => ({ registerForDrive: async value => { fixture().writes.push(value); return { applicant_number: 'TEST-001' }; } });
export const LocationPickerMapWrapper = () => <div>Location map</div>;
