export function useRouter() { return { refresh() { window.dispatchEvent(new Event('record-refresh')); }, push() {}, replace(href) { window.history.replaceState(null, '', href); window.dispatchEvent(new Event('record-refresh')); } }; }
export function usePathname() { return '/fixture'; }
export function useSearchParams() {
  const params = new URLSearchParams({ tab: 'all' });
  const record = new URLSearchParams(location.search).get('record');
  if (record) params.set('record', record);
  return params;
}
export function createSupabaseBrowserClient() {
  return { channel() { return { on() { return this; }, subscribe() { return this; } }; }, removeChannel() {},
    from(table) {
      let patch;
      const query = { select() { return this; }, eq() { return this; }, is() { return this; }, in() { return this; }, order() { return this; }, retry() { return this; }, abortSignal() { return this; }, update(value) { patch = value; return this; },
        async maybeSingle() {
          await new Promise(resolve => setTimeout(resolve, window.recordFixture.readDelay ?? 25));
          const fixture = window.recordFixture;
          fixture.reads++;
          if (patch) {
            fixture.writeAttempts ??= [];
            fixture.writeAttempts.push({ table, patch: structuredClone(patch) });
            if (fixture.failWriteAt === fixture.writeAttempts.length) return { data: null, error: { message: 'Fixture partial save failure.' } };
          }
          if (fixture.readThrowNext) { fixture.readThrowNext = false; throw new Error('Fixture transport failure.'); }
          if (fixture.readFailNext) { fixture.readFailNext = false; return { data: null, error: { message: 'Fixture read failure.' } }; }
          if (patch && fixture.throwNext) { fixture.throwNext = false; throw new Error('Fixture transport failure.'); }
          if (patch && fixture.failNext) { fixture.failNext = false; return { data: null, error: { message: 'Workflow permission failure.' } }; }
          const row = fixture.rows[fixture.name];
          if (table === 'id_submissions') return { data: structuredClone(fixture.idEvidence ?? null), error: null };
          if (patch && row) Object.assign(row, patch);
          if (!table.startsWith('admin_')) return { data: row ? structuredClone(row) : null, error: null };
          const projection = row ? structuredClone(row) : null;
          if (projection && table === 'admin_residents_records') {
            for (const key of ['first_name', 'last_name', 'middle_name', 'suffix', 'house_no', 'street']) delete projection[key];
          }
          return { data: fixture.unavailable || !row ? null : { row: projection, f_archived: !!row.deleted_at }, error: null };
        }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
      return query;
    }, rpc(name, input) {
      if (name === 'service_request_sla_tracking') return { abortSignal() { return Promise.resolve({ data: { request: structuredClone(window.recordFixture.rows[window.recordFixture.name]), pauses: [], evaluated_at: new Date().toISOString() }, error: null }); } };
      return (async () => {
      const fixture = window.recordFixture;
      const row = fixture.rows[fixture.name];
      fixture.workflowCalls ??= [];
      fixture.workflowCalls.push({ name, input });
      await new Promise(resolve => setTimeout(resolve, fixture.workflowDelay ?? 25));
      if (fixture.throwNext) { fixture.throwNext = false; throw new Error('Fixture transport failure.'); }
      if (fixture.failNext) { fixture.failNext = false; return { data: null, error: { message: 'Workflow permission failure.' } }; }
      if (fixture.noopNext) { fixture.noopNext = false; return { data: null, error: null }; }
      if (name === 'review_id_submission') {
        if (fixture.staleIdNext) { fixture.staleIdNext = false; return { data: null, error: { message: 'stale_or_repeated_ID_review' } }; }
        fixture.idEvidence.decision = input.p_input.decision;
        fixture.idEvidence.rejection_reason = input.p_input.reason ?? null;
        fixture.idEvidence.reviewed_at = new Date().toISOString();
        fixture.idEvidence.reviewed_by = 'signed-in-admin';
        row.id_verification_status = input.p_input.decision === 'verified' ? 'verified' : 'verification_failed';
        if (fixture.idReviewProfilePatch) Object.assign(row, fixture.idReviewProfilePatch);
        return { data: fixture.idEvidence.id, error: null };
      }
      const statuses = { begin_processing_request: 'in_progress', mark_request_ready_for_pickup: 'ready_for_pickup', complete_service_request: 'completed', cancel_service_request: 'cancelled', withdraw_incident: 'withdrawn' };
      if (statuses[name]) row.status = statuses[name];
      if (name === 'update_incident_status') row.status = input.p_status;
      if (name === 'collect_pickup_payment') row.payment_status = 'paid';
      if (name === 'transition_service_request_sla') {
        const steps = { accept: ['in_progress', 'running'], ready: ['ready_for_pickup', 'ready'], release: ['completed', 'released'], cancel: ['cancelled', 'cancelled'] };
        [row.status, row.sla_state] = steps[input.p_input.action];
      }
      return { data: row.id, error: null };
      })();
    }, storage: { from() { return { async createSignedUrls(paths) {
      if (window.recordFixture.photoFail) return { data: null, error: { message: 'Photo unavailable' } };
      const signedUrl = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#e4e4e7"/><text x="30" y="95">Synthetic ID document</text></svg>');
      return { data: paths.map(() => ({ signedUrl })), error: null };
    } }; } }, functions: { async invoke(name, input) {
      const fixture = window.recordFixture;
      const row = fixture.rows[fixture.name];
      fixture.workflowCalls ??= [];
      fixture.workflowCalls.push({ name, input });
      if (fixture.throwNext) { fixture.throwNext = false; throw new Error('Fixture transport failure.'); }
      if (fixture.failNext) { fixture.failNext = false; return { data: null, error: { message: 'Workflow permission failure.' } }; }
      row.refund_status = 'pending';
      return { data: { paymentId: row.id, status: 'pending' }, error: null };
    } } };
}
export async function logAdminAction() {}
export async function mutateAdminRecord(name, id, operation, expected, patch) {
  await new Promise(resolve => setTimeout(resolve, 50));
  const fixture = window.recordFixture;
  if (fixture.enforceExpected && fixture.rows[name]?.updated_at !== expected) return { error: 'Fixture stale profile version.' };
  if (fixture.throwNext) { fixture.throwNext = false; throw new Error('Fixture transport failure.'); }
  if (fixture.failNext) { fixture.failNext = false; return { error: 'Fixture permission or constraint failure. Please retry.' }; }
  fixture.mutations.push({ name, id, operation, expected, patch });
  if (operation === 'delete') fixture.rows[name] = null;
  else if (operation === 'archive') fixture.rows[name].deleted_at = new Date().toISOString();
  else if (operation === 'restore') fixture.rows[name].deleted_at = null;
  else if (name === 'staff') {
    for (const [key, value] of Object.entries(patch)) {
      if (['full_name', 'mobile_number', 'home_address'].includes(key)) fixture.rows[name].profile[key] = value;
      else fixture.rows[name][key] = value;
    }
  } else Object.assign(fixture.rows[name], patch);
  if (name === 'requests' && operation === 'save' && fixture.enforceExpected) fixture.rows[name].updated_at = new Date().toISOString();
  return { error: null, row: fixture.rows[name] ? structuredClone(fixture.rows[name]) : undefined };
}

export async function loadRequestReview() {
  const fixture = window.recordFixture;
  fixture.reviewReads = (fixture.reviewReads ?? 0) + 1;
  await new Promise(resolve => setTimeout(resolve, fixture.readDelay ?? 25));
  if (fixture.reviewFailNext) { fixture.reviewFailNext = false; throw new Error('Fixture review failure.'); }
  const row = fixture.rows.requests;
  if (!row || fixture.unavailable) return null;
  return {
    request: structuredClone({ ...row, document_types: { ...row.document_types, fee_centavos: 5000, requirements: ['Valid ID', 'Proof of residency'] },
      status_history: [{ status: 'submitted', at: row.created_at, note: 'Request submitted' },
        ...(row.status === 'in_progress' ? [{ status: 'in_progress', at: row.updated_at, note: 'Review accepted' }] : [])] }),
    payment: { id: row.id, method: 'pickup', status: 'pending', amount_centavos: 5000, document_fee_centavos: 5000, refund_status: 'none', refund_transfer_link: null },
    evidence: fixture.reviewEvidence ?? null, evidenceImages: fixture.reviewEvidenceImages ?? [], files: fixture.reviewFiles ?? [],
  };
}

export async function loadAdminRecordOptions() {
  const rows = window.recordFixture.rows;
  const resident = rows.residents;
  return { error: null, options: {
    residents: [{ value: resident.id, label: resident.full_name }],
    admins: [{ value: resident.id, label: resident.full_name }],
    documents: [{ value: rows.requests.document_type_id, label: 'Fixture Service' }],
    categories: [{ value: rows.incidents.category_id, label: 'Fixture category' }],
  } };
}
