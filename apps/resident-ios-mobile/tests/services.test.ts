import { describe, expect, it } from 'vitest';
import { documentRow } from '../src/data/schemas';
import { applyState, describeService, durationLabel, extraRequirements, serviceIcon, SERVICE_COPY, type CatalogueRow } from '../src/features/services/catalog';

const ID = '11111111-1111-4111-8111-111111111111';
const charter = {
  officeDivision: 'Barangay Hall — Records', classification: 'Simple', transactionType: 'G2C - Government to Citizen', whoMayAvail: 'Residents',
  checklistOfRequirements: 'Valid ID\nProof of residency', whereToSecureRequirements: 'Barangay Hall', clientSteps: 'Submit\nPay', agencyActions: 'Review\nRelease',
  feesToBePaid: '₱100.00', processingTime: '30 minutes', personResponsible: 'Barangay Secretary',
};
const purposes = [{ code: 'employment', label: 'Employment', requiresExplanation: false }, { code: 'other', label: 'Other', requiresExplanation: true }];
const rules = { dtiRequired: false, hoaRequired: true, lessorForRenter: true, personalAppearance: false };
const legacy: CatalogueRow = { id: ID, name: 'Barangay Clearance', description: null, fee_centavos: 5000, processing_target_hours: 24, requirements: ['Valid ID'], contract_version: 1, service_kind: null, charter: null, purposes: [], requirement_rules: {}, pricing_mode: 'fixed', processing_target_minutes: null };
const v2 = (patch: Partial<CatalogueRow> = {}): CatalogueRow => ({
  ...legacy, name: 'Certificate of Indigency', fee_centavos: 10000, requirements: ['Valid ID', 'Proof of residency'], contract_version: 2, service_kind: 'indigency',
  charter, purposes, requirement_rules: rules, pricing_mode: 'fixed', processing_target_minutes: 90, ...patch,
});

describe('catalogue row contract (P07-T02, B06)', () => {
  it('accepts a legacy row and a version-2 row, and keeps one malformed charter from failing the page', () => {
    expect(documentRow.safeParse(legacy).success).toBe(true);
    expect(documentRow.safeParse(v2()).success).toBe(true);
    expect(documentRow.safeParse(v2({ charter: 'not an object', purposes: 12 })).success).toBe(true);
  });
  it('rejects a row without the contract columns, so a drifted backend is a schema failure', () => {
    const { contract_version: _removed, ...incomplete } = legacy;
    expect(documentRow.safeParse(incomplete).success).toBe(false);
  });
});

describe('legacy services (P07-T02)', () => {
  it('uses the stored fee and the shared processing buckets', () => {
    const entry = describeService(legacy);
    expect(entry.contract).toBe('legacy');
    expect(entry.requestable).toBe(true);
    expect(entry.priceLabel).toBe('₱50.00');
    expect(entry.processingLabel).toBe('Same Day');
    expect(entry.charter).toEqual([]);
    expect(entry.requirements).toEqual(['Valid ID']);
  });
  it('says no payment is required only for a stored zero fee', () => {
    expect(describeService({ ...legacy, fee_centavos: 0 }).priceLabel).toBe(SERVICE_COPY.feeFree);
  });
});

describe('charter services (P07-T02/T03)', () => {
  it('renders all eleven fields in the contract order from the row, with no invented text', () => {
    const entry = describeService(v2());
    expect(entry.requestable).toBe(true);
    expect(entry.charter.map((section) => section.label)).toEqual([
      'Office/Division', 'Classification', 'Type of Transaction', 'Who May Avail', 'Checklist of Requirements', 'Where to Secure the Requirements',
      'Client Steps', 'Agency Actions', 'Fees to Be Paid', 'Processing Time', 'Person Responsible',
    ]);
    expect(entry.charter.find((section) => section.key === 'clientSteps')?.lines).toEqual(['Submit', 'Pay']);
    expect(entry.purposes.map((purpose) => purpose.code)).toEqual(['employment', 'other']);
    expect(entry.rules).toEqual(['A homeowners’ association certification is required.', 'Renters must attach an endorsement from their lessor.']);
  });
  it('shows an unconfigured field as unspecified (empty lines) and a null responsible person likewise', () => {
    const entry = describeService(v2({ charter: { ...charter, whoMayAvail: '   ', personResponsible: null } }));
    expect(entry.charter.find((section) => section.key === 'whoMayAvail')?.lines).toEqual([]);
    expect(entry.charter.find((section) => section.key === 'personResponsible')?.lines).toEqual([]);
    // The strict contract also rejects the blank field, so the service is not requestable.
    expect(entry.requestable).toBe(false);
    expect(entry.unavailableReason).toBe(SERVICE_COPY.incomplete);
  });
  it('is not requestable when the charter, purposes or rules are absent or malformed', () => {
    expect(describeService(v2({ charter: null })).requestable).toBe(false);
    expect(describeService(v2({ purposes: [] })).requestable).toBe(false);
    expect(describeService(v2({ requirement_rules: { dtiRequired: true, hoaRequired: false, lessorForRenter: false, personalAppearance: false } })).requestable).toBe(false);
    expect(describeService(v2({ charter: 'garbage', purposes: 'garbage', requirement_rules: 'garbage' })).charter.every((section) => section.lines.length === 0)).toBe(true);
  });
  it('treats an unknown contract version as unsupported rather than a legacy form', () => {
    const entry = describeService(v2({ contract_version: 3 }));
    expect(entry.contract).toBe('unsupported');
    expect(entry.requestable).toBe(false);
    expect(entry.unavailableReason).toBe(SERVICE_COPY.unsupported);
  });
  it('labels each pricing mode from the stored values, never a hard-coded amount', () => {
    expect(describeService(v2({ pricing_mode: 'fixed', fee_centavos: 25000 })).priceLabel).toBe('₱250.00');
    expect(describeService(v2({ pricing_mode: 'fixed', fee_centavos: 0 })).priceLabel).toBe(SERVICE_COPY.feeFree);
    expect(describeService(v2({ pricing_mode: 'per_page', service_kind: 'certified_true_copy', fee_centavos: 1000 })).priceLabel).toBe('₱10.00 per page');
    expect(describeService(v2({ pricing_mode: 'per_page', service_kind: 'certified_true_copy', fee_centavos: 0 })).priceLabel).toBe(SERVICE_COPY.perPage);
    expect(describeService(v2({ pricing_mode: 'assessment', service_kind: 'general', fee_centavos: 0 })).priceLabel).toBe(SERVICE_COPY.feeAssessed);
    expect(describeService(v2({ pricing_mode: 'assessment', service_kind: 'business', fee_centavos: 0 })).priceLabel).toBe('See Attached Tax Code (depends on the kind of transaction)');
    expect(describeService(v2({ pricing_mode: 'surprise' })).priceLabel).toBe(SERVICE_COPY.feeNotSpecified);
  });
  it('describes the agency processing target in whole units, or says it is unspecified', () => {
    expect(describeService(v2({ processing_target_minutes: 90 })).processingLabel).toBe('1 hour 30 minutes of agency processing');
    expect(describeService(v2({ processing_target_minutes: 1 })).processingLabel).toBe('1 minute of agency processing');
    expect(describeService(v2({ processing_target_minutes: null })).processingLabel).toBe(SERVICE_COPY.processingNotSpecified);
    expect(durationLabel(120)).toBe('2 hours');
  });
  it('does not repeat the checklist in the requirements list, but keeps any extra legacy entry', () => {
    expect(extraRequirements(describeService(v2()))).toEqual([]);
    expect(extraRequirements(describeService(v2({ requirements: ['Valid ID', 'Cedula'] })))).toEqual(['Cedula']);
  });
});

describe('service icons', () => {
  it('prefers the service kind, then a name keyword, then a generic document', () => {
    expect(serviceIcon({ name: 'Anything', service_kind: 'business' })).toBe('briefcase');
    expect(serviceIcon({ name: 'Barangay Clearance', service_kind: null })).toBe('checkmark.shield');
    expect(serviceIcon({ name: 'Something New', service_kind: null })).toBe('doc.text');
  });
});

describe('request action (P07-T04)', () => {
  const entry = describeService(v2());
  const base = { entry, signedIn: true, profileComplete: true, idStatus: 'verified' as const };
  it('offers the request only to a signed-in resident with a complete profile and an approved ID', () => {
    expect(applyState(base)).toEqual({ kind: 'ready' });
  });
  it('sends a guest to sign-in and an incomplete profile to completion before the ID', () => {
    expect(applyState({ ...base, signedIn: false })).toEqual({ kind: 'guest' });
    expect(applyState({ ...base, profileComplete: false, idStatus: 'missing' })).toEqual({ kind: 'profile-incomplete' });
  });
  it('remediates every ID state that is not approved, including an unconfirmed one', () => {
    for (const status of ['missing', 'pending', 'failed', 'unknown'] as const) expect(applyState({ ...base, idStatus: status })).toEqual({ kind: 'id', status });
  });
  it('never opens a request for a service whose configuration cannot drive a form, even for a guest', () => {
    const broken = describeService(v2({ charter: null }));
    expect(applyState({ ...base, entry: broken, signedIn: false })).toEqual({ kind: 'unavailable', reason: SERVICE_COPY.incomplete });
  });
});
