import { ContentSection } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';
import { ContentCreatePanel } from '@/components/admin/content-create-panel';
import { RecordArchiveLink } from '@/components/admin/record-archive-link';
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
    <div className={styles.page}>
      <ContentCreatePanel
        title="Waste Management"
        description="Manage collection zones, recurring pickup schedules, and monitor illegal dumping reports."
        forms={[
          { label: "Create new zone", title: "New collection zone",
            description: "Name the collection area and describe its boundaries or landmarks.",
            content: <ZoneForm barangayId={profile?.barangay_id ?? ''} /> },
          { label: "Create new schedule", title: "New collection schedule",
            description: "Choose a zone, waste type, and recurring collection window.",
            content: <ScheduleForm barangayId={profile?.barangay_id ?? ''} zones={activeZones} /> },
        ]}
      />

      <RecordArchiveLink name="waste-management" />
      <WasteCatalog
        zones={zoneList}
        schedules={scheduleList}
        schedulesByZone={schedulesByZone}
        zoneNameById={zoneNameById}
      />

      {/* Trash / Illegal Dumping Incidents */}
      <ContentSection title="Illegal dumping reports" description={`Prioritized by recent reports and community confirmations · ${trashIncidents.length} report${trashIncidents.length === 1 ? '' : 's'}`}>
        <TrashIncidentTable
          rows={trashIncidents}
          categoryNames={trashCategoryNames}
          highPriorityThreshold={DEFAULT_TRASH_SCORING_CONFIG.highPriorityThreshold}
        />
      </ContentSection>
    </div>
  );
}
