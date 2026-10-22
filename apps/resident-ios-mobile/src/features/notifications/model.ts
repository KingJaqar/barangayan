import type { IconName } from '@expo/ui';
import type { Href } from 'expo-router';
import { z } from 'zod';
import type { InboxItem } from '../../data/resident-api';

/**
 * The notification kinds the server creates (migration 0135) with the resident-facing wording of their phone-alert switch.
 * A kind this version does not know still shows in the inbox, as a plain entry.
 */
export const NOTIFICATION_KINDS = [
  { kind: 'request_status', label: 'Document request updates', detail: 'When staff start, finish or cancel one of your requests.', icon: 'doc.text' },
  { kind: 'payment', label: 'Payment updates', detail: 'When a payment is received or no payment is due.', icon: 'creditcard' },
  { kind: 'incident_status', label: 'Report updates', detail: 'When the status of a report you filed changes.', icon: 'megaphone' },
  { kind: 'announcement', label: 'Announcements', detail: 'When your barangay posts a new announcement.', icon: 'bell' },
  { kind: 'medical_drive', label: 'New medical drives', detail: 'When a new medical drive opens in your barangay.', icon: 'heart' },
  { kind: 'health_registration', label: 'Registration updates', detail: 'When the status of a drive registration changes.', icon: 'cross.case' },
] as const satisfies readonly { kind: string; label: string; detail: string; icon: IconName }[];
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]['kind'];

const FALLBACK_KIND = { label: 'Notification', icon: 'bell' } as const satisfies { label: string; icon: IconName };
export function kindPresentation(kind: string): { label: string; icon: IconName } {
  const found = NOTIFICATION_KINDS.find((entry) => entry.kind === kind);
  return found ? { label: found.label, icon: found.icon } : FALLBACK_KIND;
}

/** A switch is on unless the resident turned it off. */
export function kindEnabled(kinds: Readonly<Record<string, boolean>>, kind: NotificationKind): boolean {
  return kinds[kind] !== false;
}

const destinationSchema = z.object({
  v: z.literal(1),
  kind: z.enum(['request', 'incident', 'announcement', 'drive', 'registration']),
  id: z.string().uuid(),
}).strict();
/** A versioned reference to a record. It never holds a URL, a path or a snapshot of the record. */
export type Destination = z.infer<typeof destinationSchema>;

/** Null for anything that is not exactly `{ v: 1, kind, id }` with an allowlisted kind and a UUID. */
export function parseDestination(input: unknown): Destination | null {
  const parsed = destinationSchema.safeParse(input);
  return parsed.success ? parsed.data : null;
}

/** The screen a destination opens. The screen itself re-reads the record, so authorization is never decided here. */
export function destinationHref(destination: Destination): Href {
  switch (destination.kind) {
    case 'request': return { pathname: '/request/[id]', params: { id: destination.id } };
    case 'incident': return { pathname: '/reports/incidents/[incidentId]', params: { incidentId: destination.id } };
    case 'announcement': return { pathname: '/reports/announcements/[announcementId]', params: { announcementId: destination.id } };
    case 'drive': return { pathname: '/health/[id]', params: { id: destination.id } };
    case 'registration': return { pathname: '/health', params: { segment: 'registrations' } };
  }
}

const OPEN_LABELS: Record<Destination['kind'], string> = {
  request: 'Open request', incident: 'Open report', announcement: 'Open announcement', drive: 'Open medical drive', registration: 'Open my registrations',
};
export const openLabel = (destination: Destination): string => OPEN_LABELS[destination.kind];

/** What an inbox row needs to render; `destination` is null when this version cannot open it. */
export type InboxEntry = { id: string; kind: string; title: string; body: string; destination: Destination | null; createdAt: string; read: boolean };
export function inboxEntry(item: InboxItem): InboxEntry {
  return { id: item.id, kind: item.kind, title: item.title, body: item.body, destination: parseDestination(item.destination), createdAt: item.created_at, read: item.read_at !== null };
}

const pushDataSchema = z.object({ v: z.literal(1), kind: destinationSchema.shape.kind, id: z.string().uuid(), inbox: z.string().uuid() });
/** The payload the sender attaches to a push: the destination reference and the inbox row it belongs to. Nothing else is trusted. */
export function parsePushData(input: unknown): { destination: Destination; inboxId: string } | null {
  const parsed = pushDataSchema.safeParse(input);
  return parsed.success ? { destination: { v: 1, kind: parsed.data.kind, id: parsed.data.id }, inboxId: parsed.data.inbox } : null;
}

/** The detail line of an inbox entry point: its own unread count, never mixed with the Reports signals. */
export function inboxDetail(count: number | null): string {
  if (count === null) return 'Updates from your barangay';
  if (count === 0) return 'No unread notifications';
  return count === 1 ? '1 unread notification' : `${count} unread notifications`;
}
