/**
 * Versioned model-activation configuration (DRRM weather-routing plan, phase R9a).
 *
 * Decides, from a reviewed configuration and the current model health, which model
 * influence a route may carry. Every model stage is off by default and cannot be switched on
 * without a recorded acceptance and without every earlier stage (plan 3.8: never skip a
 * stage). Closure routing (stage 1) is not a model stage and is never gated here.
 *
 * Pure and import-free (R0 bundling decision). Nothing in the repository consumes this yet:
 * route compilation reads it once the owner enables a stage.
 */

export const ACTIVATION_CONFIG_VERSION = '2026-10-15.r9';

/** Plan 3.8 stages 2-4, in the only order they may be enabled. */
export const MODEL_STAGES = ['sensor', 'advisory', 'exclusion'] as const;
export type ModelStage = (typeof MODEL_STAGES)[number];

export interface StageActivation {
  enabled: boolean;
  /** Reference to the signed acceptance record (document id, minute, ticket). Required to enable. */
  acceptanceRef: string | null;
  /** ISO date (YYYY-MM-DD) of that acceptance. Required to enable. */
  acceptedOn: string | null;
}

export interface ModelActivationConfig {
  version: string;
  stages: Record<ModelStage, StageActivation>;
}

const OFF: StageActivation = Object.freeze({ enabled: false, acceptanceRef: null, acceptedOn: null });

/** Every model stage off: the supported first release (closure routing only). */
export const DEFAULT_ACTIVATION: Readonly<ModelActivationConfig> = Object.freeze({
  version: ACTIVATION_CONFIG_VERSION,
  stages: Object.freeze({ sensor: OFF, advisory: OFF, exclusion: OFF }),
});

export type ActivationIssueCode = 'missing_acceptance' | 'invalid_date' | 'stage_order' | 'invalid_version';

export interface ActivationIssue {
  code: ActivationIssueCode;
  stage: ModelStage | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** A stage enabled without acceptance, with a bad date, or ahead of an earlier stage is invalid. */
export function validateActivationConfig(config: ModelActivationConfig): { ok: true } | { ok: false; issues: ActivationIssue[] } {
  const issues: ActivationIssue[] = [];
  if (typeof config.version !== 'string' || config.version.trim() === '') issues.push({ code: 'invalid_version', stage: null });
  let earlierEnabled = true;
  for (const stage of MODEL_STAGES) {
    const entry = config.stages[stage];
    if (entry.enabled) {
      if (entry.acceptanceRef === null || entry.acceptanceRef.trim() === '') issues.push({ code: 'missing_acceptance', stage });
      if (entry.acceptedOn === null || !validDate(entry.acceptedOn)) issues.push({ code: 'invalid_date', stage });
      if (!earlierEnabled) issues.push({ code: 'stage_order', stage });
    }
    earlierEnabled = earlierEnabled && entry.enabled;
  }
  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

// ---------------------------------------------------------------------------------------
// Model health (plan section 4, "Aging and model failure")
// ---------------------------------------------------------------------------------------

export type ModelHealth = 'ok' | 'degraded' | 'stale' | 'unavailable';

/** Plan 3.6: stale after this many of the source's declared intervals (default N = 10). */
export const MODEL_STALE_INTERVALS = 10;

export interface LatestModelRun {
  modelStatus: 'ok' | 'degraded' | 'unavailable';
  /** Evaluation time of the newest published shadow run, ms since epoch. */
  evaluatedAt: number;
}

/**
 * Health of the newest published run. A run with no confirmed run interval cannot be judged
 * fresh, so it is `unavailable` (missing information is never a pass). A run stamped in the
 * future is `unavailable`, never fresh.
 */
export function classifyModelHealth(latest: LatestModelRun | null, now: number, runIntervalSeconds: number | null): ModelHealth {
  if (latest === null || runIntervalSeconds === null || !(runIntervalSeconds > 0) || !Number.isFinite(latest.evaluatedAt)) return 'unavailable';
  if (latest.evaluatedAt > now) return 'unavailable';
  if (now - latest.evaluatedAt > MODEL_STALE_INTERVALS * runIntervalSeconds * 1000) return 'stale';
  return latest.modelStatus;
}

// ---------------------------------------------------------------------------------------
// Effective influence
// ---------------------------------------------------------------------------------------

export type InfluenceReason = 'config_invalid' | 'stage_disabled' | 'model_stale' | 'model_unavailable';

export interface EffectiveInfluence {
  /** Area banner when an applicable station is at Alert/Alarm/Critical (stage 2). */
  sensorWarning: boolean;
  /** Soft f(e) penalty; never removes an edge (stage 2). */
  sensorPenalty: boolean;
  /** Edges flagged "possible flooding - verify"; the route is not changed (stage 3). */
  bfsAdvisory: boolean;
  /** BFS-flagged edges removed from routing (stage 4). */
  bfsExclusion: boolean;
  /** Why influence was withheld, per stage that was enabled in configuration or all when invalid. */
  withheld: { stage: ModelStage | 'all'; reason: InfluenceReason }[];
}

/**
 * What a route may carry from the model right now. Influence needs the stage enabled in a
 * valid configuration AND a model that is `ok` or `degraded` (a degraded model still reports
 * what it knows; unknown inputs stay unknown). A stale or unavailable model contributes
 * nothing new; previously compiled exclusions are handled as holdover restrictions
 * (`model-exclusions.ts`), never silently dropped.
 */
export function resolveModelInfluence(config: ModelActivationConfig, health: ModelHealth): EffectiveInfluence {
  const none: EffectiveInfluence = { sensorWarning: false, sensorPenalty: false, bfsAdvisory: false, bfsExclusion: false, withheld: [] };
  if (!validateActivationConfig(config).ok) return { ...none, withheld: [{ stage: 'all', reason: 'config_invalid' }] };

  const withheld: EffectiveInfluence['withheld'] = [];
  const allowed = (stage: ModelStage): boolean => {
    if (!config.stages[stage].enabled) {
      withheld.push({ stage, reason: 'stage_disabled' });
      return false;
    }
    if (health === 'stale') {
      withheld.push({ stage, reason: 'model_stale' });
      return false;
    }
    if (health === 'unavailable') {
      withheld.push({ stage, reason: 'model_unavailable' });
      return false;
    }
    return true;
  };
  const sensor = allowed('sensor');
  const advisory = allowed('advisory');
  const exclusion = allowed('exclusion');
  return { sensorWarning: sensor, sensorPenalty: sensor, bfsAdvisory: advisory, bfsExclusion: exclusion, withheld };
}
