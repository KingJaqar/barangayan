import { serviceCatalogContractSchema, serviceDocumentTypeSchema, type ServiceDocumentTypeInput } from '../schemas/service-foundations';
import type { Json, Tables } from '../types/database';
import { formatProcessingTime } from './format';

export const charterSections = [
  ['officeDivision', 'Office/Division'],
  ['classification', 'Classification'],
  ['transactionType', 'Type of Transaction'],
  ['whoMayAvail', 'Who May Avail'],
  ['checklistOfRequirements', 'Checklist of Requirements'],
  ['whereToSecureRequirements', 'Where to Secure the Requirements'],
  ['clientSteps', 'Client Steps'],
  ['agencyActions', 'Agency Actions'],
  ['feesToBePaid', 'Fees to Be Paid'],
  ['processingTime', 'Processing Time'],
  ['personResponsible', 'Person Responsible'],
] as const;

/** One validated mapping for create/edit. Legacy request contracts stay untouched. */
export function serviceDocumentTypeValues(input: ServiceDocumentTypeInput) {
  const value = serviceDocumentTypeSchema.parse(input);
  return {
    name: value.name, description: value.description || null, contract_version: 2,
    service_kind: value.catalog.serviceKind,
    charter: {
      ...value.catalog.charter,
      feesToBePaid: value.catalog.serviceKind === 'business' ? BUSINESS_FEE_DESCRIPTION
        : ['indigency', 'first_time_job_seeker'].includes(value.catalog.serviceKind) ? '₱100.00'
        : value.catalog.serviceKind === 'certified_true_copy' ? '₱10.00 per page' : value.catalog.charter.feesToBePaid,
    },
    purposes: value.catalog.purposes, requirement_rules: value.catalog.requirementRules,
    pricing_mode: value.catalog.serviceKind === 'business' ? 'assessment'
      : ['indigency', 'first_time_job_seeker'].includes(value.catalog.serviceKind) ? 'fixed'
      : value.catalog.serviceKind === 'certified_true_copy' ? 'per_page' : value.catalog.pricingMode,
    processing_target_minutes: value.catalog.processingTargetMinutes,
    fee_centavos: ['indigency', 'first_time_job_seeker'].includes(value.catalog.serviceKind) ? 10000
      : value.catalog.serviceKind === 'certified_true_copy' ? 1000
      : value.catalog.serviceKind === 'business' ? 0
      : value.catalog.pricingMode === 'per_page' ? 1000 : value.catalog.pricingMode === 'fixed' ? value.feeCentavos : 0,
    requirements: value.catalog.charter.checklistOfRequirements.split('\n').map(line => line.trim()).filter(Boolean),
  };
}

export function catalogContract(row: Tables<'document_types'>) {
  if (row.contract_version !== 2) return null;
  return serviceCatalogContractSchema.parse({
    serviceKind: row.service_kind,
    charter: row.charter,
    purposes: row.purposes,
    requirementRules: row.requirement_rules,
    pricingMode: row.pricing_mode,
    processingTargetMinutes: row.processing_target_minutes,
  });
}

export const BUSINESS_FEE_DESCRIPTION = 'See Attached Tax Code (depends on the kind of transaction)';

export function servicePriceLabel(row: Tables<'document_types'>) {
  if (row.service_kind === 'business') return BUSINESS_FEE_DESCRIPTION;
  if (row.service_kind === 'certified_true_copy' || row.pricing_mode === 'per_page') return '₱10.00 per page';
  if (['indigency', 'first_time_job_seeker'].includes(row.service_kind ?? '')) return '₱100.00';
  return row.fee_centavos === 0 ? 'No payment required' : `₱${(row.fee_centavos / 100).toFixed(2)}`;
}

/** A variable tax-code amount is payable at pickup, never treated as a free document. */
export function requestFeeLabel(request: { fee_assessment_state: string }, amount: number | null) {
  if (amount !== null) return `₱${(amount / 100).toFixed(2)}`;
  return request.fee_assessment_state === 'page_count_required'
    ? '₱10.00 per page — enter total pages to continue'
    : BUSINESS_FEE_DESCRIPTION;
}

/** Charter guidance only; elapsed tracking remains a separate timing contract. */
export function serviceProcessingLabel(row: Tables<'document_types'>) {
  return row.contract_version === 2
    ? `${row.processing_target_minutes} minutes of agency processing`
    : formatProcessingTime(row.processing_target_hours);
}

export function idVerificationState(
  profile: Pick<
    Tables<'profiles'>,
    'id_verification_status' | 'approved_id_submission_id' | 'current_id_submission_id' | 'id_repair_required'
  > | null,
) {
  if (
    profile?.id_verification_status === 'verified' &&
    profile.approved_id_submission_id &&
    profile.approved_id_submission_id === profile.current_id_submission_id &&
    !profile.id_repair_required
  )
    return 'verified';
  if (profile?.id_verification_status === 'pending') return 'pending';
  if (profile?.id_verification_status === 'verification_failed' || profile?.id_repair_required)
    return 'failed';
  return 'missing';
}

export const idVerificationMessages = {
  verified: 'Your approved profile ID will be reused for this request.',
  pending: 'Your ID is awaiting verification. Requests are available after approval.',
  failed: 'Your ID needs attention. Open your profile to review the reason and upload a valid ID.',
  missing: 'Upload a valid ID in your profile and have it verified before requesting a document.',
};

export function submittedDetailLines(value: Json | null): [string, string][] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const labels = {
    businessName: 'Business name',
    establishmentAddress: 'Establishment address',
    recordReference: 'Record/document reference',
    copies: 'Number of copies',
    totalPages: 'Total pages across all copies',
  };
  const lines: [string, string][] = [];
  for (const [key, label] of Object.entries(labels))
    if (value[key] !== undefined) lines.push([label, String(value[key])]);
  if (typeof value.isRenter === 'boolean')
    lines.push(['Residency', value.isRenter ? 'Renter' : 'Non-renter']);
  if (value.personalAppearanceAcknowledged === true)
    lines.push(['Personal appearance', 'Requirement acknowledged']);
  return lines;
}

/** Preserve ledger amounts and submission snapshots; variable pickup fees stay unknown. */
export function requestFee(
  request: Pick<
    Tables<'service_requests'>,
    'contract_version' | 'fee_assessment_state' | 'assessed_amount_centavos'
  > & { legacy_fee_centavos?: number | null },
  legacyCatalogFee: number,
  recordedPaymentFee?: number | null,
) {
  if (recordedPaymentFee != null) return recordedPaymentFee;
  if (request.contract_version === 2)
    return request.assessed_amount_centavos;
  return request.legacy_fee_centavos ?? legacyCatalogFee;
}
