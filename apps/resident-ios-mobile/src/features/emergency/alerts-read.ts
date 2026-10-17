import { matchesCustom, toDateWindow, type AlertQuery } from './alert-filters';
import type { AnnouncementItem, DateWindow } from '../../data/resident-api';
import { readAll, type PageRead } from '../../data/pagination';

type AnnouncementReader = (category: 'emergency', window?: DateWindow) => PageRead<AnnouncementItem>;
type AnnouncementCounter = (category: 'emergency', window: DateWindow | undefined, signal: AbortSignal) => Promise<number>;

/**
 * The page reader of one alert query. Publication windows are filtered by the server, so pages are
 * incremental. A month or day without a year recurs across years: the query reads the emergency
 * alerts once (newest first, bounded) and serves matching rows from that snapshot; reloading from the
 * first page takes a new snapshot so deleted or new alerts reconcile.
 */
export function alertsRead(announcements: AnnouncementReader, query: AlertQuery): PageRead<AnnouncementItem> {
  if (query.empty) return async () => [];
  const page = announcements('emergency', toDateWindow(query));
  const { match } = query;
  if (!match) return page;
  let snapshot: AnnouncementItem[] | null = null;
  return async (range, signal) => {
    if (range.from === 0 || snapshot === null) snapshot = (await readAll(page, signal)).filter((item) => matchesCustom(item.published_at, match));
    return snapshot.slice(range.from, range.to + 1);
  };
}

export type AlertCounts = { total: number; /** Null when only the loaded rows can say (device-matched filters). */ matching: number | null };

/** Exact counts for the "Showing X of Y alerts" line; both come from the server so they hold beyond the loaded pages. */
export async function alertCounts(count: AnnouncementCounter, query: AlertQuery, signal: AbortSignal): Promise<AlertCounts> {
  const [total, matching] = await Promise.all([
    count('emergency', undefined, signal),
    query.empty ? 0 : query.match ? null : count('emergency', toDateWindow(query), signal),
  ]);
  return { total, matching };
}
