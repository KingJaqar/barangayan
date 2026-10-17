import {
  BUSINESS_FEE_DESCRIPTION, charterSections, formatCentavosAsPHP, formatProcessingTime, purposeOptionSchema, requirementRulesSchema,
  serviceCatalogContractSchema, serviceKinds,
} from '@barangayan/shared';
import type { IconName } from '@expo/ui';
import type { z } from 'zod';
import type { documentRow } from '../../data/schemas';

export type CatalogueRow = z.infer<typeof documentRow>;
type ServiceKind = typeof serviceKinds[number];
export type CharterKey = typeof charterSections[number][0];

const LEGACY_VERSION = 1;
const CHARTER_VERSION = 2;

export const NOT_SPECIFIED = 'Not specified by your barangay';

/** English labels for the catalogue, kept together so they can be localized later. */
export const SERVICE_COPY = {
  feeAssessed: 'Fee assessed by the barangay',
  feeFree: 'No payment required',
  feeNotSpecified: 'Fee not specified',
  perPage: 'Charged per page',
  processingNotSpecified: 'Processing time not specified',
  originalsNote: 'Bring the original documents for verification at the barangay hall. Processing times are estimates and may vary during peak periods.',
  unsupported: 'This service uses a newer setup than this version of the app understands. Update the app, or contact your barangay to request it.',
  incomplete: 'This service is still being set up by your barangay, so it cannot be requested here yet.',
} as const;

const RULE_LINES = {
  dtiRequired: 'A DTI registration attachment is required.',
  hoaRequired: 'A homeowners’ association certification is required.',
  lessorForRenter: 'Renters must attach an endorsement from their lessor.',
  personalAppearance: 'You must appear in person at the barangay hall.',
} as const;
type RuleKey = keyof typeof RULE_LINES;
const RULE_ORDER: readonly RuleKey[] = ['dtiRequired', 'hoaRequired', 'lessorForRenter', 'personalAppearance'];

export type CharterSection = { key: CharterKey; label: string; lines: string[] };
type PurposeOption = z.infer<typeof purposeOptionSchema>;
type ServiceContract = 'legacy' | 'charter' | 'unsupported';

export type ServiceEntry = {
  contract: ServiceContract;
  /** False when the configuration cannot drive a form: a request must not be started from it. */
  requestable: boolean;
  /** Why the service cannot be requested, shown instead of an Apply action. */
  unavailableReason: string | null;
  charter: CharterSection[];
  purposes: PurposeOption[];
  rules: string[];
  requirements: string[];
  priceLabel: string;
  processingLabel: string;
};

const lines = (value: string) => value.split('\n').map((line) => line.trim()).filter(Boolean);
const record = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

/** "90" → "1 hour 30 minutes". Whole units only; nothing is rounded. */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const unit = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
  if (hours === 0) return unit(minutes, 'minute');
  return rest === 0 ? unit(hours, 'hour') : `${unit(hours, 'hour')} ${unit(rest, 'minute')}`;
}

function priceLabel(row: CatalogueRow, contract: ServiceContract, kind: ServiceKind | null): string {
  const amount = formatCentavosAsPHP(row.fee_centavos);
  if (contract === 'charter') {
    switch (row.pricing_mode) {
      case 'assessment': return kind === 'business' ? BUSINESS_FEE_DESCRIPTION : SERVICE_COPY.feeAssessed;
      case 'per_page': return row.fee_centavos > 0 ? `${amount} per page` : SERVICE_COPY.perPage;
      case 'fixed': return row.fee_centavos > 0 ? amount : SERVICE_COPY.feeFree;
      default: return SERVICE_COPY.feeNotSpecified;
    }
  }
  if (contract === 'legacy') return row.fee_centavos > 0 ? amount : SERVICE_COPY.feeFree;
  return SERVICE_COPY.feeNotSpecified;
}

function processingLabel(row: CatalogueRow, contract: ServiceContract): string {
  if (contract === 'charter') {
    return row.processing_target_minutes ? `${durationLabel(row.processing_target_minutes)} of agency processing` : SERVICE_COPY.processingNotSpecified;
  }
  if (contract === 'legacy') return formatProcessingTime(row.processing_target_hours);
  return SERVICE_COPY.processingNotSpecified;
}

/**
 * Turns one catalogue row into what the screens show. Every value comes from the row; a
 * missing charter field is reported as unspecified (an empty `lines`), never invented.
 * Version-2 rows are requestable only when the whole contract passes the shared schema,
 * the same one the administrator editor and the submission use.
 */
export function describeService(row: CatalogueRow): ServiceEntry {
  const contract: ServiceContract = row.contract_version === LEGACY_VERSION ? 'legacy' : row.contract_version === CHARTER_VERSION ? 'charter' : 'unsupported';
  const kindResult = row.service_kind === null ? null : serviceKinds.find((kind) => kind === row.service_kind) ?? null;
  const base = { requirements: row.requirements, priceLabel: priceLabel(row, contract, kindResult), processingLabel: processingLabel(row, contract) };
  if (contract !== 'charter') {
    const unavailable = contract === 'unsupported';
    return { ...base, contract, requestable: !unavailable, unavailableReason: unavailable ? SERVICE_COPY.unsupported : null, charter: [], purposes: [], rules: [] };
  }
  const charter = record(row.charter);
  const sections = charterSections.map(([key, label]): CharterSection => {
    const value = charter[key];
    return { key, label, lines: typeof value === 'string' ? lines(value) : [] };
  });
  const purposes = (Array.isArray(row.purposes) ? row.purposes : []).flatMap((item) => {
    const parsed = purposeOptionSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
  const rules = requirementRulesSchema.safeParse(row.requirement_rules);
  const complete = serviceCatalogContractSchema.safeParse({
    serviceKind: row.service_kind, charter: row.charter, purposes: row.purposes, requirementRules: row.requirement_rules,
    pricingMode: row.pricing_mode, processingTargetMinutes: row.processing_target_minutes,
  }).success;
  return {
    ...base, contract, requestable: complete, unavailableReason: complete ? null : SERVICE_COPY.incomplete, charter: sections, purposes,
    rules: rules.success ? RULE_ORDER.filter((key) => rules.data[key]).map((key) => RULE_LINES[key]) : [],
  };
}

/**
 * Legacy requirement entries that the charter checklist does not already list. A version-2
 * row mirrors its checklist into `requirements`, so repeating it would only duplicate text.
 */
export function extraRequirements(entry: ServiceEntry): string[] {
  const checklist = new Set(entry.charter.find((section) => section.key === 'checklistOfRequirements')?.lines ?? []);
  return entry.requirements.filter((requirement) => !checklist.has(requirement.trim()));
}

const KIND_ICON: Record<ServiceKind, IconName> = {
  business: 'briefcase',
  indigency: 'heart',
  first_time_job_seeker: 'person.badge.plus',
  certified_true_copy: 'doc.on.doc',
  general: 'doc.text',
};
const NAME_ICONS: readonly [string, IconName][] = [
  ['clearance', 'checkmark.shield'], ['indigency', 'heart'], ['residency', 'house'], ['business', 'briefcase'], ['permit', 'briefcase'], ['id', 'person.text.rectangle'],
];
/** Card icon from the service kind, else a keyword in the name (the catalogue has no icon column), else a generic document. */
export function serviceIcon(row: Pick<CatalogueRow, 'name' | 'service_kind'>): IconName {
  const byKind = serviceKinds.find((kind) => kind === row.service_kind);
  if (byKind) return KIND_ICON[byKind];
  const name = row.name.toLowerCase();
  return NAME_ICONS.find(([word]) => name.includes(word))?.[1] ?? 'doc.text';
}

/** The resident's ID readiness; `unknown` means the status could not be confirmed, which is never treated as approved. */
export type IdReadiness = 'verified' | 'pending' | 'failed' | 'missing' | 'unknown';

export type ApplyState =
  | { kind: 'unavailable'; reason: string }
  | { kind: 'guest' }
  | { kind: 'profile-incomplete' }
  | { kind: 'id'; status: Exclude<IdReadiness, 'verified'> }
  | { kind: 'ready' };

/**
 * What the service detail offers as its primary action. A request needs, in order: a
 * requestable service, a signed-in resident, a committed profile and an approved ID. The
 * server re-checks all of them at submission; this only avoids opening a form that cannot succeed.
 */
export function applyState(input: { entry: ServiceEntry; signedIn: boolean; profileComplete: boolean; idStatus: IdReadiness }): ApplyState {
  if (!input.entry.requestable) return { kind: 'unavailable', reason: input.entry.unavailableReason ?? SERVICE_COPY.incomplete };
  if (!input.signedIn) return { kind: 'guest' };
  if (!input.profileComplete) return { kind: 'profile-incomplete' };
  if (input.idStatus !== 'verified') return { kind: 'id', status: input.idStatus };
  return { kind: 'ready' };
}
