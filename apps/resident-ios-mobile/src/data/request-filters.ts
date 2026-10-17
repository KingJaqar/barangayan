/**
 * The My Requests filters (A12-008…018). Groups mirror Android: All, Active (submitted or in
 * progress), Pickup (ready) and History (completed or cancelled). Only Active has a second
 * level, which resets whenever the group changes. A filter is a plain description that the
 * data layer turns into a server-side restriction, so paging and counts stay correct.
 */
export type RequestGroup = 'all' | 'active' | 'pickup' | 'history';
export type ActiveSub = 'all' | 'pending_payment' | 'paid' | 'processing';
export type RequestFilter = { group: RequestGroup; sub: ActiveSub };

export const ALL_REQUESTS: RequestFilter = { group: 'all', sub: 'all' };

export const GROUP_OPTIONS: readonly { value: RequestGroup; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'pickup', label: 'Pickup' }, { value: 'history', label: 'History' },
];
export const ACTIVE_OPTIONS: readonly { value: ActiveSub; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'pending_payment', label: 'Pending Payment' }, { value: 'paid', label: 'Paid' }, { value: 'processing', label: 'Processing' },
];

/** Choosing another group clears the Active sub-filter so it cannot stay narrowed unseen. */
export function withGroup(group: RequestGroup): RequestFilter {
  return { group, sub: 'all' };
}

export type FilterClause = { op: 'in' | 'not-in'; column: 'status' | 'payment_status'; values: readonly string[] };

/** `submitted` + paid or waived is shown as "Submitted (Paid)"; any other payment state is pending payment. */
const SETTLED = ['paid', 'waived'] as const;

export function filterClauses(filter: RequestFilter): FilterClause[] {
  switch (filter.group) {
    case 'all': return [];
    case 'pickup': return [{ op: 'in', column: 'status', values: ['ready_for_pickup'] }];
    case 'history': return [{ op: 'in', column: 'status', values: ['completed', 'cancelled'] }];
    case 'active':
      switch (filter.sub) {
        case 'all': return [{ op: 'in', column: 'status', values: ['submitted', 'in_progress'] }];
        case 'pending_payment': return [{ op: 'in', column: 'status', values: ['submitted'] }, { op: 'not-in', column: 'payment_status', values: SETTLED }];
        case 'paid': return [{ op: 'in', column: 'status', values: ['submitted'] }, { op: 'in', column: 'payment_status', values: SETTLED }];
        case 'processing': return [{ op: 'in', column: 'status', values: ['in_progress'] }];
      }
  }
}
