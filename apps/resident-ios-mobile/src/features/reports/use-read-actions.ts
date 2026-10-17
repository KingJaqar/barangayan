import { useEffect, useState, useSyncExternalStore } from 'react';
import { useApi } from '../../data/use-api';
import { useLatest } from '../../lib/use-latest';
import { ReadActions } from './read-state';

/**
 * Read/unread actions bound to the signed-in resident for one screen. `settled` re-reads what the
 * screen shows after each write. The controller is disposed when the screen goes away; the
 * session scope remounts the tree on an account change, so a previous account's actions never
 * outlive it.
 */
export function useReadActions(settled: () => Promise<void>) {
  const api = useApi();
  const latest = useLatest({ api, settled });
  const [actions] = useState(() => new ReadActions({
    markAnnouncementRead: (id) => latest.current.api.markAnnouncementRead(id),
    markAnnouncementUnread: (id) => latest.current.api.markAnnouncementUnread(id),
    setIncidentRead: (id, read) => latest.current.api.setIncidentRead(id, read),
    unreadAnnouncementIds: (signal) => latest.current.api.unreadAnnouncementIds(signal),
    markAnnouncementsRead: (ids) => latest.current.api.markAnnouncementsRead(ids),
    unreadResolvedIncidentIds: (signal) => latest.current.api.unreadResolvedIncidentIds(signal),
    markIncidentsRead: (ids) => latest.current.api.markIncidentsRead(ids),
  }, () => latest.current.settled()));
  useEffect(() => () => actions.dispose(), [actions]);
  const state = useSyncExternalStore(actions.subscribe, actions.getState);
  return { actions, state };
}
