import type { HouseholdWriteFailure } from '@/hooks/use-family-members';
import { notify, type OperationId } from '@/lib/notify';

export type HouseholdAction = 'add' | 'update' | 'remove';

const PAST: Record<HouseholdAction, string> = {
  add: 'Family member added.',
  update: 'Family member updated.',
  remove: 'Family member removed.',
};

const VERB: Record<HouseholdAction, string> = { add: 'add', update: 'update', remove: 'remove' };

/**
 * The single terminal notification for one household write, owned by the screen that
 * awaited it (Emergency > Family and Settings > Profile share the wording). `ok` is the
 * existing write's own result — a resolved promise alone is never success. A rejected
 * write says nothing changed; an unconfirmed one (no answer arrived) says it may have
 * been applied and tells the resident to check the list before repeating it.
 */
export function notifyHouseholdOutcome(action: HouseholdAction, ok: boolean, failure: HouseholdWriteFailure | null, id: OperationId) {
  if (ok) {
    notify.success(PAST[action], { id });
  } else if (failure === 'unconfirmed') {
    notify.warning("We couldn't confirm the change.", {
      id,
      description: 'Your household list may or may not have been updated. Check the list before trying again.',
    });
  } else if (failure === 'busy') {
    notify.warning('Another change is still saving.', { id, description: 'Wait a moment, then try again.' });
  } else if (failure === 'conflict') {
    notify.warning('The family list changed.', { id, description: 'Your draft is kept. Review the refreshed list before saving again.' });
  } else if (failure === 'active') {
    notify.error('This person is still checked in.', { id, description: 'Ask staff to check them out before removing them.' });
  } else if (failure === 'session') {
    notify.error('Your account or session changed.', { id, description: 'Sign in again before editing your family list.' });
  } else if (failure === 'invalid') {
    notify.error('The family list is not ready to save.', { id, description: 'Refresh the list and check the details. Up to 30 additional members are allowed.' });
  } else {
    notify.error(`Couldn't ${VERB[action]} family member.`, { id, description: 'Nothing was changed. Please try again.' });
  }
}
