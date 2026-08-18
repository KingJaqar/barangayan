/**
 * Ticket 12 — Automated Service Tracking auto-flagging + rolling-average trend
 * analysis. document_types.processing_target_hours was always stored, but
 * nothing ever compared it to elapsed time or aggregated it into a trend —
 * this fills that gap without any new DB columns, using status_history
 * (already logged by the track_service_request_status trigger, 0002/0026) as
 * the source of completion timestamps.
 */

export type SlaFlag = 'on_track' | 'near_target' | 'overdue';

/** A request is "near target" once it's spent 80%+ of its target processing time. */
const NEAR_TARGET_RATIO = 0.8;

/**
 * Flags an in-flight request against its document type's target processing
 * time. Only meaningful for requests still open (submitted/in_progress/
 * out_for_delivery) — callers should not call this for completed/cancelled
 * requests, since "elapsed since submission" no longer means anything once
 * the clock has stopped.
 */
export function getSlaFlag(createdAtIso: string, targetHours: number, now: Date = new Date()): SlaFlag {
  const elapsedHours = (now.getTime() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60);
  if (elapsedHours >= targetHours) return 'overdue';
  if (elapsedHours >= targetHours * NEAR_TARGET_RATIO) return 'near_target';
  return 'on_track';
}

export const SLA_FLAG_LABEL: Record<SlaFlag, string> = {
  on_track: 'On Track',
  near_target: 'Near Target',
  overdue: 'Overdue',
};

type StatusHistoryEntry = { status: string; at: string };

/**
 * Reads the timestamp of the 'completed' entry out of a request's
 * status_history and returns the hours between submission and completion, or
 * null if the request was never completed (cancelled, still open, or —
 * defensively — history predates this column being populated).
 */
export function getCompletionHours(createdAtIso: string, statusHistory: unknown): number | null {
  if (!Array.isArray(statusHistory)) return null;
  const completedEntry = (statusHistory as StatusHistoryEntry[]).find((e) => e?.status === 'completed');
  if (!completedEntry?.at) return null;
  const hours = (new Date(completedEntry.at).getTime() - new Date(createdAtIso).getTime()) / (1000 * 60 * 60);
  return hours >= 0 ? hours : null;
}

export interface DocumentTypeTrend {
  documentTypeId: string;
  documentTypeName: string;
  targetHours: number;
  /** Rolling average completion time (hours) over the sampled window. Null if no completions yet. */
  averageHours: number | null;
  completedCount: number;
}

/**
 * Groups a set of completed requests by document type and computes each
 * type's rolling-average completion time. Callers pass in requests already
 * filtered to a window (e.g. completed in the last 30 days) and status = 'completed'.
 */
export function computeDocumentTypeTrends(
  requests: Array<{
    document_type_id: string;
    created_at: string;
    status_history: unknown;
  }>,
  documentTypes: Array<{ id: string; name: string; processing_target_hours: number }>,
): DocumentTypeTrend[] {
  const hoursByType = new Map<string, number[]>();
  for (const req of requests) {
    const hours = getCompletionHours(req.created_at, req.status_history);
    if (hours === null) continue;
    const list = hoursByType.get(req.document_type_id) ?? [];
    list.push(hours);
    hoursByType.set(req.document_type_id, list);
  }

  return documentTypes.map((doc) => {
    const samples = hoursByType.get(doc.id) ?? [];
    const averageHours = samples.length > 0 ? samples.reduce((sum, h) => sum + h, 0) / samples.length : null;
    return {
      documentTypeId: doc.id,
      documentTypeName: doc.name,
      targetHours: doc.processing_target_hours,
      averageHours,
      completedCount: samples.length,
    };
  });
}
