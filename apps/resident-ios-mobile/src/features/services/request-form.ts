import {
  BUSINESS_FEE_DESCRIPTION, formatCentavosAsPHP, serviceCatalogContractSchema, serviceRequestFieldErrors, submissionSchemaForCatalog, supportingAttachmentMetadata,
  type ServiceCatalogContract, type ServiceRequestField, type ServiceSubmissionInput,
} from '@barangayan/shared';
import type { UploadMime } from '../../lib/file-validation';
import type { CatalogueRow } from './catalog';

export type Requirement = ServiceSubmissionInput['attachments'][number]['requirementCode'];
export type SubmissionDraft = Omit<ServiceSubmissionInput, 'idempotencyKey'>;
export type FieldErrors = Partial<Record<ServiceRequestField, string>>;

/** Everything the resident types. File bytes are never part of it: they stay in memory (see `Evidence`). */
export type FormFields = {
  purposeCode: string;
  explanation: string;
  notes: string;
  businessName: string;
  address: string;
  isRenter: boolean;
  recordReference: string;
  copies: string;
  totalPages: string;
  appearance: boolean;
};

export const EXPLANATION_MAX = 1000;
export const NOTES_MAX = 1000;
export const BUSINESS_NAME_MAX = 200;
export const ADDRESS_MAX = 1000;
export const REFERENCE_MAX = 1000;
const PAGE_RATE_CENTAVOS = 1000;

export function emptyFields(): FormFields {
  return { purposeCode: '', explanation: '', notes: '', businessName: '', address: '', isRenter: false, recordReference: '', copies: '1', totalPages: '1', appearance: false };
}

/** A validated, in-memory supporting file. `uploaded` flips once its immutable object is stored. */
export type EvidenceFile = { uploadId: string; name: string; mimeType: UploadMime; bytes: Uint8Array; uploaded: boolean };
export type Evidence = Partial<Record<Requirement, EvidenceFile>>;

/** The validated version-2 contract of a catalogue row, or null for a legacy/unsupported/incomplete row. */
export function catalogOf(row: CatalogueRow): ServiceCatalogContract | null {
  if (row.contract_version !== 2) return null;
  const parsed = serviceCatalogContractSchema.safeParse({
    serviceKind: row.service_kind, charter: row.charter, purposes: row.purposes, requirementRules: row.requirement_rules,
    pricingMode: row.pricing_mode, processingTargetMinutes: row.processing_target_minutes,
  });
  return parsed.success ? parsed.data : null;
}

const isResidency = (catalog: ServiceCatalogContract) => catalog.serviceKind === 'indigency' || catalog.serviceKind === 'first_time_job_seeker';

/** Slots the form can show; `other` exists in the contract but no service asks for it. */
export type EvidenceSlot = { code: Exclude<Requirement, 'other'>; label: string; required: boolean };

/** The supporting-file slots this service shows for the current answers (A11-017…021). */
export function evidenceSlots(catalog: ServiceCatalogContract, fields: Pick<FormFields, 'isRenter'>): EvidenceSlot[] {
  const rules = catalog.requirementRules;
  if (catalog.serviceKind === 'business') return [{ code: 'dti', label: 'DTI registration', required: rules.dtiRequired }];
  if (!isResidency(catalog)) return [];
  const slots: EvidenceSlot[] = [{ code: 'hoa', label: 'HOA certification', required: rules.hoaRequired }];
  if (fields.isRenter) slots.push({ code: 'lessor', label: 'Lessor endorsement', required: rules.lessorForRenter });
  return slots;
}

/** Drops files whose slot no longer applies (renter switched off, service changed) so incompatible evidence cannot be submitted. */
export function pruneEvidence(catalog: ServiceCatalogContract, fields: Pick<FormFields, 'isRenter'>, evidence: Evidence): Evidence {
  const allowed = new Set<string>(evidenceSlots(catalog, fields).map((slot) => slot.code));
  return Object.fromEntries(Object.entries(evidence).filter(([code]) => allowed.has(code))) as Evidence;
}

/** Changing the purpose clears the explanation, which belongs to the previous choice (plan §6.2). */
export function choosePurpose(fields: FormFields, purposeCode: string): FormFields {
  return fields.purposeCode === purposeCode ? fields : { ...fields, purposeCode, explanation: '' };
}

export function purposeOf(catalog: ServiceCatalogContract, fields: Pick<FormFields, 'purposeCode'>) {
  return catalog.purposes.find((purpose) => purpose.code === fields.purposeCode);
}

const count = (value: string) => (/^\d+$/.test(value.trim()) ? Number(value.trim()) : Number.NaN);

/** The exact payload for a charter service, with the attachment metadata of the files in `evidence`. */
export function buildSubmission(catalog: ServiceCatalogContract, documentTypeId: string, userId: string, fields: FormFields, evidence: Evidence): SubmissionDraft {
  const purpose = purposeOf(catalog, fields);
  const slots = evidenceSlots(catalog, fields);
  const details: SubmissionDraft['details'] = {
    ...(catalog.serviceKind === 'business' ? { businessName: fields.businessName.trim(), establishmentAddress: fields.address.trim() } : {}),
    ...(isResidency(catalog) ? { isRenter: fields.isRenter } : {}),
    ...(catalog.serviceKind === 'certified_true_copy' ? { recordReference: fields.recordReference.trim(), copies: count(fields.copies), totalPages: count(fields.totalPages) } : {}),
    ...(catalog.requirementRules.personalAppearance ? { personalAppearanceAcknowledged: fields.appearance } : {}),
  };
  return {
    documentTypeId,
    purposeCode: fields.purposeCode,
    purposeExplanation: purpose?.requiresExplanation ? fields.explanation.trim() : undefined,
    requesterNotes: fields.notes.trim() || undefined,
    details,
    attachments: slots.flatMap(({ code }) => {
      const file = evidence[code];
      return file ? [supportingAttachmentMetadata(userId, { uploadId: file.uploadId, requirementCode: code, mimeType: file.mimeType, sizeBytes: file.bytes.length })] : [];
    }),
  };
}

/** A version-1 request: notes and an optional ID photo only; the server rejects anything else. */
export function buildLegacySubmission(documentTypeId: string, notes: string, legacyIdPath?: string): SubmissionDraft {
  return { documentTypeId, purposeCode: 'legacy', requesterNotes: notes.trim() || undefined, legacyIdPath, details: {}, attachments: [] };
}

/**
 * Field errors for a charter draft, from the same schema the server contract is built from.
 * The idempotency key is irrelevant to the rules, so a fixed valid UUID stands in for it.
 */
export function validateSubmission(catalog: ServiceCatalogContract, draft: SubmissionDraft): FieldErrors {
  const result = submissionSchemaForCatalog(catalog).safeParse({ ...draft, idempotencyKey: '00000000-0000-4000-8000-000000000000' });
  return result.success ? {} : serviceRequestFieldErrors(result.error);
}

/** Notes are the only legacy field with a limit the form can break. */
export function validateLegacyNotes(notes: string): string | undefined {
  return notes.trim().length > NOTES_MAX ? `Keep the purpose of your request within ${NOTES_MAX.toLocaleString('en-PH')} characters.` : undefined;
}

/** What the resident will pay is decided by the barangay; this is the informational basis only (plan §6.2). */
export function feeNote(catalog: ServiceCatalogContract | null, priceLabel: string, fields: Pick<FormFields, 'totalPages'>): string {
  if (!catalog) return priceLabel;
  if (catalog.serviceKind === 'business') return `${BUSINESS_FEE_DESCRIPTION}. The barangay confirms the amount.`;
  if (catalog.serviceKind === 'certified_true_copy') {
    const pages = count(fields.totalPages);
    return Number.isInteger(pages) && pages >= 1
      ? `Estimate: ${formatCentavosAsPHP(pages * PAGE_RATE_CENTAVOS)} (${formatCentavosAsPHP(PAGE_RATE_CENTAVOS)} × ${pages} ${pages === 1 ? 'page' : 'pages'}). The amount on your request is the one that applies.`
      : `${formatCentavosAsPHP(PAGE_RATE_CENTAVOS)} per page across all copies.`;
  }
  return priceLabel;
}

const ATTACHMENT_LABEL: Record<Requirement, string> = { dti: 'DTI registration', hoa: 'HOA certification', lessor: 'Lessor endorsement', other: 'Supporting document' };

/**
 * The exact values that will be sent, in form order, for the review step and for a locked
 * attempt. Built from the payload itself, so what is shown is what is submitted.
 */
export function reviewLines(catalog: ServiceCatalogContract | null, payload: SubmissionDraft, fileNames: Partial<Record<Requirement, string>> = {}): [string, string][] {
  const lines: [string, string][] = [];
  if (!catalog) {
    lines.push(['Purpose of request', payload.requesterNotes ?? 'Not provided'], ['ID photo', payload.legacyIdPath ? 'Attached' : 'Not attached']);
    return lines;
  }
  const details = payload.details;
  lines.push(['Purpose', catalog.purposes.find((purpose) => purpose.code === payload.purposeCode)?.label ?? 'Not chosen']);
  if (payload.purposeExplanation) lines.push(['Explanation', payload.purposeExplanation]);
  if (details.businessName !== undefined) lines.push(['Business name', details.businessName]);
  if (details.establishmentAddress !== undefined) lines.push(['Establishment address', details.establishmentAddress]);
  if (details.isRenter !== undefined) lines.push(['Residency', details.isRenter ? 'Renter' : 'Not a renter']);
  if (details.recordReference !== undefined) lines.push(['Record/document reference', details.recordReference]);
  if (details.copies !== undefined) lines.push(['Number of copies', String(details.copies)]);
  if (details.totalPages !== undefined) lines.push(['Total pages across all copies', String(details.totalPages)]);
  if (details.personalAppearanceAcknowledged !== undefined) lines.push(['Personal appearance', details.personalAppearanceAcknowledged ? 'Understood: you must appear in person' : 'Not confirmed']);
  for (const attachment of payload.attachments) lines.push([ATTACHMENT_LABEL[attachment.requirementCode], fileNames[attachment.requirementCode] ?? 'Attached']);
  lines.push(['Additional notes', payload.requesterNotes ?? 'None']);
  return lines;
}
