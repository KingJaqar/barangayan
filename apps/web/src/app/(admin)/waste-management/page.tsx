import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_TRASH_SCORING_CONFIG, trashIncidentScore, type Tables } from '@barangayan/shared';

import { ZoneForm } from './zone-form';
import { ZoneRow } from './zone-row';
import { ScheduleForm } from './schedule-form';
import { ScheduleRow } from './schedule-row';
import { TrashIncidentTable } from './trash-incident-table';

export type WasteZone = Tables<'waste_zones'>;
export type WasteSchedule = Tables<'waste_collection_schedules'>;
type IncidentRow = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color' | 'icon'> | null;
};
type ScoredTrashIncident = IncidentRow & {
  score: number;
};

export default async function WasteManagementPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('barangay_id').eq('id', user!.id).single();

  const { data: zones } = await supabase
    .from('waste_zones')
    .select('*')
    .is('deleted_at', null)
    .order('sort_order', { ascending: true })
    .order('name');

  const { data: schedules } = await supabase
    .from('waste_collection_schedules')
    .select('*')
    .is('deleted_at', null)
    .order('day_of_week')
    .order('start_time');

  const { data: trashCategories } = await supabase
    .from('incident_categories')
    .select('id, name')
    .eq('is_trash_related', true)
    .order('name');

  const trashCategoryIds = ((trashCategories ?? []) as { id: string }[]).map((c) => c.id);

  let trashIncidents: ScoredTrashIncident[] = [];
  if (trashCategoryIds.length > 0) {
    const { data: incidents } = await supabase
      .from('incidents')
      .select(
        '*, incident_categories(name, color, icon)',
      )
      .is('deleted_at', null)
      .in('category_id', trashCategoryIds)
      .order('created_at', { ascending: false });

    const raw = ((incidents ?? []) as IncidentRow[]);
    const halfLifeDays = DEFAULT_TRASH_SCORING_CONFIG.halfLifeDays;
    trashIncidents = raw
      .map((inc) => ({
        ...inc,
        score: trashIncidentScore(inc.created_at, inc.confirmation_count, halfLifeDays),
      }))
      .sort((a, b) => b.score - a.score || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  const schedulesByZone = ((schedules ?? []) as WasteSchedule[]).reduce((acc, s) => {
    if (!acc[s.zone_id]) acc[s.zone_id] = [];
    acc[s.zone_id].push(s);
    return acc;
  }, {} as Record<string, WasteSchedule[]>);

  const activeZones = ((zones ?? []) as WasteZone[]).filter((z) => z.is_active);
  const trashCategoryNames = ((trashCategories ?? []) as { id: string; name: string }[]).reduce(
    (acc, c) => { acc[c.id] = c.name; return acc; },
    {} as Record<string, string>,
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Waste Management</h1>
        <p className="text-sm text-zinc-500">Manage collection zones, recurring pickup schedules, and monitor illegal dumping reports.</p>
      </div>

      {/* Zones */}
      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Collection Zones</h2>
        <ZoneForm barangayId={profile?.barangay_id ?? ''} />
        <div className="mt-6 flex flex-col gap-3">
          {(zones ?? []).map((zone) => (
            <ZoneRow key={zone.id} zone={zone} schedules={schedulesByZone[zone.id] ?? []} />
          ))}
          {(zones ?? []).length === 0 ? (
            <p className="text-center text-sm text-zinc-500">No zones yet — add one above.</p>
          ) : null}
        </div>
      </div>

      {/* Schedules */}
      <div className="mb-8 rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Collection Schedules</h2>
        <ScheduleForm barangayId={profile?.barangay_id ?? ''} zones={activeZones} />
        <div className="mt-6 flex flex-col gap-3">
          {(schedules ?? []).map((schedule) => (
            <ScheduleRow
              key={schedule.id}
              schedule={schedule}
              zoneName={(zones ?? []).find((z) => z.id === schedule.zone_id)?.name ?? 'Unknown Zone'}
            />
          ))}
          {(schedules ?? []).length === 0 ? (
            <p className="text-center text-sm text-zinc-500">No schedules yet — add one above.</p>
          ) : null}
        </div>
      </div>

      {/* Trash / Illegal Dumping Incidents */}
      <div className="rounded-xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Illegal Dumping Reports</h2>
            <p className="text-xs text-zinc-400">
              Time-decay weighted frequency scoring · half-life {DEFAULT_TRASH_SCORING_CONFIG.halfLifeDays} days
            </p>
          </div>
          {trashIncidents.length > 0 && (
            <span className="rounded-full bg-[#0F6E5B]/10 px-3 py-1 text-xs font-semibold text-[#0F6E5B]">
              {trashIncidents.length} report{trashIncidents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <TrashIncidentTable
          rows={trashIncidents}
          categoryNames={trashCategoryNames}
          highPriorityThreshold={DEFAULT_TRASH_SCORING_CONFIG.highPriorityThreshold}
        />
      </div>
    </div>
  );
}
