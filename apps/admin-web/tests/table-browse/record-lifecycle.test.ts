import { describe, expect, it } from 'vitest';
import { RECORD_CONFIG, validateRecordPatch, editableFields, recordDraft, changedRecordDraft, fieldValue } from '../../src/lib/admin-tables/record-config';
import { archiveBrowseConfig, parseArchiveState } from '../../src/lib/admin-tables/archive-config';
import { parseBrowseState, queryIdentity } from '../../src/lib/admin-tables/browse-state';

describe('record detail edit boundaries', () => {
  it('populates structured resident values and sends only changed fields', () => {
    const row = { id: 'resident', first_name: 'Ana', last_name: 'Cruz', middle_name: 'Reyes', suffix: 'Jr.', house_no: '42', street: 'Mabini', occupation: 'Nurse' };
    const draft = recordDraft('residents', row);
    for (const key of ['first_name', 'last_name', 'middle_name', 'suffix', 'house_no', 'street'] as const) expect(draft[key]).toBe(row[key]);
    expect(changedRecordDraft('residents', row, draft)).toEqual({});
    expect(changedRecordDraft('residents', row, { ...draft, occupation: 'Teacher' })).toEqual({ occupation: 'Teacher' });
  });
  it('reads joined current values and includes table-editable sheet fields', () => {
    const row = { id: 'payment', status: 'pending', service_requests: { reference_number: 'REQ-1', resident_id: 'resident', document_type_id: 'document' } };
    expect(recordDraft('transactions', row)).toMatchObject({ request_reference: 'REQ-1', linked_resident_id: 'resident', linked_document_type_id: 'document' });
    expect(fieldValue({ id: 'staff', profiles: { full_name: 'Current Staff' } }, RECORD_CONFIG.staff.fields[0])).toBe('Current Staff');
    for (const [name, keys] of Object.entries({ requests: ['reference_number', 'resident_id', 'document_type_id', 'created_at'], transactions: ['request_reference', 'linked_resident_id', 'linked_document_type_id', 'collected_by', 'created_at'], incidents: ['category_id', 'reporter_id', 'location', 'confirmation_count', 'created_at'], households: ['name', 'relation', 'role'] })) {
      expect(RECORD_CONFIG[name as keyof typeof RECORD_CONFIG].fields.map(field => field.key)).toEqual(expect.arrayContaining(keys));
    }
  });
  it('routes attendance through its dedicated workflow', () => {
    expect(RECORD_CONFIG.households.fields.map(field => field.key)).not.toContain('is_checked_in');
    expect(() => validateRecordPatch('households', { id: 'member' }, { is_checked_in: true })).toThrow('cannot be edited');
  });
  it('validates coordinates, lookup identities and submitted timestamps', () => {
    expect(validateRecordPatch('incidents', { id: 'incident' }, { location: '14.7, 121.1' })).toEqual({ location: { lat: 14.7, lng: 121.1 } });
    for (const location of ['', null, '1,', '91, 121', '1,181', 'a,b']) expect(() => validateRecordPatch('incidents', { id: 'incident' }, { location })).toThrow('coordinates');
    expect(() => validateRecordPatch('incidents', { id: 'incident' }, { reporter_id: 'not-a-uuid' })).toThrow('Reporter'.toLowerCase());
    expect(() => validateRecordPatch('requests', { id: 'request' }, { created_at: 'bad date' })).toThrow('valid');
  });
  it('uses matching server and browser archive defaults for direct entry and search', () => {
    for (const name of Object.keys(RECORD_CONFIG) as (keyof typeof RECORD_CONFIG)[]) {
      for (const params of [new URLSearchParams(), new URLSearchParams({q:'  test  '}), new URLSearchParams({category:'f1150000-0000-0000-0000-000000000001',doc:'c1150000-0000-0000-0000-000000000001'})]) {
        const server = parseArchiveState(name, params);
        const browser = parseBrowseState(params, archiveBrowseConfig(name,params));
        if(name !== 'requests' && name !== 'transactions') browser.q=browser.q.trim();
        expect(queryIdentity(browser)).toBe(queryIdentity(server));
        if('tab' in browser.filters) expect(browser.filters.tab).toBe('all');
      }
    }
  });
  it('configures all eight requested screens and rejects unexpected fields on every screen', () => {
    expect(Object.keys(RECORD_CONFIG)).toHaveLength(8);
    for (const name of Object.keys(RECORD_CONFIG) as (keyof typeof RECORD_CONFIG)[]) {
      expect(() => validateRecordPatch(name, { id: 'fixture' }, { barangay_id: 'foreign' })).toThrow('cannot be edited');
    }
  });
  it('supports the controlled versioned request editor', () => {
    const request = { id: 'fixture', contract_version: 2, status: 'submitted', sla_state: 'pre_processing' };
    expect(editableFields('requests', request).map(field => field.key)).toEqual([
      'reference_number', 'status', 'requester_notes', 'payment_method', 'payment_status', 'created_at', 'status_change_reason',
    ]);
    const patch = { reference_number: 'REQ-UPDATED', requester_notes: 'Corrected note', created_at: '2026-10-01T08:00:00Z',
      status: 'in_progress', payment_method: 'pickup', payment_status: 'pending' };
    expect(validateRecordPatch('requests', request, patch)).toEqual(patch);
  });
  it('requires a cancellation reason and rejects unavailable versioned request transitions', () => {
    const request = { id: 'fixture', contract_version: 2, status: 'submitted', sla_state: 'pre_processing' };
    for (const status_change_reason of [undefined, '', '   ']) {
      const patch = status_change_reason === undefined ? { status: 'cancelled' } : { status: 'cancelled', status_change_reason };
      expect(() => validateRecordPatch('requests', request, patch)).toThrow('reason for cancelling');
    }
    expect(validateRecordPatch('requests', request, { status: 'cancelled', status_change_reason: ' Duplicate request ' }))
      .toEqual({ status: 'cancelled', status_change_reason: 'Duplicate request' });
    expect(() => validateRecordPatch('requests', request, { status: 'completed' })).toThrow('Select a valid status.');
  });
  it('keeps versioned request snapshots and collected payment amounts protected', () => {
    const request = { id: 'fixture', contract_version: 2 };
    for (const patch of [
      { resident_id: 'b1150000-0000-0000-0000-000000000002' },
      { document_type_id: 'c1150000-0000-0000-0000-000000000001' },
      { submission_payload: {} }, { approved_id_submission_id: null }, { target_minutes_snapshot: 60 },
      { timing_model: 'legacy_hours' }, { pricing_mode_snapshot: 'fixed' },
    ]) expect(() => validateRecordPatch('requests', request, patch)).toThrow('cannot be edited');
    expect(() => validateRecordPatch('transactions', { id: 'fixture', status: 'paid' }, { amount_centavos: 100 })).toThrow('cannot be edited');
  });
  it.each([1, 2])('supports both request payment editors for contract %s', contract_version => {
    const request = { id: 'fixture', contract_version, payment_method: 'qrph', payment_status: 'failed' };
    expect(recordDraft('requests', request)).toMatchObject({ payment_method: 'qrph', payment_status: 'failed' });
    for (const payment_status of ['paid', 'pending', 'failed', 'refunded']) {
      expect(validateRecordPatch('requests', request, { payment_method: 'pickup', payment_status })).toEqual({ payment_method: 'pickup', payment_status });
    }
    for (const payment_status of ['expired', 'cancelled', 'waived', 'invalid']) expect(() => validateRecordPatch('requests', request, { payment_status })).toThrow('valid');
  });
  it('validates numeric, date, contact, stock and time changes before saving', () => {
    expect(() => validateRecordPatch('applicants', { id: 'fixture' }, { age: 130.5 })).toThrow();
    expect(() => validateRecordPatch('applicants', { id: 'fixture' }, { age: -1 })).toThrow();
    expect(() => validateRecordPatch('residents', { id: 'fixture' }, { birth_date: '2026-02-30' })).toThrow();
    expect(() => validateRecordPatch('residents', { id: 'fixture' }, { email: 'invalid' })).toThrow('email');
    expect(() => validateRecordPatch('staff', { id: 'fixture' }, { mobile_number: '1234' })).toThrow('mobile');
    expect(() => validateRecordPatch('health', { id: 'fixture', stock_total: 10, time_start: '08:00', time_end: '12:00' }, { stock_remaining: 11 })).toThrow('exceed');
    expect(() => validateRecordPatch('health', { id: 'fixture', stock_total: 10, stock_remaining: 1, time_start: '08:00' }, { time_end: '07:00' })).toThrow('End time');
  });
  it('trims text, preserves explicit nulls and validates choice and list values', () => {
    expect(validateRecordPatch('incidents', { id: 'fixture' }, { title: ' Updated ', description: '' })).toEqual({ title: 'Updated', description: null });
    expect(validateRecordPatch('applicants', { id: 'fixture' }, { comorbidities: [' Asthma ', ''] })).toEqual({ comorbidities: ['Asthma'] });
    expect(() => validateRecordPatch('staff', { id: 'fixture' }, { official_role: 'invalid-role' })).toThrow('valid');
    expect(() => validateRecordPatch('applicants', { id: 'fixture' }, { is_pwd: 'false' })).toThrow('Yes or No');
  });
});
