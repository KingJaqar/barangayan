import { routingConditionsSnapshotSchema } from '@barangayan/shared';

import { bundledPackFor } from '@/lib/routing-packs';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { RoutingConditionsEditor, type RoutingEventView } from './routing-conditions-editor';
import { RoutingPageShell } from './routing-page-shell';
import styles from './routing.module.css';

// DRRM routing conditions (plan R4): verified road closures, center availability and
// entrances, published as one revisioned snapshot that residents' routing reads.
export default async function EvacuationRoutingPage() {
  const supabase = await createSupabaseServerClient();
  // RLS returns only the administrator's own barangay area (one per barangay).
  const { data: area, error: areaError } = await supabase.from('routing_areas').select('id, name').maybeSingle();

  if (areaError || !area) {
    return (
      <RoutingPageShell>
        <Notice tone={areaError ? 'error' : 'info'}>
          {areaError
            ? `Routing conditions could not be loaded: ${areaError.message}`
            : 'Evacuation routing is not set up for this barangay.'}
        </Notice>
      </RoutingPageShell>
    );
  }

  const [snapshotResult, versionsResult, eventsResult] = await Promise.all([
    supabase.rpc('get_routing_conditions_snapshot', { p_area_id: area.id }),
    supabase.from('routing_graph_versions').select('graph_version').eq('area_id', area.id),
    supabase
      .from('routing_condition_events')
      .select('id, revision, entity_type, entity_id, action, details, created_at')
      .eq('area_id', area.id)
      .order('id', { ascending: false })
      .limit(25),
  ]);

  const snapshot = routingConditionsSnapshotSchema.safeParse(snapshotResult.data);
  const loadError =
    snapshotResult.error?.message ??
    versionsResult.error?.message ??
    eventsResult.error?.message ??
    (snapshot.success ? null : 'The routing snapshot has an unexpected shape.');

  if (loadError || !snapshot.success) {
    return (
      <RoutingPageShell>
        <Notice tone="error">Routing conditions could not be loaded: {loadError}</Notice>
      </RoutingPageShell>
    );
  }

  const events: RoutingEventView[] = (eventsResult.data ?? []).map((event) => ({
    id: event.id,
    revision: event.revision,
    entityType: event.entity_type,
    action: event.action,
    details: event.details,
    createdAt: event.created_at,
  }));

  return (
    <RoutingPageShell>
      <RoutingConditionsEditor
        area={area}
        snapshot={snapshot.data}
        registeredGraphVersions={(versionsResult.data ?? []).map((version) => version.graph_version)}
        bundledPack={bundledPackFor(area.id)}
        events={events}
      />
    </RoutingPageShell>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={styles.notice} data-tone={tone}>
      {children}
    </p>
  );
}
