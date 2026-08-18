'use client';

import { useMemo, useState } from 'react';

import { ZoneRow } from './zone-row';
import { ScheduleRow } from './schedule-row';
import type { WasteZone, WasteSchedule } from './page';

type Tab = 'zones' | 'schedules';
type StatusFilter = 'all' | 'active' | 'inactive';

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Waste Management page,
 * combined into one client component since the lists they filter need to live
 * alongside their controls to share state. Zones and schedules are two distinct
 * entity types, so a tab switch picks which list the search/status filter applies to. */
export function WasteCatalog({
  zones,
  schedules,
  schedulesByZone,
  zoneNameById,
}: {
  zones: WasteZone[];
  schedules: WasteSchedule[];
  schedulesByZone: Record<string, WasteSchedule[]>;
  zoneNameById: Record<string, string>;
}) {
  const [tab, setTab] = useState<Tab>('zones');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filteredZones = useMemo(() => {
    const q = query.trim().toLowerCase();
    return zones.filter((z) => {
      if (status === 'active' && !z.is_active) return false;
      if (status === 'inactive' && z.is_active) return false;
      if (q && !z.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [zones, query, status]);

  const filteredSchedules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schedules.filter((s) => {
      if (status === 'active' && !s.is_active) return false;
      if (status === 'inactive' && s.is_active) return false;
      if (q && !(zoneNameById[s.zone_id] ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [schedules, query, status, zoneNameById]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex shrink-0 gap-1 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
          <button
            type="button"
            onClick={() => setTab('zones')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              tab === 'zones' ? 'bg-[var(--accent)] text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}>
            Zones ({zones.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('schedules')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              tab === 'schedules' ? 'bg-[var(--accent)] text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}>
            Schedules ({schedules.length})
          </button>
        </div>

        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by zone name…"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
        />

        <div className="flex shrink-0 gap-1 rounded-full bg-zinc-100 p-0.5 dark:bg-zinc-800">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setStatus(f.value)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                status === f.value ? 'bg-[var(--accent)] text-white' : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'zones' ? (
        <div className="flex flex-col gap-2">
          {filteredZones.map((zone) => (
            <ZoneRow key={zone.id} zone={zone} schedules={schedulesByZone[zone.id] ?? []} />
          ))}
          {filteredZones.length === 0 && zones.length > 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">No zones match your search.</p>
          ) : null}
          {zones.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">No zones yet — add one above.</p> : null}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredSchedules.map((schedule) => (
            <ScheduleRow key={schedule.id} schedule={schedule} zoneName={zoneNameById[schedule.zone_id] ?? 'Unknown Zone'} />
          ))}
          {filteredSchedules.length === 0 && schedules.length > 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">No schedules match your search.</p>
          ) : null}
          {schedules.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">No schedules yet — add one above.</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
