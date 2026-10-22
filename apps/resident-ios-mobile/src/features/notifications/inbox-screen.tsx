import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, Text, View } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { ResourceList } from '../../components/resource-list';
import { Action, Body, Card, Destination, Notice, Screen, Segmented, Sheet, StatusBadge, SymbolIcon, Unavailable } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { formatRelativeTime } from '../../lib/format';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { InboxActions } from './inbox-actions';
import { useInboxCount } from './inbox-count';
import { destinationHref, inboxEntry, kindPresentation, openLabel, type InboxEntry } from './model';

type Filter = 'all' | 'unread';
const FILTERS = [{ value: 'all', label: 'All' }, { value: 'unread', label: 'Unread' }] as const;

const TAP_NOTICES: Record<string, string> = {
  malformed: 'That notification could not be opened because it was not in a form this app trusts. It is not shown here.',
  unavailable: 'That notification is no longer available for this account. It may have expired or been meant for a different account.',
  unreachable: 'That notification could not be opened because the server could not be reached. Check your connection; your inbox shows what is stored.',
};

/** The resident's notification inbox (A44, T04): newest first, All or Unread, individual and bulk read controls. */
export function InboxScreen() {
  if (!releaseGates.remotePush) return <Screen><Unavailable service="Notifications" /></Screen>;
  return <RequireResident purpose="see your notifications"><Inbox /></RequireResident>;
}

function Inbox() {
  const { notice } = useLocalSearchParams<{ notice?: string }>();
  const api = useApi();
  const router = useRouter();
  const { session } = useResident();
  const userId = session?.user.id;
  const unread = useInboxCount();
  const [filter, setFilter] = useState<Filter>('all');
  const [opened, setOpened] = useState<InboxEntry | null>(null);
  const resource = usePagedResource(`inbox:${userId ?? 'none'}:${filter}`, api.inbox(filter === 'unread'), userId ? [{ table: 'notification_inbox', filter: `recipient_id=eq.${userId}` }] : []);
  const latest = useLatest({ api, reload: resource.reload, refreshCount: unread.refresh });
  const [actions] = useState(() => new InboxActions({
    setInboxRead: (id, read) => latest.current.api.setInboxRead(id, read),
    unreadInboxIds: (signal) => latest.current.api.unreadInboxIds(signal),
    markInboxRead: (ids) => latest.current.api.markInboxRead(ids),
  }, async () => { await latest.current.reload(); latest.current.refreshCount(); }));
  useEffect(() => () => actions.dispose(), [actions]);
  const state = useSyncExternalStore(actions.subscribe, actions.getState);
  const tapNotice = notice ? TAP_NOTICES[notice] : undefined;
  const entries = new Map(resource.state.items.map((item) => [item.id, inboxEntry(item)]));
  const effective = (entry: InboxEntry): InboxEntry => (entry.id in state.overrides ? { ...entry, read: state.overrides[entry.id] } : entry);
  // The open sheet keeps the last confirmed copy when a refresh drops the row (for example from the Unread filter).
  const current = opened ? effective(entries.get(opened.id) ?? opened) : null;

  function open(entry: InboxEntry) {
    setOpened(entry);
    if (!entry.read) void actions.setRead(entry.id, true, false);
  }
  const unreadText = unread.count === null ? null : unread.count === 0 ? 'No unread notifications' : unread.count === 1 ? '1 unread notification' : `${unread.count} unread notifications`;

  return <>
    <ResourceList resource={resource} filtered={filter === 'unread'}
      empty={{ title: 'No notifications yet', message: 'When your barangay updates a request, report, announcement or registration, it is recorded here, even if phone alerts are off.' }}
      noResults={{ title: 'Nothing unread', message: 'You have read everything. Choose All to see earlier notifications.' }}
      header={<>
        {!!tapNotice && <Notice message={tapNotice} tone="danger" />}
        <Segmented<Filter> label="Notification filter" options={FILTERS} selected={filter} onChange={setFilter} />
        {unreadText && <Body role="subheadline" tone="secondary">{unreadText}</Body>}
        {unread.failed && <Body role="footnote" tone="danger">The unread count could not be refreshed and may be out of date.</Body>}
        <Action label={state.busy ? 'Working…' : 'Mark all as read'} secondary disabled={state.busy || unread.count === 0} hint="Marks the notifications that are unread now as read" onPress={() => void actions.markAllRead()} />
        {!!state.message && <Notice message={state.message} tone={state.failed ? 'danger' : 'primary'} />}
        <Destination title="Notification settings" detail="Choose which alerts reach this iPhone" href="/settings/notifications" />
      </>}
      render={(item) => <InboxRow entry={effective(inboxEntry(item))} onOpen={open} />} />
    <Sheet visible={current !== null} title="Notification" onClose={() => setOpened(null)}>
      {current && <Detail entry={current} busy={state.busy}
        onOpenDestination={() => { const target = current.destination; setOpened(null); if (target) router.push(destinationHref(target)); }}
        onToggleRead={() => void actions.setRead(current.id, !current.read)} message={state.message} failed={state.failed} />}
    </Sheet>
  </>;
}

function InboxRow({ entry, onOpen }: { entry: InboxEntry; onOpen: (entry: InboxEntry) => void }) {
  const colors = useColors();
  const type = useType();
  const kind = kindPresentation(entry.kind);
  const when = formatRelativeTime(entry.createdAt);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${entry.read ? 'Read' : 'Unread'}. ${entry.title}. ${entry.body}. ${kind.label}. ${when}.`} accessibilityHint="Opens the notification"
    onPress={() => onOpen(entry)}
    style={({ pressed }) => ({ minHeight: layout.listRowMin, gap: space[2], padding: space[4], backgroundColor: colors.surface, borderColor: entry.read ? colors.border : colors.primary, borderWidth: entry.read ? 1 : 2, borderRadius: radius.md, borderCurve: 'continuous', opacity: pressed ? 0.7 : 1 })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <SymbolIcon name={kind.icon} color={entry.read ? colors.textTertiary : colors.primary} size={20} />
      <View style={{ flex: 1, gap: space[1] }}>
        <Text style={[type.headline, { color: colors.textPrimary, fontWeight: entry.read ? '400' : '700' }]}>{entry.title}</Text>
        <Text style={[type.subheadline, { color: colors.textSecondary }]}>{entry.body}</Text>
        <Text style={[type.caption, { color: colors.textTertiary }]}>{kind.label} · {when}</Text>
      </View>
      {!entry.read && <StatusBadge label="Unread" icon="circle.fill" tone="info" />}
    </View>
  </Pressable>;
}

function Detail({ entry, busy, onOpenDestination, onToggleRead, message, failed }: { entry: InboxEntry; busy: boolean; onOpenDestination: () => void; onToggleRead: () => void; message: string; failed: boolean }) {
  const kind = kindPresentation(entry.kind);
  return <View style={{ gap: space[4] }}>
    <Card>
      <Body role="footnote" tone="secondary">{kind.label} · {formatRelativeTime(entry.createdAt)}</Body>
      <Body heading role="headline">{entry.title}</Body>
      <Body>{entry.body}</Body>
      <StatusBadge label={entry.read ? 'Read' : 'Unread'} icon={entry.read ? 'checkmark.circle' : 'circle.fill'} tone={entry.read ? 'neutral' : 'info'} />
    </Card>
    {entry.destination
      ? <Action label={openLabel(entry.destination)} onPress={onOpenDestination} />
      : <Body tone="secondary">This notification has nothing to open in this version of the app.</Body>}
    <Action label={entry.read ? 'Mark as unread' : 'Mark as read'} secondary disabled={busy} onPress={onToggleRead} />
    {!!message && <Notice message={message} tone={failed ? 'danger' : 'primary'} />}
    <Body role="footnote" tone="secondary">Notifications are short summaries. Open the linked item for the full, current details. Reading a notification here does not mark an announcement or a resolved report as read.</Body>
  </View>;
}
