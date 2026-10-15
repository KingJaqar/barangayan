import { describe, expect, it } from 'vitest';
import { RECORD_CONFIG, validateRecordPatch, editableFields } from '../../src/lib/admin-tables/record-config';
import { archiveBrowseConfig, parseArchiveState } from '../../src/lib/admin-tables/archive-config';
import { parseBrowseState, queryIdentity } from '../../src/lib/admin-tables/browse-state';

describe('record detail edit boundaries', () => {
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
  it('keeps versioned request snapshots and collected payment amounts protected', () => {
    const request = { id: 'fixture', contract_version: 2 };
    expect(editableFields('requests', request).map(field => field.key)).toEqual(['payment_method']);
    expect(() => validateRecordPatch('requests', request, { requester_notes: 'changed' })).toThrow();
    expect(() => validateRecordPatch('transactions', { id: 'fixture', status: 'paid' }, { amount_centavos: 100 })).toThrow();
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
