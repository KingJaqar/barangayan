import { formatDate } from '@barangayan/shared';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ResourceList } from '../../components/resource-list';
import { Body, Card, Sheet, StatusBadge, SymbolIcon } from '../../components/ui';
import type { RegistrationItem } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { useResident } from '../../lib/runtime';
import { CategoryLabel } from './drive-card';
import { categoryOf, formatDriveDate, formatTimeRange } from './drive-model';
import { FilterChips } from './filter-chips';
import { countByStatus, FILTER_LABEL, FILTER_ORDER, STATUS_PRESENTATION, timelineFor, type RegistrationFilter } from './registration-model';
import { useRefreshOnFocus, useRegistrationSummary } from './use-health-data';

const NO_DRIVE_TITLE = 'Medical drive no longer listed';

/**
 * The signed-in resident's own registrations (A31): status filter with counts, newest first, opening a detail sheet. There is
 * no cancel action: the app has no resident cancellation contract. Staff changes arrive through realtime and foreground reloads.
 */
export function MyRegistrations({ header }: { header: ReactNode }) {
  const api = useApi();
  const { session } = useResident();
  const userId = session?.user.id;
  const [filter, setFilter] = useState<RegistrationFilter>('all');
  const [opened, setOpened] = useState<RegistrationItem | null>(null);
  const summary = useRegistrationSummary();
  const counts = useMemo(() => countByStatus(summary.data ?? []), [summary.data]);
  const resource = usePagedResource(`registrations:${userId ?? 'none'}:${filter}`, api.myRegistrations(filter), userId ? [{ table: 'drive_registrations', filter: `user_id=eq.${userId}` }] : []);
  useRefreshOnFocus(resource.reload);
  // A staff change can move the open registration out of the current filter; the sheet keeps the last confirmed copy until closed.
  const current = opened ? resource.state.items.find((item) => item.id === opened.id) ?? opened : null;
  const options = FILTER_ORDER.map((value) => ({ value, label: FILTER_LABEL[value], ...(summary.data ? { detail: String(counts[value]) } : {}) }));
  return <>
    <ResourceList resource={resource} filtered={filter !== 'all'}
      empty={{ title: 'No registrations yet', message: 'You have not registered for a medical drive. Open the Drives view to find one.' }}
      noResults={{ title: `No ${FILTER_LABEL[filter].toLowerCase()} registrations`, message: 'Choose another status to see your other registrations.' }}
      header={<>
        {header}
        {summary.data && <Body role="subheadline" tone="secondary">{counts.all === 1 ? '1 registration' : `${counts.all} registrations`}</Body>}
        <FilterChips<RegistrationFilter> label="Registration status" options={options} selected={filter} onChange={setFilter} />
      </>}
      render={(item) => <RegistrationCard item={item} onOpen={() => setOpened(item)} />} />
    <Sheet visible={current !== null} title="Registration details" onClose={() => setOpened(null)}>
      {current && <RegistrationDetail item={current} />}
    </Sheet>
  </>;
}

function RegistrationCard({ item, onOpen }: { item: RegistrationItem; onOpen: () => void }) {
  const colors = useColors();
  const type = useType();
  const status = STATUS_PRESENTATION[item.status];
  const title = item.drive?.title ?? NO_DRIVE_TITLE;
  const when = item.drive ? `${formatDriveDate(item.drive.drive_date)}, ${formatTimeRange(item.drive)}` : 'Schedule unavailable';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. Applicant number ${item.applicant_number}. Status: ${status.label}. ${when}.`} accessibilityHint="Opens the registration details" onPress={onOpen}
    style={({ pressed }) => ({ minHeight: layout.listRowMin, gap: space[2], padding: space[4], backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, borderCurve: 'continuous', opacity: pressed ? 0.7 : 1 })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ flex: 1, gap: space[1] }}>
        {item.drive && <CategoryLabel typeName={item.drive.type} />}
        <Text style={[type.headline, { color: colors.textPrimary }]}>{title}</Text>
      </View>
      <SymbolIcon name="chevron.right" color={colors.textTertiary} size={14} />
    </View>
    <Text style={[type.monoReference, { color: colors.textPrimary }]}>{item.applicant_number}</Text>
    <Text style={[type.subheadline, { color: colors.textSecondary }]}>{when}</Text>
    <StatusBadge label={status.label} icon={status.icon} tone={status.tone} />
  </Pressable>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2 }}><Body role="footnote" tone="secondary">{label}</Body><Body>{value}</Body></View>;
}

function RegistrationDetail({ item }: { item: RegistrationItem }) {
  const colors = useColors();
  const type = useType();
  const status = STATUS_PRESENTATION[item.status];
  const drive = item.drive;
  return <View style={{ gap: space[4] }}>
    <Card>
      <Body heading role="headline">Your registration</Body>
      <View accessible accessibilityLabel={`Applicant number: ${item.applicant_number}`} style={{ gap: 2 }}><Body role="footnote" tone="secondary">Applicant number</Body><Text selectable style={[type.monoReference, { color: colors.textPrimary }]}>{item.applicant_number}</Text></View>
      <StatusBadge label={status.label} icon={status.icon} tone={status.tone} />
      <Body tone="secondary">{status.meaning}</Body>
      <Row label="Registered on" value={formatDate(item.created_at)} />
      {item.updated_at !== item.created_at && <Row label="Last updated" value={formatDate(item.updated_at)} />}
    </Card>
    <Card>
      <Body heading role="headline">Medical drive</Body>
      {drive ? <>
        <Body>{drive.title}</Body>
        <Row label="Category" value={categoryOf(drive.type).label} />
        <Row label="Date" value={formatDriveDate(drive.drive_date)} />
        <Row label="Time" value={formatTimeRange(drive)} />
        <Row label="Location" value={drive.location} />
        {!!drive.eligible_criteria && <Row label="Who can join" value={drive.eligible_criteria} />}
      </> : <Body tone="secondary">This drive is no longer listed, so its schedule is not available. Contact your barangay office about this registration.</Body>}
    </Card>
    <Card>
      <Body heading role="headline">Status timeline</Body>
      {timelineFor(item.status).map((step, index, steps) => {
        const presentation = STATUS_PRESENTATION[step.status];
        const tone = step.state === 'upcoming' ? colors.textTertiary : step.state === 'current' ? colors.primary : colors.success;
        return <View key={step.status} accessible accessibilityLabel={`${presentation.label}: ${step.state === 'current' ? 'current step' : step.state === 'done' ? 'completed' : 'not reached'}`}
          style={{ flexDirection: 'row', gap: space[3], minHeight: layout.controlMin }}>
          <View style={{ alignItems: 'center', width: 24 }}>
            <SymbolIcon name={step.state === 'upcoming' ? 'circle' : step.state === 'current' ? presentation.icon : 'checkmark.circle'} color={tone} size={20} />
            {index < steps.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: colors.border, marginTop: space[1] }} />}
          </View>
          <View style={{ flex: 1, paddingBottom: space[3], gap: 2 }}>
            <Text style={[type.headline, { color: step.state === 'upcoming' ? colors.textTertiary : colors.textPrimary }]}>{presentation.label}{step.state === 'current' ? ' (current)' : ''}</Text>
            {step.state === 'current' && <Text style={[type.subheadline, { color: colors.textSecondary }]}>{presentation.meaning}</Text>}
          </View>
        </View>;
      })}
    </Card>
  </View>;
}
