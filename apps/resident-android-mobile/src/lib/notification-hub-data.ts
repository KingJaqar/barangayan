import type { NotificationInboxPageRow, SystemNoticeRow, Tables } from '@barangayan/shared';
import { HISTORY_PAGE_SIZE, historyBefore, type HistoryPage } from '@/lib/history-resource';
import { toHubSummary, type HubSource, type HubSummary, type HubView } from '@/lib/notification-hub';
import { supabase } from '@/lib/supabase';

export type Announcement = Tables<'announcements'>;
export type InboxItem = NotificationInboxPageRow;
export type SystemNotice = SystemNoticeRow;

/** Requested range width; the server may return fewer rows per response. */
const ID_RANGE = 1000;
const NOTICE_COLUMNS = 'id, subtype, title, body, state, starts_at, ends_at, expires_at, action, policy_key, policy_effective_on, app_version_code, revision, published_at, resolved_at, cancelled_at, updated_at';

/** Category totals and the selected scope's counts. Guests never call it (D21). */
export async function loadHubSummary(signal: AbortSignal, view: HubView, chip: string): Promise<HubSummary> {
  const { data, error } = await supabase.rpc('notification_hub_summary', { p_view: view, p_filter: chip }).abortSignal(signal);
  if (error) throw error;
  return toHubSummary(data ?? []);
}

/** Announcements, newest first by the immutable (published_at, id) keyset; RLS decides which are visible. */
export async function loadAnnouncementPage(signal: AbortSignal, category: string | null, after: Announcement | undefined, count: boolean): Promise<HistoryPage<Announcement>> {
  let query = supabase.from('announcements').select('*', count ? { count: 'exact' } : undefined)
    .is('deleted_at', null)
    .order('published_at', { ascending: false }).order('id', { ascending: false })
    .limit(HISTORY_PAGE_SIZE).abortSignal(signal);
  if (category) query = query.eq('category', category);
  if (after) query = query.or(historyBefore('published_at', after.published_at, after.id));
  const { data, error, count: total } = await query;
  if (error) throw error;
  return { rows: data ?? [], total };
}

/** One keyset page of the resident's own Account or System rows. The first page also returns the scope's full count. */
export async function loadInboxPage(signal: AbortSignal, source: Exclude<HubSource, 'barangay'>, view: HubView, chip: string, after: InboxItem | undefined, count: boolean): Promise<HistoryPage<InboxItem>> {
  const [page, summary] = await Promise.all([
    supabase.rpc('notification_inbox_page', {
      p_source: source, p_view: view, p_filter: chip, p_before_created_at: after?.created_at, p_before_id: after?.id, p_limit: HISTORY_PAGE_SIZE,
    }).abortSignal(signal),
    // A failed count must not hide rows that did load.
    count ? loadHubSummary(signal, view, chip).catch(() => null) : null,
  ]);
  if (page.error) throw page.error;
  const rows = page.data ?? [];
  return { rows, total: summary ? (summary[source].scopeTotal ?? rows.length) : null };
}

/** Reads every row of a list that one PostgREST response may truncate (max-rows, 1,000 by default): ranges over a stable order until the exact count is reached. */
async function readAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; count: number | null; error: unknown }>): Promise<T[]> {
  const all: T[] = [];
  for (;;) {
    const { data, count, error } = await page(all.length, all.length + ID_RANGE - 1);
    if (error) throw error;
    all.push(...(data ?? []));
    if (!data?.length || all.length >= (count ?? Infinity)) return all;
  }
}

/** Ids of the visible announcements this resident has not read. Not capped at one response, so rows beyond the first 1,000 keep their unread marker. */
export async function loadUnreadAnnouncementIds(ownerId: string): Promise<string[]> {
  const [announcements, reads] = await Promise.all([
    readAllRows((from, to) => supabase.from('announcements').select('id', { count: 'exact' }).is('deleted_at', null).order('id').range(from, to)),
    readAllRows((from, to) => supabase.from('announcement_reads').select('announcement_id', { count: 'exact' }).eq('resident_id', ownerId).order('announcement_id').range(from, to)),
  ]);
  const readIds = new Set(reads.map((read) => read.announcement_id));
  return announcements.map((row) => row.id).filter((id) => !readIds.has(id));
}

export async function fetchAnnouncement(signal: AbortSignal, id: string): Promise<Announcement | null> {
  const { data, error } = await supabase.from('announcements').select('*').eq('id', id).is('deleted_at', null).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return data;
}

/** The owner's own inbox row by id; another resident's id returns nothing. */
export async function fetchInboxItem(signal: AbortSignal, id: string, ownerId: string): Promise<InboxItem | null> {
  const { data, error } = await supabase.from('notification_inbox')
    .select('id, kind, title, body, destination, created_at, read_at').eq('id', id).eq('recipient_id', ownerId).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return data ? { ...data, filter: null } : null;
}

export async function fetchSystemNotice(signal: AbortSignal, id: string): Promise<SystemNotice | null> {
  const { data, error } = await supabase.from('system_notices').select(NOTICE_COLUMNS).eq('id', id).abortSignal(signal).maybeSingle();
  if (error) throw error;
  return data;
}

/** Changes only the read marker of the owner's own row (column grant of migration 0135). */
export async function setInboxRead(id: string, ownerId: string, read: boolean): Promise<void> {
  const { error } = await supabase.from('notification_inbox').update({ read_at: read ? new Date().toISOString() : null }).eq('id', id).eq('recipient_id', ownerId);
  if (error) throw new Error('Read status could not be saved.');
}

/** One server snapshot of the whole scope, applied atomically; returns what was actually marked. */
export async function markScopeRead(view: HubView, chip: string): Promise<{ announcements: number; notifications: number }> {
  const { data, error } = await supabase.rpc('notification_mark_scope_read', { p_view: view, p_filter: chip });
  const row = data?.[0];
  if (error || !row) throw new Error('Read status could not be saved.');
  return { announcements: row.announcements_marked, notifications: row.notifications_marked };
}
