import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { Action, Body, Card, Destination, EmptyState, Notice, ResourceState, Screen, SearchField, Segmented } from '../../components/ui';
import { ResourceList } from '../../components/resource-list';
import { useApi } from '../../data/use-api';
import { useDebouncedValue, usePagedResource } from '../../data/use-paged-resource';
import { useResident } from '../../lib/runtime';
import { DriveCalendar, MonthPickerSheet } from './drive-calendar';
import { DriveCard } from './drive-card';
import {
  CATEGORY_OPTIONS, dotsByDate, drivesOnDate, filterByCategory, formatDriveDate, formatMonth, manilaToday, monthOf, shiftMonth, type CategoryFilter, type MonthRef,
} from './drive-model';
import { FilterChips } from './filter-chips';
import { MyRegistrations } from './my-registrations';
import { statusByDrive } from './registration-model';
import { useDriveMonth, useRefreshOnFocus, useRegistrationSummary } from './use-health-data';

type HealthView = 'drives' | 'registrations';
type DriveMode = 'calendar' | 'list';

const VIEW_OPTIONS = [{ value: 'drives', label: 'Drives' }, { value: 'registrations', label: 'My registrations' }] as const;
const MODE_OPTIONS = [{ value: 'calendar', label: 'Calendar' }, { value: 'list', label: 'List' }] as const;

/**
 * Health (A29, A31): medical drives as a calendar or a list, and the signed-in resident's own registrations. The route's `segment`
 * parameter selects the view and is written back, so links and a return to the tab agree. A guest browses drives only.
 */
export function HealthScreen() {
  const { session } = useResident();
  const params = useLocalSearchParams();
  const router = useRouter();
  const signedIn = session !== null;
  const view: HealthView = signedIn && params.segment === 'registrations' ? 'registrations' : 'drives';
  const header = signedIn
    ? <Segmented<HealthView> label="Health view" options={VIEW_OPTIONS} selected={view} onChange={(next) => router.setParams({ segment: next })} />
    : <Card><Body role="subheadline" tone="secondary">You can browse medical drives without an account. Log in to register for a drive and to see your registrations.</Body><Destination title="Log in or create an account" href="/auth/choice" /></Card>;
  return view === 'registrations' ? <MyRegistrations key={view} header={header} /> : <DrivesView key={view} header={header} />;
}

function DrivesView({ header }: { header: ReactNode }) {
  const [mode, setMode] = useState<DriveMode>('calendar');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const today = manilaToday();
  const registrations = useRegistrationSummary();
  const registered = useMemo(() => statusByDrive(registrations.data ?? []), [registrations.data]);
  const controls = <>
    {header}
    <Segmented<DriveMode> label="Drive display" options={MODE_OPTIONS} selected={mode} onChange={setMode} />
    <FilterChips<CategoryFilter> label="Drive category" options={CATEGORY_OPTIONS} selected={category} onChange={setCategory} />
  </>;
  return mode === 'calendar'
    ? <CalendarMode controls={controls} category={category} today={today} registered={registered} />
    : <ListMode controls={controls} category={category} today={today} registered={registered} />;
}

type ModeProps = { controls: ReactNode; category: CategoryFilter; today: string; registered: ReturnType<typeof statusByDrive> };

function CalendarMode({ controls, category, today, registered }: ModeProps) {
  const [month, setMonth] = useState<MonthRef>(() => monthOf(today));
  const [selected, setSelected] = useState<string | null>(today);
  const [picking, setPicking] = useState(false);
  const resource = useDriveMonth(month);
  const filtered = useMemo(() => filterByCategory(resource.data ?? [], category), [resource.data, category]);
  const dots = useMemo(() => dotsByDate(filtered), [filtered]);
  const counts = useMemo(() => filtered.reduce<Record<string, number>>((byDate, drive) => ({ ...byDate, [drive.drive_date]: (byDate[drive.drive_date] ?? 0) + 1 }), {}), [filtered]);
  const shown = selected ? drivesOnDate(filtered, selected) : filtered;
  const move = (next: MonthRef) => {
    setMonth(next);
    setSelected((current) => (current && monthOf(current).year === next.year && monthOf(current).month === next.month ? current : null));
  };
  const scope = selected ? formatDriveDate(selected) : formatMonth(month);
  const categoryName = CATEGORY_OPTIONS.find((option) => option.value === category)?.label.toLowerCase() ?? 'drives';
  return <Screen>
    {controls}
    <DriveCalendar month={month} today={today} selected={selected} dots={dots} counts={counts} onShift={(delta) => move(shiftMonth(month, delta))} onSelect={setSelected} onOpenPicker={() => setPicking(true)} />
    <MonthPickerSheet visible={picking} month={month} onApply={move} onClose={() => setPicking(false)} />
    <Body heading role="headline">{selected ? `Drives on ${scope}` : `All drives in ${scope}`}</Body>
    {selected ? <Action label={`Show all drives in ${formatMonth(month)}`} secondary onPress={() => setSelected(null)} />
      : <Body role="footnote" tone="secondary">Choose a day to see only the drives scheduled on it.</Body>}
    <ResourceState loading={resource.loading && !resource.data} error={resource.data ? undefined : resource.error} retry={() => void resource.refresh()} skeleton />
    {resource.error && resource.data && <Notice tone="danger" message={`Showing the last loaded drives; they could not be refreshed. ${resource.error}`} />}
    {resource.data && shown.length === 0 && <EmptyState title={category === 'all' ? 'No medical drives' : 'No matching drives'}
      message={category === 'all' ? `Your barangay has no active medical drives ${selected ? 'on this day' : 'this month'}.` : `There are no ${categoryName} drives ${selected ? 'on this day' : 'this month'}. Choose another category or date.`} />}
    {shown.map((drive) => <DriveCard key={drive.id} drive={drive} today={today} registration={registered.get(drive.id) ?? null} />)}
  </Screen>;
}

function ListMode({ controls, category, today, registered }: ModeProps) {
  const api = useApi();
  const { config } = useResident();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim());
  const resource = usePagedResource(`drives:${term}:${category}:${today}`, api.drives(term, { type: category, from: today }), [{ table: 'medical_drives', filter: `barangay_id=eq.${config.barangayId}` }]);
  useRefreshOnFocus(resource.reload);
  return <ResourceList resource={resource} filtered={!!term || category !== 'all'}
    empty={{ title: 'No upcoming medical drives', message: 'Your barangay has no upcoming medical drives right now. Past drives are in the calendar.' }}
    noResults={{ title: 'No matching drives', message: 'Try another title, category, location or date (YYYY-MM-DD), or clear the category.' }}
    header={<>
      {controls}
      <SearchField label="Search drives" hint="Search by title, category, place or date" value={search} onChangeText={setSearch} />
      <Body role="footnote" tone="secondary">Upcoming drives, soonest first.</Body>
    </>}
    render={(drive) => <DriveCard drive={drive} today={today} registration={registered.get(drive.id) ?? null} />} />;
}
