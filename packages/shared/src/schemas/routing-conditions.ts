import { z } from 'zod';

/** Mirrors the evacuation_centers.availability check (migration 0113). New centers start unknown, never available. */
export const EVACUATION_CENTER_AVAILABILITIES = ['available', 'unknown', 'unavailable'] as const;

export type EvacuationCenterAvailability = (typeof EVACUATION_CENTER_AVAILABILITIES)[number];

export const evacuationCenterAvailabilitySchema = z.enum(EVACUATION_CENTER_AVAILABILITIES);

/** publish_road_closure input checks; the database repeats them and validates the segments. */
export const roadClosureFormSchema = z.object({
  label: z.string().trim().min(1, 'Enter a road label').max(120, 'Keep the road label under 120 characters'),
  reason: z.string().trim().min(1, 'Enter why the road is closed').max(500, 'Keep the reason under 500 characters'),
  observedAt: z
    .date({ invalid_type_error: 'Enter when the closure was observed' })
    .refine(date => date.getTime() <= Date.now() + 5 * 60_000, 'The observation time cannot be in the future'),
  segmentCount: z
    .number()
    .int()
    .min(1, 'Select at least one road segment on the map')
    .max(200, 'Select at most 200 road segments'),
});

export const roadClosureReopenSchema = z.object({
  reason: z.string().trim().min(1, 'Enter why the road is open again').max(500, 'Keep the reason under 500 characters'),
});

const snapshotPointSchema = z.object({ lat: z.number(), lng: z.number() });

/**
 * get_routing_conditions_snapshot (migration 0113): one complete, consistent snapshot.
 * A closure with `edgeIds: null` has no mapping for the requested graph and must be
 * treated as an unmapped restriction, never dropped. Tombstones list reopened closures
 * and removed centers.
 */
export const routingConditionsSnapshotSchema = z.object({
  schemaVersion: z.literal(1),
  areaId: z.string(),
  revision: z.number().int().nonnegative(),
  revisedAt: z.string(),
  generatedAt: z.string(),
  graphVersion: z.string().nullable(),
  activeGraphVersion: z.string().nullable(),
  graphStatus: z.enum(['none', 'active', 'registered', 'unregistered']),
  closures: z.array(
    z.object({
      id: z.string().uuid(),
      label: z.string(),
      reason: z.string(),
      observedAt: z.string(),
      publishedAt: z.string(),
      revision: z.number().int().nonnegative(),
      sourceRefs: z.array(z.string()),
      geometry: z.object({
        type: z.literal('MultiLineString'),
        coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
      }),
      edgeIds: z.array(z.string()).nullable(),
    }),
  ),
  centers: z.array(
    z.object({
      id: z.string().uuid(),
      name: z.string(),
      active: z.boolean(),
      availability: evacuationCenterAvailabilitySchema,
      availabilityUpdatedAt: z.string().nullable(),
      // Center positions are free-form jsonb; an unusable one is treated as missing (unroutable).
      position: snapshotPointSchema.nullable().catch(null),
      entrancePosition: snapshotPointSchema.nullable(),
      entranceNodeId: z.string().nullable(),
      revision: z.number().int().nonnegative(),
    }),
  ),
  tombstones: z.array(
    z.object({
      entityType: z.enum(['road_closure', 'evacuation_center']),
      id: z.string(),
      revision: z.number().int().nonnegative(),
      removedAt: z.string(),
    }),
  ),
});

export type RoutingConditionsSnapshot = z.infer<typeof routingConditionsSnapshotSchema>;

const packLngLatSchema = z.tuple([z.number(), z.number()]);

/**
 * The fields of a routing pack's graph.json (plan R3) that the admin closure and entrance
 * editors use; other fields are stripped. The routing core's prepareRoutingGraph remains
 * the full graph validator.
 */
export const routingPackEditorGraphSchema = z.object({
  version: z.string(),
  coverage: z.array(z.array(packLngLatSchema)),
  nodes: z.array(z.object({ id: z.string(), lat: z.number(), lng: z.number() })),
  edges: z.array(
    z.object({
      id: z.string(),
      geometry: z.array(packLngLatSchema).min(2),
      name: z.string().nullable(),
      bridge: z.boolean(),
      stairs: z.boolean(),
      sourceRef: z.string(),
    }),
  ),
});

export type RoutingPackEditorGraph = z.infer<typeof routingPackEditorGraphSchema>;

/** Result of the closure and entrance RPCs. */
export const routingMutationResultSchema = z.object({
  id: z.string().uuid(),
  revision: z.number().int().nonnegative(),
});

export const routingGraphRegistrationResultSchema = z.object({
  graphVersion: z.string(),
  active: z.boolean(),
  revision: z.number().int().nonnegative(),
});
