import type { Polygon } from 'geojson';

/**
 * Hand-written domain types shared by apps/mobile and apps/web.
 *
 * Rule (AGENTS.md §0 — protects the configurable/multi-tenant design, the project's
 * primary novelty claim): never hardcode a barangay-specific value (a document's name,
 * fee, processing target, an incident category, etc.) anywhere in app code. Those values
 * always come from the database, scoped by `barangayId`. The types below describe the
 * *shape* of that configurable data, not the data itself.
 */

/** Role assigned to an authenticated user; RLS policies are keyed on this value + barangayId. */
export type UserRole = 'resident' | 'admin';

/**
 * Shared tracking state for service requests, appointments, and incidents.
 * Algorithm: Finite State Machine + threshold-based expiration (AGENTS.md §3).
 * Not every domain uses every state — e.g. incidents resolve rather than complete.
 */
export type TrackingStatus = 'submitted' | 'in_progress' | 'completed' | 'resolved' | 'cancelled';

/**
 * A barangay-defined document/service type, configured by that barangay's administrator.
 * Read via `document_types` scoped by `barangayId` — never hardcode an instance of this.
 */
export interface DocumentType {
  id: string;
  barangayId: string;
  name: string;
  description: string | null;
  feeCentavos: number;
  processingTargetHours: number;
  requirements: string[];
  isActive: boolean;
}

/** A barangay-defined incident category — configurable per barangay, never hardcoded. */
export interface IncidentCategory {
  id: string;
  barangayId: string;
  name: string;
  /** Feeds the Trash/Illegal Dumping Mapping Module (Module 9) scoring job. */
  isTrashRelated: boolean;
  isActive: boolean;
}

/**
 * One weighted rule in a barangay's vaccination/medicine priority scoring config
 * (Module 10 — Priority Queue with Weighted Eligibility Scoring). The proposal's example
 * weights (senior citizen +3, PWD +2, comorbidity +2, general public +0) are seed defaults,
 * not fixed values — an admin may redefine them per drive.
 */
export interface PriorityWeightRule {
  key: string;
  label: string;
  points: number;
}

/** Minimal barangay record — the multi-tenant root every other table is scoped against. */
export interface Barangay {
  id: string;
  name: string;
  /** GeoJSON polygon used by the Point-in-Polygon geofencing check on registration. */
  boundary: Polygon | null;
}
