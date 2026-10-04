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
    service_kind: value.catalog.serviceKind, charter: value.catalog.charter,
    purposes: value.catalog.purposes, requirement_rules: value.catalog.requirementRules,
    pricing_mode: value.catalog.pricingMode, processing_target_minutes: value.catalog.processingTargetMinutes,
    fee_centavos: value.catalog.pricingMode === 'per_page' ? 1000 : value.catalog.pricingMode === 'fixed' ? value.feeCentavos : 0,
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

export function servicePriceLabel(row: Tables<'document_types'>) {
  if (row.contract_version === 2 && row.pricing_mode !== 'fixed')
    return row.pricing_mode === 'per_page'
      ? '₱10 per confirmed billable page · assessed by staff'
      : 'Awaiting fee assessment';
  return row.fee_centavos === 0 ? 'No payment required' : `₱${(row.fee_centavos / 100).toFixed(2)}`;
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

/** Historical amounts come from the ledger first. V2 never falls back to a catalog fee. */
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
    return request.fee_assessment_state === 'pending' ? null : request.assessed_amount_centavos;
  return request.legacy_fee_centavos ?? legacyCatalogFee;
}
