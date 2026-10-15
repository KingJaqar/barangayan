import { build } from 'esbuild';
import path from 'node:path';
import assert from 'node:assert/strict';

const result = await build({
  entryPoints: [path.resolve(import.meta.dirname, '../../src/actions/request-review-actions.ts')],
  bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'session-fixture', setup(b) {
    b.onResolve({ filter: /^@\/lib\/supabase\/server$/ }, () => ({ path: 'session', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export async function createSupabaseServerClient() { return globalThis.reviewSession; }' }));
  } }],
});
const { loadRequestReview } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString('base64')}`);
const id = 'f1150000-0000-0000-0000-000000000001';
let role, signedIn, unavailable, failure, reads;
function reset() {
  role = 'admin'; signedIn = true; unavailable = false; failure = ''; reads = [];
  globalThis.reviewSession = {
    auth: { getUser: async () => ({ data: { user: signedIn ? { id: 'admin' } : null }, error: null }) },
    from(table) {
      reads.push({ table, filters: [] });
      const read = reads.at(-1);
      const value = () => ({
        error: failure === table ? { message: 'Read failed' } : null,
        data: table === 'profiles' ? { role, deleted_at: null } : table === 'service_requests' ? unavailable ? null : { id, document_types: { fee_centavos: 5000 }, approved_id_submission_id: null }
          : table === 'request_attachments' ? [] : null,
      });
      return {
        select() { return this; }, eq(...args) { read.filters.push(['eq', ...args]); return this; },
        is(...args) { read.filters.push(['is', ...args]); return this; }, order() { return this; }, limit() { return this; },
        single: async () => value(), maybeSingle: async () => value(), then(resolve) { return Promise.resolve(value()).then(resolve); },
      };
    },
  };
}
reset();
await assert.rejects(loadRequestReview('invalid'), /Invalid request/);
reset(); signedIn = false;
await assert.rejects(loadRequestReview(id), /session expired/);
assert.equal(reads.length, 0);
reset(); role = 'resident';
await assert.rejects(loadRequestReview(id), /administrator/);
assert.deepEqual(reads.map(r => r.table), ['profiles']);
reset(); unavailable = true;
assert.equal(await loadRequestReview(id), null);
assert.equal(reads.some(r => r.table === 'request_attachments'), false);
reset(); failure = 'service_requests';
await assert.rejects(loadRequestReview(id), /request review/);
reset(); failure = 'request_attachments';
await assert.rejects(loadRequestReview(id), /request evidence/);
reset(); failure = 'payments';
await assert.rejects(loadRequestReview(id), /payment details/);
reset();
const review = await loadRequestReview(id);
assert.equal(review.request.id, id);
assert.equal(review.request.document_types.fee_centavos, 5000);
assert.deepEqual(reads.find(r => r.table === 'service_requests').filters, [['eq', 'id', id], ['is', 'deleted_at', null]]);
assert.deepEqual(reads.find(r => r.table === 'request_attachments').filters, [['eq', 'request_id', id]]);
assert.deepEqual(reads.find(r => r.table === 'payments').filters, [['eq', 'service_request_id', id], ['is', 'deleted_at', null]]);
console.log('Passed: session and admin guards, unavailable requests, scoped queries, evidence/payment failures, review data. Uses a mocked session; no hosted queries or writes.');
