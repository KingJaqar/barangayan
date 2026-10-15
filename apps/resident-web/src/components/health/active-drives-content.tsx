'use client';

import { CalendarCheck2, HeartPulse } from 'lucide-react';
import { useEffect, useState } from 'react';

import { CategoryFilterPills, type DriveTypeFilter } from '@/components/health/category-filter-pills';
import { DriveCalendar, localToday } from '@/components/health/drive-calendar';
import { DriveCard } from '@/components/health/drive-card';
import { RegisterDrawer } from '@/components/health/register-drawer';
import { useMedicalDrives } from '@/hooks/use-medical-drives';

import styles from './health.module.css';

function fmtFullDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/**
 * Active Medical Drives segment — bare /health, per the plan's file-tree coverage check
 * ("bare /health IS Active Drives"). Calendar + category filter + selected-date drive
 * list — full parity with mobile's index.tsx layout (Calendar -> Filter Drives ->
 * Selected Date -> drive cards for that day).
 */
export function ActiveDrivesContent({ userId }: { userId: string | null }) {
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
      className={`${styles.page} ${drawerOpen ? styles.drawerOpen : ''}`}>
      {/* Keep the calendar and list readable as the registration drawer opens. */}
      <div className={styles.browse}>
        <aside className={styles.sidebar} aria-label="Drive calendar and filters">
          <div>
            <h2 className={styles.sectionLabel}>01 / Choose a date</h2>
            <DriveCalendar
              selectedDate={selectedDate}
              onDateSelect={setSelectedDate}
              eventDateMap={monthEventMap}
              currentMonth={currentMonth}
              onMonthChange={handleMonthChange}
              onJumpTo={handleJumpTo}
            />
          </div>

          <div>
            <h2 className={styles.sectionLabel}>02 / Filter drives</h2>
            <CategoryFilterPills active={typeFilter} onSelect={setTypeFilter} />
          </div>
        </aside>

        <section className={styles.results} aria-label="Drives on selected date" aria-busy={loadingDrives}>
          <div className={styles.resultsHeader}>
            <div>
              <h2 className={styles.dateTitle}>{fmtFullDate(selectedDate)}</h2>
              <p className={styles.resultCount} role="status">{loadingDrives ? 'Finding scheduled drives…' : error ? 'Unable to load drives' : `${drives.length} ${drives.length === 1 ? 'drive' : 'drives'} available${typeFilter === 'all' ? '' : ' in this category'}`}</p>
            </div>
            {selectedDate !== today ? (
              <button type="button" onClick={() => setSelectedDate(today)} className={`${styles.today} ${styles.todayButton}`}>
                Jump to Today
              </button>
            ) : (
              <span className={styles.today}><CalendarCheck2 size={13} aria-hidden="true" /> Today</span>
            )}
          </div>

          {error ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          ) : loadingDrives ? (
            <div className={styles.driveGrid} aria-hidden="true">
              {[0, 1].map((i) => (
                <div key={i} className={`${styles.skeleton} rw-skeleton`} />
              ))}
            </div>
          ) : drives.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>
                <HeartPulse size={24} aria-hidden="true" />
              </div>
              <div className="space-y-1">
                <h2>No drives on this date</h2>
                <p>
                  {typeFilter === 'all' ? 'Pick another date on the calendar to see scheduled drives.' : 'No drives in this category on this date.'}
                </p>
              </div>
            </div>
          ) : (
            <div className={styles.driveGrid}>
              {drives.map((drive) => (
                <DriveCard
                  key={drive.id}
                  drive={drive}
                  isRegistered={registeredDriveIds.has(drive.id)}
                  canRegister={userId !== null}
                  onRegister={() => setSelectedDriveId(drive.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <RegisterDrawer driveId={selectedDriveId} open={drawerOpen} onClose={() => setSelectedDriveId(null)} userId={userId} />
    </div>
  );
}
