import { describe, expect, it } from 'vitest';
import { BUSINESS_FEE_DESCRIPTION, catalogContract, charterSections, requestFee, requestFeeLabel, serviceDocumentTypeValues, servicePriceLabel } from './service-catalog';
import type { Tables } from '../types/database';
import { serviceDocumentTypeSchema, submissionSchemaForCatalog, type ServiceDocumentTypeInput } from '../schemas/service-foundations';

describe('Request amounts and catalog guidance', () => {
  it('distinguishes variable pickup fees and missing page counts from free requests', () => {
    expect(requestFeeLabel({ fee_assessment_state: 'pickup_due' }, null)).toBe(BUSINESS_FEE_DESCRIPTION);
    expect(requestFeeLabel({ fee_assessment_state: 'page_count_required' }, null)).toContain('enter total pages');
    expect(requestFeeLabel({ fee_assessment_state: 'assessed' }, 10000)).toBe('₱100.00');
  });
  it('pending pricing cannot masquerade as a free catalog service', () => {
    expect(
      requestFee({ contract_version: 2, fee_assessment_state: 'pending', assessed_amount_centavos: null }, 0),
    ).toBeNull();
  });
  it('uses the assessment after catalog prices change, including explicit exemptions', () => {
    expect(
      requestFee(
        { contract_version: 2, fee_assessment_state: 'assessed', assessed_amount_centavos: 4000 },
        1000,
      ),
    ).toBe(4000);
    expect(
      requestFee({ contract_version: 2, fee_assessment_state: 'waived', assessed_amount_centavos: 0 }, 10000),
    ).toBe(0);
  });
  it('preserves historical ledger amounts ahead of current catalog prices', () => {
    expect(
      requestFee(
        { contract_version: 1, fee_assessment_state: 'legacy', assessed_amount_centavos: null },
        1000,
        12500,
      ),
    ).toBe(12500);
    expect(
      requestFee(
        { contract_version: 1, fee_assessment_state: 'legacy', assessed_amount_centavos: null },
        5000,
      ),
    ).toBe(5000);
    expect(
      requestFee(
        {
          contract_version: 1,
          fee_assessment_state: 'legacy',
          assessed_amount_centavos: null,
          legacy_fee_centavos: 7500,
        },
        1000,
      ),
    ).toBe(7500);
  });
  it('includes all eleven readable charter categories with personnel last', () => {
    expect(charterSections).toHaveLength(11);
    expect(new Set(charterSections.map(([key]) => key)).size).toBe(11);
    expect(charterSections.at(-1)?.[0]).toBe('personResponsible');
  });
});

describe('Unified document charter writes', () => {
  const input: ServiceDocumentTypeInput = {
    name: ' Local certificate ', description: ' Published description ', feeCentavos: 2550,
    catalog: { serviceKind: 'general', charter: {
      officeDivision: 'Office', classification: 'Complex', transactionType: 'G2B', whoMayAvail: 'Applicants',
      checklistOfRequirements: ' Valid ID \n\n Application ', whereToSecureRequirements: 'Front desk',
      clientSteps: 'Submit application', agencyActions: 'Review and issue', feesToBePaid: 'Published schedule',
      processingTime: 'Review: 10 minutes; issue: 5 minutes', personResponsible: 'Duty officer',
    }, purposes: [{ code: 'application', label: 'Application', requiresExplanation: true }],
    requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: false, personalAppearance: true },
    pricingMode: 'fixed', processingTargetMinutes: 25 },
  };
  it('round-trips every field through the actual persisted-column mapping', () => {
    const values = serviceDocumentTypeValues(input);
    expect(values.name).toBe('Local certificate');
    expect(values.description).toBe('Published description');
    expect(values.requirements).toEqual(['Valid ID', 'Application']);
    const row: Tables<'document_types'> = { ...values, contract_version: 2,
      id: '00000000-0000-4000-8000-000000000003', barangay_id: '00000000-0000-4000-8000-000000000004',
      created_at: '2026-10-04T00:00:00Z', deleted_at: null, is_active: true, processing_target_hours: 1 };
    expect(catalogContract(row)).toEqual(serviceDocumentTypeSchema.parse(input).catalog);
    expect(values.charter.processingTime).not.toBe(String(values.processing_target_minutes));
    expect(values.fee_centavos).toBe(2550);
    expect(values.charter.feesToBePaid).toBe('Published schedule');
  });
  it('does not invent a confirmed charge in assessment mode', () => {
    expect(serviceDocumentTypeValues({ ...input, catalog: { ...input.catalog, pricingMode: 'assessment' } }).fee_centavos).toBe(0);
  });
  it('uses the specified service fees regardless of the draft amount', () => {
    for (const serviceKind of ['indigency', 'first_time_job_seeker'] as const) {
      const values = serviceDocumentTypeValues({ ...input, feeCentavos: 999, catalog: { ...input.catalog, serviceKind } });
      expect(values.fee_centavos).toBe(10000);
      expect(servicePriceLabel(values as Tables<'document_types'>)).toBe('₱100.00');
    }
    const business = serviceDocumentTypeValues({ ...input, catalog: { ...input.catalog, serviceKind: 'business' } });
    expect(servicePriceLabel(business as Tables<'document_types'>)).toBe(BUSINESS_FEE_DESCRIPTION);
    const copies = serviceDocumentTypeValues({ ...input, catalog: { ...input.catalog, serviceKind: 'certified_true_copy', pricingMode: 'per_page' } });
    expect(servicePriceLabel(copies as Tables<'document_types'>)).toBe('₱10.00 per page');
  });
  it('allows multiple ordinary services without specialized resident details', () => {
    const schema = submissionSchemaForCatalog(input.catalog);
    expect(schema.safeParse({ documentTypeId: '00000000-0000-4000-8000-000000000001',
      idempotencyKey: '00000000-0000-4000-8000-000000000002', purposeCode: 'application', purposeExplanation: 'Application reason',
      details: { personalAppearanceAcknowledged: true }, attachments: [] }).success).toBe(true);
  });
  it('rejects invalid amounts, targets, incomplete charters, and incompatible rules', () => {
    for (const feeCentavos of [-1, NaN, 2147483648]) expect(serviceDocumentTypeSchema.safeParse({ ...input, feeCentavos }).success).toBe(false);
    for (const processingTargetMinutes of [0, 1.5, 2147483648]) expect(serviceDocumentTypeSchema.safeParse({ ...input, catalog: { ...input.catalog, processingTargetMinutes } }).success).toBe(false);
    expect(serviceDocumentTypeSchema.safeParse({ ...input, catalog: { ...input.catalog, charter: { ...input.catalog.charter, officeDivision: ' ' } } }).success).toBe(false);
    expect(serviceDocumentTypeSchema.safeParse({ ...input, catalog: { ...input.catalog, requirementRules: { ...input.catalog.requirementRules, dtiRequired: true } } }).success).toBe(false);
  });
});
