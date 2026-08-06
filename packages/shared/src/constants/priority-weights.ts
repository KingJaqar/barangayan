import type { PriorityWeightRule } from '../types/domain';

/**
 * Seed defaults only — an admin may redefine these per drive/barangay via the config UI.
 * Never branch runtime logic on these specific values; always read the barangay's actual
 * configured rules from the database.
 *
 * Source: proposal's own example weighting (page 11), Module 10 — Priority Queue with
 * Weighted Eligibility Scoring.
 */
export const DEFAULT_VACCINATION_PRIORITY_WEIGHTS: PriorityWeightRule[] = [
  { key: 'senior_citizen', label: 'Senior Citizen', points: 3 },
  { key: 'pwd', label: 'PWD', points: 2 },
  { key: 'comorbidity', label: 'Comorbidity', points: 2 },
  { key: 'general_public', label: 'General Public', points: 0 },
];

/**
 * Seed defaults for the Time-Decay Weighted Frequency Scoring config used by the
 * Trash/Illegal Dumping Mapping Module's `pg_cron` job (Module 9).
 */
export interface TrashScoringConfig {
  /** How many days until a report's contribution to a zone's score halves. */
  halfLifeDays: number;
  /** Score threshold at which a zone is flagged high-priority on the admin map. */
  highPriorityThreshold: number;
}

export const DEFAULT_TRASH_SCORING_CONFIG: TrashScoringConfig = {
  halfLifeDays: 14,
  highPriorityThreshold: 5,
};
