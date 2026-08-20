'use client';

import { CalendarCheck2, HeartPulse } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CategoryFilterPills, type DriveTypeFilter } from '@/components/health/category-filter-pills';
import { DriveCalendar, localToday } from '@/components/health/drive-calendar';
import { DriveCard } from '@/components/health/drive-card';
import { useMedicalDrives } from '@/hooks/use-medical-drives';

function fmtFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Small green-accented section label, matching mobile's "CALENDAR" / "FILTER DRIVES" /
 * "SELECTED DATE" section headers on the Active Drives screen. */
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="border-l-4 border-primary pl-2 text-xs font-bold uppercase tracking-wide text-primary">{children}</p>;
}

/**
 * Active Medical Drives segment — bare /health, per the plan's file-tree coverage check
 * ("bare /health IS Active Drives"). Calendar + category filter + selected-date drive
 * list — full parity with mobile's index.tsx layout (Calendar -> Filter Drives ->
 * Selected Date -> drive cards for that day).
 */
export function ActiveDrivesContent({ userId }: { userId: string }) {
  const router = useRouter();
  const today = localToday();
  const [selectedDate, setSelectedDate] = useState(today);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m };
  });
  const [typeFilter, setTypeFilter] = useState<DriveTypeFilter>('all');

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
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Active Medical Drives</h1>
        <p className="text-sm text-muted-foreground">Upcoming vaccination, medical, and screening drives in your barangay.</p>
      </div>

      {/* Two columns at lg+: Calendar + Filter on the left (narrow, fixed-ish width),
          Selected Date + drive cards on the right. Stays single-column stacked below
          lg, unchanged from before. */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="flex flex-col gap-5 lg:w-[380px] lg:shrink-0">
          <div className="flex flex-col gap-2.5">
            <SectionLabel>Calendar</SectionLabel>
            <DriveCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              eventDateMap={monthEventMap}
              currentMonth={currentMonth}
              onMonthChange={handleMonthChange}
              onJumpTo={handleJumpTo}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <SectionLabel>Filter Drives</SectionLabel>
            <CategoryFilterPills active={typeFilter} onSelect={setTypeFilter} />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <SectionLabel>Selected Date</SectionLabel>
          <div className="flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-primary bg-primary/5 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-bold">
              <CalendarCheck2 size={17} className="text-primary" />
              {fmtFullDate(selectedDate)}
            </span>
            {selectedDate !== today ? (
              <button type="button" onClick={() => setSelectedDate(today)} className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">
                Today
              </button>
            ) : (
              <span className="shrink-0 rounded-full bg-primary/15 px-3 py-1.5 text-xs font-bold text-primary">Today</span>
            )}
          </div>

          {error ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : loadingDrives ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : drives.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
              <HeartPulse size={28} className="text-muted-foreground" />
              <p className="text-sm font-semibold">No drives on this date</p>
              <p className="text-sm text-muted-foreground">
                {typeFilter === 'all' ? 'Pick another date on the calendar to see scheduled drives.' : 'No drives in this category on this date.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {drives.map((drive) => (
                <DriveCard
                  key={drive.id}
                  drive={drive}
                  isRegistered={registeredDriveIds.has(drive.id)}
                  onRegister={() => router.push(`/health/register/${drive.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
