'use client';

import { CalendarCheck2, HeartPulse } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CategoryFilterPills, type DriveTypeFilter } from '@/components/health/category-filter-pills';
import { DriveCalendar, localToday } from '@/components/health/drive-calendar';
import { DriveCard } from '@/components/health/drive-card';
import { RegisterDrawer } from '@/components/health/register-drawer';
import { useMedicalDrives } from '@/hooks/use-medical-drives';

function fmtFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Plain uppercase section label — web weight (no mobile-style colored bar), matching
 * the rest of resident-web's card-grouped section conventions. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{children}</p>;
}

/**
 * Active Medical Drives segment — bare /health, per the plan's file-tree coverage check
 * ("bare /health IS Active Drives"). Calendar + category filter + selected-date drive
 * list — full parity with mobile's index.tsx layout (Calendar -> Filter Drives ->
 * Selected Date -> drive cards for that day).
 */
export function ActiveDrivesContent({ userId }: { userId: string }) {
  const today = localToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m };
  });
  const [typeFilter, setTypeFilter] = useState<DriveTypeFilter>('all');
  // Drive currently open in the right-side RegisterDrawer — drives the reflow to a
  // single-column layout below, same pattern as reports/my-reports-tabs.tsx's
  // selectedId/drawerOpen.
  const [selectedDriveId, setSelectedDriveId] = useState<string | null>(null);
  const drawerOpen = selectedDriveId !== null;

  const { drives, loadingDrives, monthEventMap, fetchMonthEventDates, registeredDriveIds, error } = useMedicalDrives({
    selectedDate,
    typeFilter,
    userId,
  });

  useEffect(() => {
    fetchMonthEventDates(currentMonth.year, currentMonth.month);
  }, [currentMonth, fetchMonthEventDates]);

  function handleMonthChange(delta: 1 | -1) {
    setCurrentMonth((prev) => {
      let { year, month } = prev;
      month += delta;
      if (month > 12) {
        month = 1;
        year += 1;
      } else if (month < 1) {
        month = 12;
        year -= 1;
      }
      return { year, month };
    });
  }

  function handleJumpTo(year: number, month: number) {
    setCurrentMonth({ year, month });
  }

  return (
    <div
      className={`flex flex-col gap-5 transition-[margin] duration-300 ${
        drawerOpen ? 'lg:mr-[calc(32rem_+_2rem)]' : ''
      }`}>
      <div>
        <h1 className="text-xl font-bold">Active Medical Drives</h1>
        <p className="text-sm text-muted-foreground">Upcoming vaccination, medical, and screening drives in your barangay.</p>
      </div>

      {/* Two columns at lg+: Calendar + Filter on the left inside one grouped card
          (narrow, fixed-ish width), Selected Date + drive cards on the right. Stays
          single-column stacked below lg — and forced back to single-column even at lg+
          once the RegisterDrawer opens, so the calendar/filter/list stay comfortably
          readable next to it instead of competing for width. */}
      <div className={`flex flex-col gap-5 lg:items-start ${drawerOpen ? '' : 'lg:flex-row'}`}>
        <div className="flex flex-col gap-4 lg:w-[340px] lg:shrink-0">
          <DriveCalendar
            selectedDate={selectedDate}
            onDateSelect={setSelectedDate}
            eventDateMap={monthEventMap}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
            onJumpTo={handleJumpTo}
          />

          <div className="flex flex-col gap-2">
            <SectionLabel>Filter Drives</SectionLabel>
            <CategoryFilterPills active={typeFilter} onSelect={setTypeFilter} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-base font-bold tracking-tight">
              <CalendarCheck2 size={17} className="text-primary" />
              {fmtFullDate(selectedDate)}
            </span>
            {selectedDate !== today ? (
              <button type="button" onClick={() => setSelectedDate(today)} className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90">
                Jump to Today
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">Today</span>
            )}
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : loadingDrives ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-xl border border-black/8 bg-muted dark:border-white/8" />
              ))}
            </div>
          ) : drives.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-black/8 bg-white px-6 py-16 text-center dark:border-white/8 dark:bg-zinc-900">
              <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                <HeartPulse size={28} className="text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">No drives on this date</p>
                <p className="text-sm text-muted-foreground">
                  {typeFilter === 'all' ? 'Pick another date on the calendar to see scheduled drives.' : 'No drives in this category on this date.'}
                </p>
              </div>
            </div>
          ) : (
            <div className={`grid grid-cols-1 gap-3 ${drawerOpen ? '' : 'sm:grid-cols-2'}`}>
              {drives.map((drive) => (
                <DriveCard
                  key={drive.id}
                  drive={drive}
                  isRegistered={registeredDriveIds.has(drive.id)}
                  onRegister={() => setSelectedDriveId(drive.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <RegisterDrawer driveId={selectedDriveId} open={drawerOpen} onClose={() => setSelectedDriveId(null)} userId={userId} />
    </div>
  );
}
