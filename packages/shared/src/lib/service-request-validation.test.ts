import { describe, expect, it } from 'vitest';
import { submissionSchemaForCatalog, type ServiceCatalogContract } from '../schemas/service-foundations';
import { residentServiceError } from './resident-submission';
import { serviceRequestFieldErrors } from './service-request-validation';

const id = 'a1260000-0000-4000-8000-000000000001';
const catalog = {
  serviceKind: 'indigency', purposes: [{ code: 'medical', label: 'Medical assistance', requiresExplanation: false }],
  requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: true, personalAppearance: true },
} as ServiceCatalogContract;
const input = { documentTypeId: id, idempotencyKey: id, purposeCode: '', details: { isRenter: true, personalAppearanceAcknowledged: false }, attachments: [] };

describe('document request field guidance', () => {
  it('identifies every missing requirement without making optional HOA mandatory', () => {
    const result = submissionSchemaForCatalog(catalog).safeParse(input);
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = serviceRequestFieldErrors(result.error);
    expect(Object.keys(errors).sort()).toEqual(['lessor', 'personalAppearanceAcknowledged', 'purposeCode']);
    expect(residentServiceError(result.error)).toBe('Choose a purpose for your request.');
    expect(Object.values(errors).join(' ')).not.toMatch(/String must contain|character\(s\)|Zod/);
  });
  it('identifies each business field and required certification separately', () => {
    const result = submissionSchemaForCatalog({ ...catalog, serviceKind: 'business', requirementRules: { dtiRequired: true, hoaRequired: false, lessorForRenter: false, personalAppearance: false } })
      .safeParse({ ...input, purposeCode: 'medical', details: {} });
    expect(result.success).toBe(false);
    if (!result.success) expect(Object.keys(serviceRequestFieldErrors(result.error)).sort()).toEqual(['businessName', 'dti', 'establishmentAddress']);
  });
  it('clears the errors once a non-renter completes the form without an optional upload', () => {
    expect(submissionSchemaForCatalog(catalog).safeParse({ ...input, purposeCode: 'medical', details: { isRenter: false, personalAppearanceAcknowledged: true } }).success).toBe(true);
  });
});

describe('safe request error notifications', () => {
  it.each(['forbidden', 'new row violates row-level security policy', 'permission denied for table service_requests'])('replaces %s with account guidance', message => {
    expect(residentServiceError({ message, code: '42501' })).toContain('active resident account');
    expect(residentServiceError({ message, code: '42501' }, 'upload')).toContain('upload request attachments');
  });
  it('preserves specific approved-ID guidance even when the database denies permission', () => {
    expect(residentServiceError({ message: 'current_approved_ID_required', code: '42501' })).toContain('Open Verify Now');
  });
  it('does not tell residents with administrator access to use a different account', () => {
    const message = residentServiceError(new Error('resident_account_required'));
    expect(message).toContain('resident profile');
    expect(message).not.toMatch(/administrator|Use a resident account/);
  });
  it.each(['duplicate key value violates unique constraint secret_table', 'unexpected_internal_token', 'ERROR: database detail'])('never exposes an unknown server error: %s', message => {
    expect(residentServiceError({ message })).not.toContain(message);
    expect(residentServiceError({ message }, 'upload')).not.toContain(message);
  });
  it('describes a lost reply without encouraging a new duplicate request', () => {
    expect(residentServiceError(new TypeError('Failed to fetch'))).toContain('retry unchanged');
  });
});
