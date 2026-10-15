import { routingConditionsSnapshotSchema } from '@barangayan/shared';

import { bundledPackFor } from '@/lib/routing-packs';
import { createSupabaseServerClient } from '@/lib/supabase/server';

import { RoutingConditionsEditor, type RoutingEventView } from './routing-conditions-editor';

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

function RoutingPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Evacuation Routing</h1>
        <p className="text-sm text-zinc-500">
          Publish DRRM-verified road closures and center availability. Residents&apos; evacuation routes never use a
          closed road, and missing information is treated as unknown.
        </p>
      </div>
      {children}
    </div>
  );
}

function Notice({ tone, children }: { tone: 'info' | 'error'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : undefined}
      className={`rounded-xl border p-4 text-sm ${
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300'
          : 'border-black/10 bg-white text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-300'
      }`}>
      {children}
    </p>
  );
}
