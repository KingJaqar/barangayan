export function useRouter() { return { refresh() { window.dispatchEvent(new Event('record-refresh')); }, push() {}, replace() {} }; }
export function usePathname() { return '/fixture'; }
export function useSearchParams() { return new URLSearchParams({ tab: 'all' }); }
export function createSupabaseBrowserClient() {
  return { channel() { return { on() { return this; }, subscribe() { return this; } }; }, removeChannel() {},
    from(table) {
      let patch;
      const query = { select() { return this; }, eq() { return this; }, is() { return this; }, in() { return this; }, order() { return this; }, retry() { return this; }, abortSignal() { return this; }, update(value) { patch = value; return this; },
        async maybeSingle() {
          await new Promise(resolve => setTimeout(resolve, window.recordFixture.readDelay ?? 25));
          const fixture = window.recordFixture;
          fixture.reads++;
          if (fixture.readThrowNext) { fixture.readThrowNext = false; throw new Error('Fixture transport failure.'); }
          if (fixture.readFailNext) { fixture.readFailNext = false; return { data: null, error: { message: 'Fixture read failure.' } }; }
          if (patch && fixture.throwNext) { fixture.throwNext = false; throw new Error('Fixture transport failure.'); }
          if (patch && fixture.failNext) { fixture.failNext = false; return { data: null, error: { message: 'Workflow permission failure.' } }; }
          const row = fixture.rows[fixture.name];
          if (patch && row) Object.assign(row, patch);
          if (!table.startsWith('admin_')) return { data: row ? structuredClone(row) : null, error: null };
          return { data: fixture.unavailable || !row ? null : { row: structuredClone(row), f_archived: !!row.deleted_at }, error: null };
        }, then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve); } };
      return query;
    }, async rpc(name, input) {
      const fixture = window.recordFixture;
      const row = fixture.rows[fixture.name];
      fixture.workflowCalls ??= [];
      fixture.workflowCalls.push({ name, input });
      await new Promise(resolve => setTimeout(resolve, fixture.workflowDelay ?? 25));
      if (fixture.throwNext) { fixture.throwNext = false; throw new Error('Fixture transport failure.'); }
      if (fixture.failNext) { fixture.failNext = false; return { data: null, error: { message: 'Workflow permission failure.' } }; }
      if (fixture.noopNext) { fixture.noopNext = false; return { data: null, error: null }; }
      const statuses = { begin_processing_request: 'in_progress', mark_request_ready_for_pickup: 'ready_for_pickup', complete_service_request: 'completed', cancel_service_request: 'cancelled', withdraw_incident: 'withdrawn' };
      if (statuses[name]) row.status = statuses[name];
      if (name === 'update_incident_status') row.status = input.p_status;
      if (name === 'collect_pickup_payment') row.payment_status = 'paid';
      if (name === 'transition_service_request_sla') {
        const steps = { accept: ['in_progress', 'running'], ready: ['ready_for_pickup', 'ready'], release: ['completed', 'released'], cancel: ['cancelled', 'cancelled'] };
        [row.status, row.sla_state] = steps[input.p_input.action];
      }
      return { data: row.id, error: null };
    }, functions: { async invoke(name, input) {
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
  return { error: null };
}
