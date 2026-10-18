import React, { useCallback, useEffect, useState } from 'react';
const fixture = () => window.__documentSheet;
export default React.forwardRef(function Link(props, ref) { return <a {...props} ref={ref} />; });
const router = { push: href => { window.__fixtureDestination = href; } };
export const useRouter = () => router;
export function useScopedRead() {
  const [, update] = useState(0);
  const refetch = useCallback(() => update(value => value + 1), []);
  useEffect(() => { window.addEventListener('fixture-update', refetch); return () => window.removeEventListener('fixture-update', refetch); }, [refetch]);
  return { data: fixture().request, error: null, isRefreshing: false, refetch };
}
export function usePaymongoSource() {
  const [, update] = useState(0);
  useEffect(() => { const changed = () => update(value => value + 1); window.addEventListener('fixture-update', changed); return () => window.removeEventListener('fixture-update', changed); }, []);
  return { source: { paymentId: fixture().paid.id, paymentIntentId: 'pi_test_document_sheet', qrImageUrl: fixture().qrImage, expiresAt: fixture().expiresAt, amountCentavos: 10000, documentFeeCentavos: 10000 }, status: fixture().status, cancelling: false, cancelPayment: async () => ({ outcome: 'cancelled' }), statusCheckFailed: false };
}
const client = {
  auth: { getUser: async () => ({ data: { user: fixture().authenticated ? { id: fixture().profile.id } : null }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
  from(table) {
    const result = () => Promise.resolve({ data: table === 'document_types' ? fixture().doc : table === 'profiles' ? fixture().profile : table === 'id_submissions' ? fixture().approved : table === 'service_requests' ? fixture().request : fixture().paid, error: null });
    const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, abortSignal: () => query, single: result, maybeSingle: result };
    return query;
  },
  rpc: async (name, args) => {
    fixture().calls.push({ name, args });
    if (fixture().error) return { data: null, error: fixture().error, status: 500 };
    return { data: name === 'submit_service_request' ? fixture().requestId : fixture().paid.id, error: null, status: 200 };
  },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: fixture().pixel }, error: null }) }) },
  channel() { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel() {},
};
export const createSupabaseBrowserClient = () => client;
