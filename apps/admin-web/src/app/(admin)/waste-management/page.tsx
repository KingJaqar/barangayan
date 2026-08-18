import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_TRASH_SCORING_CONFIG, trashIncidentScore, type Tables } from '@barangayan/shared';

import { ZoneForm } from './zone-form';
import { ScheduleForm } from './schedule-form';
import { WasteCatalog } from './waste-catalog';
import { TrashIncidentTable } from './trash-incident-table';

export type WasteZone = Tables<'waste_zones'>;
export type WasteSchedule = Tables<'waste_collection_schedules'>;
type IncidentRow = Tables<'incidents'> & {
  incident_categories: Pick<Tables<'incident_categories'>, 'name' | 'color' | 'icon'> | null;
  waste_zones: Pick<Tables<'waste_zones'>, 'name'> | null;
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
        '*, incident_categories(name, color, icon), waste_zones(name)',
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

  const zoneList = (zones ?? []) as WasteZone[];
  const scheduleList = (schedules ?? []) as WasteSchedule[];

  const schedulesByZone = scheduleList.reduce((acc, s) => {
    if (!acc[s.zone_id]) acc[s.zone_id] = [];
    acc[s.zone_id].push(s);
    return acc;
  }, {} as Record<string, WasteSchedule[]>);

  const zoneNameById = zoneList.reduce((acc, z) => {
    acc[z.id] = z.name;
    return acc;
  }, {} as Record<string, string>);

  const activeZones = zoneList.filter((z) => z.is_active);
  const trashCategoryNames = ((trashCategories ?? []) as { id: string; name: string }[]).reduce(
    (acc, c) => { acc[c.id] = c.name; return acc; },
    {} as Record<string, string>,
  );

  return (
    <div className="mx-auto max-w-6xl">
      {/* Section 1: header + description */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Waste Management</h1>
        <p className="text-sm text-zinc-500">
          Manage collection zones, recurring pickup schedules, and monitor illegal dumping reports.
        </p>
      </div>

      {/* Section 2: add zone and add schedule form */}
      <div className="mb-6 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Add Zone</h2>
        <ZoneForm barangayId={profile?.barangay_id ?? ''} />

        <div className="my-4 border-t border-black/5 dark:border-white/5" />

        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Add Schedule</h2>
        <ScheduleForm barangayId={profile?.barangay_id ?? ''} zones={activeZones} />
      </div>

      {/* Sections 3 + 4: filter controls / search bar, and existing items */}
      <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Collection Zones &amp; Schedules</h2>
      <div className="mb-8">
        <WasteCatalog
          zones={zoneList}
          schedules={scheduleList}
          schedulesByZone={schedulesByZone}
          zoneNameById={zoneNameById}
        />
      </div>

      {/* Trash / Illegal Dumping Incidents */}
      <div className="rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Illegal Dumping Reports</h2>
            <p className="text-xs text-zinc-400">
              Time-decay weighted frequency scoring · half-life {DEFAULT_TRASH_SCORING_CONFIG.halfLifeDays} days
            </p>
          </div>
          {trashIncidents.length > 0 && (
            <span className="rounded-full bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent)]">
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
