import type { PriorityWeightRule } from '../types/domain';

/**
 * Mirrors the weights hardcoded in the `register_for_drive()` / `admin_register_for_drive()`
 * Postgres RPCs (supabase/migrations/0035_medical_drives.sql, 0072_admin_register_for_drive.sql)
 * — the RPCs are the actual source of truth for scoring, since there is no admin-configurable
 * weights table yet (see the audit report's ticket #16: "reconcile with priority-weights.ts").
 * There is currently no config UI that reads or writes these values; this constant exists so
 * client code that wants to *display* the scoring rubric doesn't have to duplicate the numbers.
 * If the RPCs' weights ever change, update this file in the same commit.
 */
export const DEFAULT_VACCINATION_PRIORITY_WEIGHTS: PriorityWeightRule[] = [
  { key: 'pwd', label: 'PWD', points: 30 },
  { key: 'senior_citizen', label: 'Senior Citizen (60+)', points: 20 },
  { key: 'infant_toddler', label: 'Infant/Toddler (under 5)', points: 15 },
  { key: 'prior_dose_on_file', label: 'Prior Dose on File', points: 10 },
  { key: 'comorbidity', label: 'Comorbidity (each, capped at 20 total)', points: 5 },
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
