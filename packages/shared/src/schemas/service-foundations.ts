import { z } from 'zod';
import { EMPLOYMENT_STATUSES, MOBILE_NUMBER_REGEX, NAME_REGEX, SEXES } from './auth';

export const SUPPORTING_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORTING_FILE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
export const serviceKinds = ['business', 'indigency', 'first_time_job_seeker', 'certified_true_copy', 'general'] as const;
export const pricingModes = ['fixed', 'assessment', 'per_page'] as const;
export const assessmentStates = ['pending', 'assessed', 'waived'] as const;
export const slaActions = ['accept', 'pause', 'resume', 'ready', 'release', 'cancel'] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
export const localitySchema = z.object({ displayName: text(200), city: text(200), province: text(200) }).strict();
export const coordinatesSchema = z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).strict();

// Eleven categories; grouped procedures remain prose, avoiding invented step/person mappings.
export const charterSchema = z.object({
  officeDivision: text(10000), classification: text(200), transactionType: text(200),
  whoMayAvail: text(10000), checklistOfRequirements: text(10000), whereToSecureRequirements: text(10000),
  clientSteps: text(10000), agencyActions: text(10000), feesToBePaid: text(10000),
  processingTime: text(10000), personResponsible: text(10000).nullable(),
}).strict();
export const purposeOptionSchema = z.object({ code: text(100).regex(/^[a-z0-9_]+$/), label: text(200), requiresExplanation: z.boolean() }).strict();
export const requirementRulesSchema = z.object({
  dtiRequired: z.boolean(), hoaRequired: z.boolean(), lessorForRenter: z.boolean(), personalAppearance: z.boolean(),
}).strict();
export const serviceCatalogContractSchema = z.object({
  serviceKind: z.enum(serviceKinds), charter: charterSchema, purposes: z.array(purposeOptionSchema).min(1).max(30),
  requirementRules: requirementRulesSchema, pricingMode: z.enum(pricingModes), processingTargetMinutes: z.number().int().positive().max(2147483647),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.purposes.map(p => p.code)).size !== value.purposes.length) ctx.addIssue({ code: 'custom', path: ['purposes'], message: 'Purpose codes must be unique' });
  if (value.pricingMode === 'per_page' && value.serviceKind !== 'certified_true_copy') ctx.addIssue({ code: 'custom', path: ['pricingMode'], message: 'Per-page pricing applies to Certified True Copy' });
  if (value.requirementRules.dtiRequired && value.serviceKind !== 'business') ctx.addIssue({ code: 'custom', path: ['requirementRules'], message: 'DTI applies to business clearance' });
  if ((value.requirementRules.hoaRequired || value.requirementRules.lessorForRenter) && !['indigency', 'first_time_job_seeker'].includes(value.serviceKind)) ctx.addIssue({ code: 'custom', path: ['requirementRules'], message: 'Residency attachments apply to residency certificates' });
});

export const serviceDocumentTypeSchema = z.object({
  name: text(200), description: z.string().trim().max(2000),
  feeCentavos: z.number().int().min(0).max(2147483647),
  catalog: serviceCatalogContractSchema,
}).strict();
export type ServiceDocumentTypeInput = z.infer<typeof serviceDocumentTypeSchema>;

export const supportingAttachmentSchema = z.object({
  requirementCode: z.enum(['dti', 'hoa', 'lessor', 'other']), path: text(500),
  mimeType: z.enum(SUPPORTING_FILE_MIME_TYPES), sizeBytes: z.number().int().positive().max(SUPPORTING_FILE_MAX_BYTES),
}).strict();
export const serviceSubmissionSchema = z.object({
  documentTypeId: z.string().uuid(), idempotencyKey: z.string().uuid(), purposeCode: text(100),
  purposeExplanation: optionalText(1000), requesterNotes: optionalText(1000),
  legacyIdPath: optionalText(500),
  details: z.object({
    businessName: optionalText(200), establishmentAddress: optionalText(1000), isRenter: z.boolean().optional(),
    recordReference: optionalText(1000), copies: z.number().int().min(1).max(1000).optional(),
    personalAppearanceAcknowledged: z.boolean().optional(),
  }).strict(), attachments: z.array(supportingAttachmentSchema).max(10),
}).strict().superRefine((value, ctx) => {
  if (new Set(value.attachments.map(a => a.path)).size !== value.attachments.length) ctx.addIssue({ code: 'custom', path: ['attachments'], message: 'Duplicate attachment' });
});
export function submissionSchemaForCatalog(catalog: z.infer<typeof serviceCatalogContractSchema>) {
  return serviceSubmissionSchema.superRefine((value, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const purpose = catalog.purposes.find(p => p.code === value.purposeCode);
    if (value.legacyIdPath) issue(['legacyIdPath'], 'Reuse the approved profile ID for this service');
    if (!purpose) issue(['purposeCode'], 'Choose an available purpose');
    if (purpose?.requiresExplanation && !value.purposeExplanation) issue(['purposeExplanation'], 'Explain the purpose');
    if (!purpose?.requiresExplanation && value.purposeExplanation) issue(['purposeExplanation'], 'Explanation applies only to this catalog’s explanation purposes');
    const has = (code: string) => value.attachments.some(a => a.requirementCode === code);
    if (catalog.serviceKind === 'business' && (!value.details.businessName || !value.details.establishmentAddress)) issue(['details'], 'Business name and establishment address are required');
    if (catalog.serviceKind !== 'business' && (value.details.businessName !== undefined || value.details.establishmentAddress !== undefined || has('dti'))) issue(['details'], 'Clear business fields when changing services');
    if (catalog.serviceKind === 'certified_true_copy' && (!value.details.recordReference || !value.details.copies)) issue(['details'], 'Record reference and copies are required');
    if (catalog.serviceKind !== 'certified_true_copy' && (value.details.recordReference !== undefined || value.details.copies !== undefined)) issue(['details'], 'Clear record fields when changing services');
    if (!['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind) && (value.details.isRenter !== undefined || has('hoa') || has('lessor'))) issue(['details'], 'Clear residency fields when changing services');
    if (catalog.requirementRules.dtiRequired && !has('dti')) issue(['attachments'], 'DTI attachment required');
    if (catalog.requirementRules.hoaRequired && !has('hoa')) issue(['attachments'], 'HOA certification required');
    if (catalog.requirementRules.lessorForRenter && value.details.isRenter && !has('lessor')) issue(['attachments'], 'Lessor endorsement required');
    if (catalog.requirementRules.personalAppearance && !value.details.personalAppearanceAcknowledged) issue(['details', 'personalAppearanceAcknowledged'], 'Acknowledge personal appearance');
  });
}

export const profileCompletionSchema = z.object({
  firstName: text(200).regex(NAME_REGEX), lastName: text(200).regex(NAME_REGEX), middleName: optionalText(200), suffix: optionalText(50),
  houseNo: text(200), street: text(500), sex: z.enum(SEXES), employmentStatus: z.enum(EMPLOYMENT_STATUSES), occupation: optionalText(200),
  mobileNumber: z.string().regex(MOBILE_NUMBER_REGEX), birthDate: z.string().date(),
  location: z.object({
    gps: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).strict().nullable(),
    home: z.object({ lat: z.number().finite().min(-90).max(90), lng: z.number().finite().min(-180).max(180) }).strict().nullable(),
  }).strict().optional(),
}).strict().refine(v => v.birthDate <= new Date().toISOString().slice(0, 10), { path: ['birthDate'], message: 'Birth date cannot be in the future' });
export const idPublicationSchema = z.object({ submissionId: z.string().uuid(), idType: text(200), frontPath: text(500), backPath: text(500) }).strict();
export const idReviewSchema = z.object({ submissionId: z.string().uuid(), decision: z.enum(['verified', 'verification_failed', 'revoked']), reason: optionalText(1000) }).strict()
  .refine(v => v.decision === 'verified' || !!v.reason, { path: ['reason'], message: 'A rejection or revocation reason is required' });
export const feeAssessmentSchema = z.object({ requestId: z.string().uuid(), state: z.enum(['assessed', 'waived']), amountCentavos: z.number().int().min(0).max(2147483647), basis: text(1000), billablePages: z.number().int().positive().optional() }).strict()
  .refine(v => v.state !== 'waived' || v.amountCentavos === 0, { path: ['amountCentavos'], message: 'Waiver amount must be zero' });
export const requestReviewSchema = z.object({ requestId: z.string().uuid(), requirementsComplete: z.boolean(), eligibility: z.enum(['pending', 'eligible', 'ineligible']), note: text(1000), personalAppearancePresent: z.boolean() }).strict();
export const slaTransitionSchema = z.object({ requestId: z.string().uuid(), action: z.enum(slaActions), reason: optionalText(1000), requirementsComplete: z.boolean().optional(), personalAppearanceReady: z.boolean().optional() }).strict()
  .superRefine((v, ctx) => {
    if (['pause', 'cancel'].includes(v.action) && !v.reason) ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Reason is required' });
    if (v.action === 'accept' && !v.requirementsComplete) ctx.addIssue({ code: 'custom', path: ['requirementsComplete'], message: 'Complete requirements must be confirmed' });
  });

export type ServiceCatalogContract = z.infer<typeof serviceCatalogContractSchema>;
export type ServiceSubmissionInput = z.infer<typeof serviceSubmissionSchema>;
export type ProfileCompletionInput = z.infer<typeof profileCompletionSchema>;
export type IdPublicationInput = z.infer<typeof idPublicationSchema>;
export type IdReviewInput = z.infer<typeof idReviewSchema>;
export type FeeAssessmentInput = z.infer<typeof feeAssessmentSchema>;
export type RequestReviewInput = z.infer<typeof requestReviewSchema>;
export type SlaTransitionInput = z.infer<typeof slaTransitionSchema>;
export type ServiceKind = (typeof serviceKinds)[number];
export type PricingMode = (typeof pricingModes)[number];
export type FeeAssessmentState = (typeof assessmentStates)[number];
export type SlaState = 'pre_processing' | 'running' | 'paused' | 'ready' | 'released' | 'cancelled';
export type TimingModel = 'legacy_hours' | 'agency_minutes_v1';
