import { describe, expect, it } from 'vitest';
import { charterSchema, coordinatesSchema, feeAssessmentSchema, idReviewSchema, profileCompletionSchema, serviceCatalogContractSchema, serviceSubmissionSchema, slaTransitionSchema, supportingAttachmentSchema, submissionSchemaForCatalog } from './service-foundations';
import type { ServiceCatalogContract, ServiceSubmissionInput } from './service-foundations';

const uuid = 'b1000000-0000-4000-8000-000000000001';
const charter = { officeDivision: 'Office', classification: 'Simple', transactionType: 'G2C', whoMayAvail: 'Residents', checklistOfRequirements: 'Requirements', whereToSecureRequirements: 'Office', clientSteps: 'Grouped steps', agencyActions: 'Grouped actions', feesToBePaid: 'Assessment', processingTime: '15 minutes', personResponsible: null };
const catalog: ServiceCatalogContract = { serviceKind: 'indigency', charter: charterSchema.parse(charter), purposes: [{ code: 'medical', label: 'Medical assistance', requiresExplanation: false }, { code: 'others', label: 'Others', requiresExplanation: true }], requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: true, personalAppearance: true }, pricingMode: 'assessment', processingTargetMinutes: 15 };
const input: ServiceSubmissionInput = { documentTypeId: uuid, idempotencyKey: uuid, purposeCode: 'medical', details: { personalAppearanceAcknowledged: true }, attachments: [] };
const attachment = { requirementCode: 'lessor' as const, path: `${uuid}/${uuid}/file.pdf`, mimeType: 'application/pdf' as const, sizeBytes: 5242880 };

describe('Phase 1 shared contracts', () => {
  it('retains grouped charter prose and explicitly missing personnel', () => {
    expect(serviceCatalogContractSchema.parse(catalog).charter.personResponsible).toBeNull();
    expect(charterSchema.safeParse({ ...charter, classification: 'Complex' }).success).toBe(true);
    expect(charterSchema.safeParse({ ...charter, classification: ' ' }).success).toBe(false);
    expect(charterSchema.safeParse({ ...charter, transactionType: ' ' }).success).toBe(false);
    expect(charterSchema.safeParse({ ...charter, agencyActions: '' }).success).toBe(false);
  });
  it('rejects duplicated purpose codes', () => expect(serviceCatalogContractSchema.safeParse({ ...catalog, purposes: [catalog.purposes[0], catalog.purposes[0]] }).success).toBe(false));
  it('requires only configured conditional residency evidence', () => {
    const schema = submissionSchemaForCatalog(catalog);
    expect(schema.safeParse(input).success).toBe(true);
    const renter = { ...input, details: { ...input.details, isRenter: true } };
    expect(schema.safeParse(renter).success).toBe(false);
    expect(schema.safeParse({ ...renter, attachments: [attachment] }).success).toBe(true);
  });
  it.each(['', '   ', 'x'.repeat(1001)])('rejects invalid Others explanations', explanation => {
    expect(submissionSchemaForCatalog(catalog).safeParse({ ...input, purposeCode: 'others', purposeExplanation: explanation }).success).toBe(false);
  });
  it('trims purpose independently of optional notes and accepts the exact maximum', () => {
    const result = submissionSchemaForCatalog(catalog).parse({ ...input, purposeCode: 'others', purposeExplanation: ` ${'x'.repeat(1000)} `, requesterNotes: ' note ' });
    expect(result.purposeExplanation).toHaveLength(1000);
    expect(result.requesterNotes).toBe('note');
  });
  it('rejects service switching residue, unsupported purposes and missing acknowledgment', () => {
    const schema = submissionSchemaForCatalog(catalog);
    expect(schema.safeParse({ ...input, details: { ...input.details, businessName: 'Old business' } }).success).toBe(false);
    expect(schema.safeParse({ ...input, purposeCode: 'renewal' }).success).toBe(false);
    expect(schema.safeParse({ ...input, details: {} }).success).toBe(false);
  });
  it('requires business information and configured DTI', () => {
    const schema = submissionSchemaForCatalog({ ...catalog, serviceKind: 'business', requirementRules: { ...catalog.requirementRules, dtiRequired: true } });
    const business = { ...input, details: { ...input.details, businessName: 'Shop', establishmentAddress: 'Main Street' } };
    expect(schema.safeParse(business).success).toBe(false);
    expect(schema.safeParse({ ...business, attachments: [{ ...attachment, requirementCode: 'dti' }] }).success).toBe(true);
  });
  it('requires a record reference and positive integer copies', () => {
    const schema = submissionSchemaForCatalog({ ...catalog, serviceKind: 'certified_true_copy' });
    expect(schema.safeParse(input).success).toBe(false);
    expect(schema.safeParse({ ...input, details: { ...input.details, recordReference: 'Record 12', copies: 2 } }).success).toBe(true);
    expect(schema.safeParse({ ...input, details: { ...input.details, recordReference: 'Record 12', copies: 1.5 } }).success).toBe(false);
  });
  it('enforces MIME/size and duplicate attachment limits', () => {
    expect(supportingAttachmentSchema.safeParse(attachment).success).toBe(true);
    for (const change of [{ sizeBytes: 5242881 }, { sizeBytes: 0 }, { mimeType: 'image/gif' }]) expect(supportingAttachmentSchema.safeParse({ ...attachment, ...change }).success).toBe(false);
    expect(serviceSubmissionSchema.safeParse({ ...input, attachments: [attachment, attachment] }).success).toBe(false);
  });
  it('does not accept forged identity, tenant, verification or timestamps in RPC input', () => {
    for (const field of ['residentId', 'barangayId', 'approvedIdSubmissionId', 'acceptedAt']) expect(serviceSubmissionSchema.safeParse({ ...input, [field]: uuid }).success).toBe(false);
  });
  it('supports password-free completion and rejects authority/locality fields', () => {
    const profile = { firstName: 'Ana', lastName: 'Reyes', houseNo: '12', street: 'Main Street', sex: 'female', employmentStatus: 'student', mobileNumber: '09171234567', birthDate: '2000-02-29' };
    expect(profileCompletionSchema.safeParse(profile).success).toBe(true);
    for (const field of ['password', 'role', 'barangayId', 'city', 'province', 'userId']) expect(profileCompletionSchema.safeParse({ ...profile, [field]: 'forged' }).success).toBe(false);
    expect(profileCompletionSchema.safeParse({ ...profile, birthDate: '2001-02-29' }).success).toBe(false);
  });
  it('requires recorded decision and transition reasons and complete requirements', () => {
    expect(idReviewSchema.safeParse({ submissionId: uuid, decision: 'revoked' }).success).toBe(false);
    expect(slaTransitionSchema.safeParse({ requestId: uuid, action: 'pause', reason: '  ' }).success).toBe(false);
    expect(slaTransitionSchema.safeParse({ requestId: uuid, action: 'accept' }).success).toBe(false);
    expect(slaTransitionSchema.safeParse({ requestId: uuid, action: 'accept', requirementsComplete: true }).success).toBe(true);
    expect(feeAssessmentSchema.safeParse({ requestId: uuid, state: 'waived', amountCentavos: 100, basis: 'Exempt' }).success).toBe(false);
  });
  it('validates finite coordinate ranges for later map consumers', () => {
    for (const lat of [NaN, Infinity, 91]) expect(coordinatesSchema.safeParse({ lat, lng: 121 }).success).toBe(false);
    expect(coordinatesSchema.safeParse({ lat: 90, lng: -180 }).success).toBe(true);
  });
});
