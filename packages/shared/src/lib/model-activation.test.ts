import { describe, expect, it } from 'vitest';
import {
  ACTIVATION_CONFIG_VERSION,
  DEFAULT_ACTIVATION,
  MODEL_STALE_INTERVALS,
  classifyModelHealth,
  resolveModelInfluence,
  validateActivationConfig,
  type ModelActivationConfig,
  type StageActivation,
} from './model-activation.ts';

const ON: StageActivation = { enabled: true, acceptanceRef: 'DRRM-2026-001', acceptedOn: '2026-10-15' };
const OFF: StageActivation = { enabled: false, acceptanceRef: null, acceptedOn: null };

function config(sensor: StageActivation, advisory: StageActivation = OFF, exclusion: StageActivation = OFF): ModelActivationConfig {
  return { version: ACTIVATION_CONFIG_VERSION, stages: { sensor, advisory, exclusion } };
}

describe('activation configuration', () => {
  it('ships with every model stage off, and that is valid', () => {
    expect(validateActivationConfig(DEFAULT_ACTIVATION)).toEqual({ ok: true });
    expect(Object.isFrozen(DEFAULT_ACTIVATION)).toBe(true);
    expect(Object.isFrozen(DEFAULT_ACTIVATION.stages)).toBe(true);
    const influence = resolveModelInfluence(DEFAULT_ACTIVATION, 'ok');
    expect(influence).toMatchObject({ sensorWarning: false, sensorPenalty: false, bfsAdvisory: false, bfsExclusion: false });
    expect(influence.withheld.map(w => w.reason)).toEqual(['stage_disabled', 'stage_disabled', 'stage_disabled']);
  });

  it('accepts stages enabled in order with acceptance records', () => {
    expect(validateActivationConfig(config(ON))).toEqual({ ok: true });
    expect(validateActivationConfig(config(ON, ON, ON))).toEqual({ ok: true });
  });

  it('refuses a stage enabled ahead of an earlier one (no skipping, plan 3.8)', () => {
    expect(validateActivationConfig(config(OFF, ON))).toEqual({ ok: false, issues: [{ code: 'stage_order', stage: 'advisory' }] });
    expect(validateActivationConfig(config(ON, OFF, ON))).toEqual({ ok: false, issues: [{ code: 'stage_order', stage: 'exclusion' }] });
  });

  it('refuses a stage enabled without an acceptance record or with a bad date', () => {
    expect(validateActivationConfig(config({ ...ON, acceptanceRef: null }))).toEqual({ ok: false, issues: [{ code: 'missing_acceptance', stage: 'sensor' }] });
    expect(validateActivationConfig(config({ ...ON, acceptanceRef: '   ' }))).toEqual({ ok: false, issues: [{ code: 'missing_acceptance', stage: 'sensor' }] });
    expect(validateActivationConfig(config({ ...ON, acceptedOn: '2026-02-30' }))).toEqual({ ok: false, issues: [{ code: 'invalid_date', stage: 'sensor' }] });
    expect(validateActivationConfig(config({ ...ON, acceptedOn: '15/10/2026' }))).toEqual({ ok: false, issues: [{ code: 'invalid_date', stage: 'sensor' }] });
  });

  it('refuses an empty version', () => {
    expect(validateActivationConfig({ ...config(OFF), version: '' })).toEqual({ ok: false, issues: [{ code: 'invalid_version', stage: null }] });
  });

  it('withholds all influence when the configuration is invalid', () => {
    const influence = resolveModelInfluence(config(OFF, ON, ON), 'ok');
    expect(influence).toEqual({ sensorWarning: false, sensorPenalty: false, bfsAdvisory: false, bfsExclusion: false, withheld: [{ stage: 'all', reason: 'config_invalid' }] });
  });
});

describe('resolveModelInfluence', () => {
  it('applies exactly the enabled stages while the model is ok or degraded', () => {
    expect(resolveModelInfluence(config(ON), 'ok')).toMatchObject({ sensorWarning: true, sensorPenalty: true, bfsAdvisory: false, bfsExclusion: false });
    expect(resolveModelInfluence(config(ON, ON), 'degraded')).toMatchObject({ sensorWarning: true, bfsAdvisory: true, bfsExclusion: false });
    expect(resolveModelInfluence(config(ON, ON, ON), 'ok')).toMatchObject({ sensorPenalty: true, bfsAdvisory: true, bfsExclusion: true, withheld: [] });
  });

  it.each(['stale', 'unavailable'] as const)('contributes nothing new while the model is %s', health => {
    const influence = resolveModelInfluence(config(ON, ON, ON), health);
    expect(influence).toMatchObject({ sensorWarning: false, sensorPenalty: false, bfsAdvisory: false, bfsExclusion: false });
    expect(influence.withheld).toEqual([
      { stage: 'sensor', reason: `model_${health}` },
      { stage: 'advisory', reason: `model_${health}` },
      { stage: 'exclusion', reason: `model_${health}` },
    ]);
  });
});

describe('classifyModelHealth', () => {
  const NOW = Date.parse('2026-10-15T06:00:00Z');

  it('is unavailable without a run, without a confirmed interval, or for a future run', () => {
    expect(classifyModelHealth(null, NOW, 600)).toBe('unavailable');
    expect(classifyModelHealth({ modelStatus: 'ok', evaluatedAt: NOW }, NOW, null)).toBe('unavailable');
    expect(classifyModelHealth({ modelStatus: 'ok', evaluatedAt: NOW }, NOW, 0)).toBe('unavailable');
    expect(classifyModelHealth({ modelStatus: 'ok', evaluatedAt: NOW + 1 }, NOW, 600)).toBe('unavailable');
  });

  it('turns stale after ten run intervals', () => {
    const limit = MODEL_STALE_INTERVALS * 600 * 1000;
    expect(classifyModelHealth({ modelStatus: 'ok', evaluatedAt: NOW - limit }, NOW, 600)).toBe('ok');
    expect(classifyModelHealth({ modelStatus: 'ok', evaluatedAt: NOW - limit - 1 }, NOW, 600)).toBe('stale');
  });

  it('passes through the run status while fresh', () => {
    expect(classifyModelHealth({ modelStatus: 'degraded', evaluatedAt: NOW }, NOW, 600)).toBe('degraded');
    expect(classifyModelHealth({ modelStatus: 'unavailable', evaluatedAt: NOW }, NOW, 600)).toBe('unavailable');
  });
});
