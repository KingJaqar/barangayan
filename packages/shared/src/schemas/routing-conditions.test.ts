import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import type { CenterAvailability } from '../lib/evacuation-routing';
import { adminEntityTypeSchema } from './admin-audit-log';
import {
  EVACUATION_CENTER_AVAILABILITIES,
  roadClosureFormSchema,
  roadClosureReopenSchema,
  routingMutationResultSchema,
} from './routing-conditions';

const migration = readFileSync(new URL('../../../../supabase/migrations/0113_routing_conditions.sql', import.meta.url), 'utf8');

const validClosure = { label: 'Luna Street', reason: 'Knee-deep flooding', observedAt: new Date(Date.now() - 60_000), segmentCount: 2 };

describe('routing condition contracts', () => {
  it('availability values match the database check and the routing core', () => {
    expect(migration).toContain(`check (availability in (${EVACUATION_CENTER_AVAILABILITIES.map(v => `'${v}'`).join(', ')}))`);
    const core: readonly CenterAvailability[] = EVACUATION_CENTER_AVAILABILITIES;
    expect(core).toEqual(['available', 'unknown', 'unavailable']);
  });

  it('audit entity types used by the routing RPCs are accepted by the activity feed', () => {
    for (const entityType of ['road_closure', 'routing_area', 'evacuation_center']) {
      expect(migration).toContain(`'${entityType}'`);
      expect(adminEntityTypeSchema.safeParse(entityType).success).toBe(true);
    }
  });

  it('accepts a complete closure and trims its text', () => {
    const parsed = roadClosureFormSchema.parse({ ...validClosure, label: '  Luna Street ', reason: ' Flooded ' });
    expect(parsed.label).toBe('Luna Street');
    expect(parsed.reason).toBe('Flooded');
  });

  it.each([
    ['no segments', { segmentCount: 0 }, 'Select at least one road segment on the map'],
    ['too many segments', { segmentCount: 201 }, 'Select at most 200 road segments'],
    ['blank reason', { reason: '   ' }, 'Enter why the road is closed'],
    ['blank label', { label: '' }, 'Enter a road label'],
    ['future observation', { observedAt: new Date(Date.now() + 60 * 60_000) }, 'The observation time cannot be in the future'],
    ['missing observation', { observedAt: new Date('not a date') }, 'Invalid date'],
  ])('rejects %s', (_name, patch, message) => {
    const result = roadClosureFormSchema.safeParse({ ...validClosure, ...patch });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(message);
  });

  it('requires a reopening reason', () => {
    expect(roadClosureReopenSchema.safeParse({ reason: '  ' }).success).toBe(false);
    expect(roadClosureReopenSchema.parse({ reason: ' Water receded ' }).reason).toBe('Water receded');
  });

  it('parses RPC results and rejects malformed ones', () => {
    expect(routingMutationResultSchema.parse({ id: '7a0c0b8e-4b1a-4c43-9d1e-0b6f6c1f7d2a', revision: 4 }).revision).toBe(4);
    expect(routingMutationResultSchema.safeParse({ id: 'x', revision: 4 }).success).toBe(false);
    expect(routingMutationResultSchema.safeParse(null).success).toBe(false);
  });
});
