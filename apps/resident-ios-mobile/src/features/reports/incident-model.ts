import type { IncidentStatus } from '../../data/report-filters';

/** The server's withdrawal window (`withdraw_incident`, migration 0121). The client only decides what to offer. */
export const WITHDRAW_WINDOW_MS = 24 * 60 * 60 * 1000;
const ACTIVE = new Set<string>(['open', 'in_progress']);

export type ConcernActions = {
  /** Corroboration is offered: another resident's report, still active, not yet confirmed, and public visibility is open. */
  canConfirm: boolean;
  alreadyConfirmed: boolean;
  canWithdraw: boolean;
  /** Why an own report cannot be withdrawn (A34-028); null when it can, or when there is nothing to explain. */
  withdrawNote: string | null;
};

/**
 * What a resident may do with one concern (A34-018…028). This only decides what to show; the
 * server repeats every check (own report, barangay, status and window) and decides.
 */
export function concernActions(input: { own: boolean; status: string; createdAt: string; now: number; confirmed: boolean; publicIncidents: boolean }): ConcernActions {
  const { own, status, createdAt, now, confirmed, publicIncidents } = input;
  const created = Date.parse(createdAt);
  const windowOpen = Number.isFinite(created) && now - created < WITHDRAW_WINDOW_MS;
  const canWithdraw = own && status === 'open' && windowOpen;
  let withdrawNote: string | null = null;
  if (own && !canWithdraw) {
    if (status === 'withdrawn') withdrawNote = 'You withdrew this report.';
    else if (status !== 'open') withdrawNote = 'This report can no longer be withdrawn because the barangay is already handling it or has closed it.';
    else withdrawNote = 'This report can no longer be withdrawn because the 24-hour withdrawal period has ended.';
  }
  return {
    canConfirm: publicIncidents && !own && !confirmed && ACTIVE.has(status),
    alreadyConfirmed: publicIncidents && !own && confirmed,
    canWithdraw,
    withdrawNote,
  };
}

export type TimelineStep = { status: 'open' | 'in_progress' | 'resolved'; label: string; state: 'done' | 'current' | 'pending'; at: string | null };
export type Timeline = { steps: TimelineStep[]; stopped: { label: string; at: string } | null };

const STEPS: readonly { status: TimelineStep['status']; label: string }[] = [
  { status: 'open', label: 'Report submitted' }, { status: 'in_progress', label: 'In progress' }, { status: 'resolved', label: 'Resolved' },
];

/**
 * The status trail (A34-015). A concern records only its current status, when it was filed and
 * when it last changed, so a time is shown for "submitted" and for the current step only; a step
 * that was passed shows no invented time (plan P12-T06: no invented staff history).
 */
export function concernTimeline(status: string, createdAt: string, updatedAt: string): Timeline {
  const stopped = status === 'withdrawn' ? { label: 'Withdrawn by the reporter', at: updatedAt } : status === 'unresolved' ? { label: 'Closed as unresolved by the barangay', at: updatedAt } : null;
  const index = STEPS.findIndex((step) => step.status === status);
  const steps = STEPS.map((step, position): TimelineStep => ({
    status: step.status, label: step.label,
    state: stopped || index < 0 ? (position === 0 ? 'done' : 'pending') : position < index ? 'done' : position === index ? 'current' : 'pending',
    at: step.status === 'open' ? createdAt : step.status === status ? updatedAt : null,
  }));
  return { steps, stopped };
}

export const isKnownStatus = (status: string): status is IncidentStatus => ['open', 'in_progress', 'resolved', 'withdrawn', 'unresolved'].includes(status);
