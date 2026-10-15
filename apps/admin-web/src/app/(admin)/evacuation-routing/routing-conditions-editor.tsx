'use client';

import { AdminSelect } from '@/components/admin/dropdown/admin-select';

import {
  EVACUATION_CENTER_AVAILABILITIES,
  haversineDistanceMeters,
  roadClosureFormSchema,
  roadClosureReopenSchema,
  routingGraphRegistrationResultSchema,
  routingMutationResultSchema,
  type EvacuationCenterAvailability,
  type Json,
  type LatLng,
  type RoutingConditionsSnapshot,
  type RoutingPackEditorGraph,
} from '@barangayan/shared';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { TableDetailDialog } from '@/components/admin/table-detail-dialog';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { useToast } from '@/components/ui/toast';
import { loadPackGraph, nearestNode, type PackNode } from '@/lib/routing-packs';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const RoutingMap = dynamic(() => import('./routing-map').then((m) => ({ default: m.RoutingMap })), { ssr: false });

type SnapshotCenter = RoutingConditionsSnapshot['centers'][number];
type SnapshotClosure = RoutingConditionsSnapshot['closures'][number];

export interface RoutingEventView {
  id: number;
  revision: number;
  entityType: string;
  action: string;
  details: Json;
  createdAt: string;
}

interface RoutingConditionsEditorProps {
  area: { id: string; name: string };
  snapshot: RoutingConditionsSnapshot;
  registeredGraphVersions: string[];
  bundledPack: { graphVersion: string; attribution: string } | null;
  events: RoutingEventView[];
}

/** Clicks farther than this from every graph node do not pick an entrance. */
const ENTRANCE_PICK_RADIUS_METERS = 40;

const inputClass =
  'w-full rounded-lg border border-zinc-300 px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';
const labelClass = 'mb-1 block text-xs font-medium text-zinc-500';
const cardClass = 'rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-zinc-900';

const AVAILABILITY_LABELS: Record<EvacuationCenterAvailability, string> = {
  available: 'Available',
  unknown: 'Unknown',
  unavailable: 'Unavailable',
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' });
}

export function RoutingConditionsEditor({ area, snapshot, registeredGraphVersions, bundledPack, events }: RoutingConditionsEditorProps) {
  const router = useRouter();
  const toast = useToast();

  const [graph, setGraph] = useState<RoutingPackEditorGraph | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [selectedEdgeIds, setSelectedEdgeIds] = useState<string[]>([]);
  const [entranceCenterId, setEntranceCenterId] = useState<string | null>(null);
  const [entranceCandidate, setEntranceCandidate] = useState<PackNode | null>(null);
  // The map and the entrance form sit at the top; the center list is further down the page.
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const [clearTarget, setClearTarget] = useState<SnapshotCenter | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  useEffect(() => {
    if (!bundledPack) return;
    let cancelled = false;
    loadPackGraph(area.id)
      .then((loaded) => {
        if (!cancelled) setGraph(loaded);
      })
      .catch((error: unknown) => {
        if (!cancelled) setGraphError(error instanceof Error ? error.message : 'The routing map data could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [area.id, bundledPack]);

  const activeGraph = snapshot.activeGraphVersion;
  const bundledVersion = bundledPack?.graphVersion ?? null;
  const editable = graph !== null && bundledVersion !== null && bundledVersion === activeGraph;

  const edgesById = useMemo(() => new Map((graph?.edges ?? []).map((edge) => [edge.id, edge])), [graph]);
  const closedEdgeIds = useMemo(
    () => new Set(snapshot.closures.flatMap((closure) => closure.edgeIds ?? [])),
    [snapshot.closures],
  );
  const selectedSet = useMemo(() => new Set(selectedEdgeIds), [selectedEdgeIds]);
  const entranceCenter = snapshot.centers.find((center) => center.id === entranceCenterId) ?? null;

  async function runRpc(actionKey: string, run: () => Promise<{ error: { message: string } | null }>, success: string) {
    setBusyAction(actionKey);
    const { error } = await run();
    setBusyAction(null);
    if (error) {
      toast.showError(error.message);
      return false;
    }
    toast.showSuccess(success);
    router.refresh();
    return true;
  }

  async function registerBundledGraph() {
    if (!bundledVersion) return;
    const supabase = createSupabaseBrowserClient();
    await runRpc(
      'register',
      async () => {
        const { data, error } = await supabase.rpc('register_routing_graph_version', {
          p_area_id: area.id,
          p_graph_version: bundledVersion,
          p_activate: true,
        });
        if (error) return { error };
        const parsed = routingGraphRegistrationResultSchema.safeParse(data);
        if (!parsed.success || !parsed.data.active) return { error: { message: 'The map data was not activated.' } };
        return { error: null };
      },
      'Routing map data activated.',
    );
  }

  function toggleEdge(edgeId: string) {
    if (closedEdgeIds.has(edgeId)) {
      toast.showError('That road segment is already closed. Reopen its closure from the list instead.');
      return;
    }
    setSelectedEdgeIds((previous) => (previous.includes(edgeId) ? previous.filter((id) => id !== edgeId) : [...previous, edgeId]));
  }

  // A map click and typed coordinates both snap to the nearest walkable road point.
  function pickEntrance(point: LatLng, source: 'click' | 'coordinates') {
    if (!entranceCenter || !graph) return;
    const nearest = nearestNode(graph.nodes, point, ENTRANCE_PICK_RADIUS_METERS);
    if (!nearest) {
      toast.showError(
        source === 'click'
          ? `Click within ${ENTRANCE_PICK_RADIUS_METERS} m of a walkable road to pick the entrance.`
          : `No walkable road is within ${ENTRANCE_PICK_RADIUS_METERS} m of those coordinates.`,
      );
      return;
    }
    setEntranceCandidate(nearest.node);
  }

  function handleMapClick(point: LatLng) {
    pickEntrance(point, 'click');
  }

  function startEntrance(centerId: string) {
    setEntranceCenterId(centerId);
    setEntranceCandidate(null);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    mapSectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }

  function cancelEntrance() {
    setEntranceCenterId(null);
    setEntranceCandidate(null);
  }

  async function saveEntrance() {
    if (!entranceCenter || !entranceCandidate || !activeGraph) return;
    const supabase = createSupabaseBrowserClient();
    const saved = await runRpc(
      `entrance:${entranceCenter.id}`,
      async () => {
        const { data, error } = await supabase.rpc('set_evacuation_center_entrance', {
          p_center_id: entranceCenter.id,
          p_graph_version: activeGraph,
          p_node_id: entranceCandidate.id,
          p_lat: entranceCandidate.lat,
          p_lng: entranceCandidate.lng,
        });
        if (error) return { error };
        return routingMutationResultSchema.safeParse(data).success ? { error: null } : { error: { message: 'Unexpected response while saving the entrance.' } };
      },
      `Entrance saved for ${entranceCenter.name}.`,
    );
    if (saved) cancelEntrance();
  }

  async function clearEntrance(center: SnapshotCenter) {
    const supabase = createSupabaseBrowserClient();
    const cleared = await runRpc(
      `clear:${center.id}`,
      async () => {
        const { error } = await supabase.rpc('clear_evacuation_center_entrance', { p_center_id: center.id });
        return { error };
      },
      `${center.name} is no longer routable until its entrance is set.`,
    );
    // On failure the error toast shows and the dialog stays open, so the admin can retry or cancel.
    if (cleared) setClearTarget(null);
  }

  async function setAvailability(center: SnapshotCenter, availability: EvacuationCenterAvailability) {
    if (availability === center.availability) return;
    const supabase = createSupabaseBrowserClient();
    const saved = await runRpc(
      `availability:${center.id}`,
      async () => {
        const { error } = await supabase.from('evacuation_centers').update({ availability }).eq('id', center.id);
        return { error };
      },
      `${center.name} marked ${AVAILABILITY_LABELS[availability].toLowerCase()}.`,
    );
    if (saved) {
      logAdminAction({
        action: 'update',
        entityType: 'evacuation_center',
        entityId: center.id,
        entityLabel: center.name,
        changes: { before: { availability: center.availability }, after: { availability } },
      }).catch(() => {});
    }
  }

  const clearing = clearTarget !== null && busyAction === `clear:${clearTarget.id}`;

  return (
    <div className="flex flex-col gap-4">
      {clearTarget ? (
        <TableDetailDialog label={`Clear entrance for ${clearTarget.name}`} onClose={() => setClearTarget(null)} preventClose={clearing}>
          <div className="flex flex-col gap-3 rounded-2xl bg-white p-6 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">Clear the entrance for {clearTarget.name}?</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              Residents will not get walking routes to this center until a new entrance is set. The center stays listed, and
              routes to other centers are not affected.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setClearTarget(null)}
                disabled={clearing}
                className="rounded-full bg-zinc-200 px-4 py-1.5 text-xs font-semibold disabled:opacity-50 dark:bg-zinc-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void clearEntrance(clearTarget)}
                disabled={clearing}
                aria-busy={clearing}
                className="rounded-full bg-red-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50">
                <LoadingButtonContent pending={clearing} pendingLabel="Clearing…">
                  Clear entrance
                </LoadingButtonContent>
              </button>
            </div>
          </div>
        </TableDetailDialog>
      ) : null}
      <StatusCard
        snapshot={snapshot}
        bundledVersion={bundledVersion}
        bundledRegistered={bundledVersion !== null && registeredGraphVersions.includes(bundledVersion)}
        registering={busyAction === 'register'}
        onRegister={registerBundledGraph}
        onRefresh={() => router.refresh()}
      />

      {graphError ? (
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          {graphError}
        </p>
      ) : null}

      <div ref={mapSectionRef} className="grid scroll-mt-4 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className={`${cardClass} p-0`}>
          {graph && bundledPack ? (
            <RoutingMap
              graph={graph}
              attribution={bundledPack.attribution}
              closures={snapshot.closures}
              closedEdgeIds={closedEdgeIds}
              selectedEdgeIds={selectedSet}
              onToggleEdge={toggleEdge}
              centers={snapshot.centers}
              entranceMode={entranceCenter !== null}
              entranceCandidate={entranceCandidate}
              onMapClick={handleMapClick}
              editable={editable}
            />
          ) : (
            <div className="flex h-[560px] items-center justify-center text-sm text-zinc-500" aria-busy={!graphError && bundledPack !== null}>
              {bundledPack ? (graphError ? 'Map unavailable.' : 'Loading routing map data…') : 'No routing map data is bundled for this area.'}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {entranceCenter ? (
            <EntrancePanel
              center={entranceCenter}
              candidate={entranceCandidate}
              saving={busyAction === `entrance:${entranceCenter.id}`}
              onPickCoordinates={(point) => pickEntrance(point, 'coordinates')}
              onSave={saveEntrance}
              onCancel={cancelEntrance}
            />
          ) : (
            <ClosureForm
              areaId={area.id}
              graphVersion={activeGraph}
              editable={editable}
              selectedEdges={selectedEdgeIds.flatMap((id) => {
                const edge = edgesById.get(id);
                return edge ? [edge] : [];
              })}
              onClearSelection={() => setSelectedEdgeIds([])}
              onPublished={() => {
                setSelectedEdgeIds([]);
                router.refresh();
              }}
            />
          )}
        </div>
      </div>

      <section className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Active closures ({snapshot.closures.length})</h2>
        {snapshot.closures.length === 0 ? (
          <p className="text-sm text-zinc-500">No active closures are reported. This does not confirm that every road is passable.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshot.closures.map((closure) => (
              <ClosureRow key={closure.id} closure={closure} onReopened={() => router.refresh()} />
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Evacuation centers</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Routing uses available centers first, and unknown ones only when no available center can be reached. A center
          without a reviewed entrance is shown to residents but never routed to. Moving a center clears its entrance.
        </p>
        {snapshot.centers.length === 0 ? (
          <p className="text-sm text-zinc-500">No evacuation centers yet. Add them under Evacuation Centers.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshot.centers.map((center) => (
              <li key={center.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/5 p-3 dark:border-white/10">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {center.name}
                    {!center.active ? <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700 dark:bg-red-900/40 dark:text-red-300">Inactive</span> : null}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {center.entranceNodeId ? 'Entrance reviewed' : 'No entrance — not routable'}
                    {center.availabilityUpdatedAt ? ` · Availability updated ${formatTime(center.availabilityUpdatedAt)}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="text-xs">
                    <span className="sr-only">Availability of {center.name}</span>
                    <AdminSelect kind="status"
                      className={`${inputClass} w-auto`}
                      value={center.availability}
                      disabled={busyAction === `availability:${center.id}`}
                      onValueChange={(nextValue) => {
                        const parsed = EVACUATION_CENTER_AVAILABILITIES.find((value) => value === nextValue);
                        if (parsed) void setAvailability(center, parsed);
                      }}>
                      {EVACUATION_CENTER_AVAILABILITIES.map((value) => (
                        <option key={value} value={value}>
                          {AVAILABILITY_LABELS[value]}
                        </option>
                      ))}
                    </AdminSelect>
                  </label>
                  <button
                    type="button"
                    disabled={!editable || !center.active || !center.position}
                    title={!center.active ? 'Activate the center to set its entrance' : !center.position ? 'The center has no valid position' : undefined}
                    onClick={() => startEntrance(center.id)}
                    className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200">
                    {center.entranceNodeId ? 'Change entrance' : 'Set entrance'}
                  </button>
                  {center.entrancePosition ? (
                    <button
                      type="button"
                      disabled={busyAction === `clear:${center.id}`}
                      onClick={() => setClearTarget(center)}
                      className="rounded-full px-3 py-1 text-xs font-semibold text-zinc-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/30 dark:hover:text-red-300">
                      <LoadingButtonContent pending={busyAction === `clear:${center.id}`} pendingLabel="Clearing…">
                        Clear entrance
                      </LoadingButtonContent>
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={cardClass}>
        <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-300">Recent changes</h2>
        {events.length === 0 ? (
          <p className="text-sm text-zinc-500">No routing changes yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-zinc-400">
                  <th scope="col" className="w-16 pb-2 pr-4 font-semibold">Revision</th>
                  <th scope="col" className="pb-2 pr-4 font-semibold">Change</th>
                  <th scope="col" className="pb-2 font-semibold">When</th>
                </tr>
              </thead>
              <tbody className="text-zinc-600 dark:text-zinc-300">
                {events.map((event) => (
                  <tr key={event.id}>
                    <td className="py-1 pr-4 align-top font-mono text-zinc-400">r{event.revision}</td>
                    <td className="py-1 pr-4 align-top">{describeEvent(event)}</td>
                    <td className="whitespace-nowrap py-1 align-top text-zinc-400">{formatTime(event.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatusCard({
  snapshot,
  bundledVersion,
  bundledRegistered,
  registering,
  onRegister,
  onRefresh,
}: {
  snapshot: RoutingConditionsSnapshot;
  bundledVersion: string | null;
  bundledRegistered: boolean;
  registering: boolean;
  onRegister: () => void;
  onRefresh: () => void;
}) {
  const needsActivation = bundledVersion !== null && bundledVersion !== snapshot.activeGraphVersion;
  return (
    <section className={cardClass}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 text-sm">
          <p>
            <span className="font-semibold">Revision {snapshot.revision}</span>
            <span className="text-zinc-500"> · published {formatTime(snapshot.revisedAt)} · loaded {formatTime(snapshot.generatedAt)}</span>
          </p>
          <p className="mt-0.5 break-all text-xs text-zinc-500">
            Active map data: {snapshot.activeGraphVersion ?? 'none'}
            {bundledVersion && bundledVersion !== snapshot.activeGraphVersion ? ` · this admin build has ${bundledVersion}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">
          Refresh
        </button>
      </div>
      {needsActivation ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <p className="min-w-0 flex-1">
            {snapshot.activeGraphVersion
              ? 'This admin build carries newer map data. Activation is refused until every active closure and center entrance is mapped to it.'
              : 'Activate the bundled map data before publishing closures or setting entrances.'}
            {bundledRegistered ? ' It is already registered.' : ''}
          </p>
          <button
            type="button"
            onClick={onRegister}
            disabled={registering}
            className="rounded-full bg-[var(--accent)] px-4 py-1 text-xs font-semibold text-white disabled:opacity-50"
            aria-busy={registering}>
            <LoadingButtonContent pending={registering} pendingLabel="Activating…">
              Activate map data
            </LoadingButtonContent>
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ClosureForm({
  areaId,
  graphVersion,
  editable,
  selectedEdges,
  onClearSelection,
  onPublished,
}: {
  areaId: string;
  graphVersion: string | null;
  editable: boolean;
  selectedEdges: RoutingPackEditorGraph['edges'];
  onClearSelection: () => void;
  onPublished: () => void;
}) {
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [reason, setReason] = useState('');
  const [observedAt, setObservedAt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const suggestedLabel = [...new Set(selectedEdges.map((edge) => edge.name).filter((name): name is string => name !== null))].join(', ');

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!graphVersion) return;
    // A blank observation time means the closure is being reported as observed now.
    const result = roadClosureFormSchema.safeParse({
      label: label.trim() || suggestedLabel,
      reason,
      observedAt: observedAt ? new Date(observedAt) : new Date(),
      segmentCount: selectedEdges.length,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid closure');
      return;
    }

    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc('publish_road_closure', {
      p_area_id: areaId,
      p_graph_version: graphVersion,
      p_edge_ids: selectedEdges.map((edge) => edge.id),
      p_source_refs: selectedEdges.map((edge) => edge.sourceRef),
      p_geometry: { type: 'MultiLineString', coordinates: selectedEdges.map((edge) => edge.geometry) },
      p_label: result.data.label,
      p_reason: result.data.reason,
      p_observed_at: result.data.observedAt.toISOString(),
    });
    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message);
      toast.showError(`Closure not published: ${rpcError.message}`);
      return;
    }
    const published = routingMutationResultSchema.safeParse(data);
    if (!published.success) {
      setError('Unexpected response while publishing the closure. Refresh before trying again.');
      return;
    }
    toast.showSuccess(`Closure published (revision ${published.data.revision}).`);
    setLabel('');
    setReason('');
    setObservedAt('');
    onPublished();
  }

  return (
    <form onSubmit={handleSubmit} className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">Publish a verified closure</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          {editable
            ? 'Click road segments on the map to select them. A closed road is blocked for every resident until you reopen it.'
            : 'Activate the bundled map data to publish closures.'}
        </p>
      </div>

      <p className="text-xs">
        <span className="font-semibold">{selectedEdges.length}</span> segment{selectedEdges.length === 1 ? '' : 's'} selected
        {selectedEdges.length > 0 ? (
          <button type="button" onClick={onClearSelection} className="ml-2 font-semibold text-[var(--accent)] hover:underline">
            Clear
          </button>
        ) : null}
      </p>

      <label className="text-sm">
        <span className={labelClass}>Road label</span>
        <input
          className={inputClass}
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder={suggestedLabel || 'e.g. General Luna Street bridge'}
          maxLength={120}
          disabled={!editable}
        />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Reason *</span>
        <textarea
          className={inputClass}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="e.g. Knee-deep flooding reported by DRRM patrol"
          maxLength={500}
          rows={3}
          required
          disabled={!editable}
        />
      </label>

      <label className="text-sm">
        <span className={labelClass}>Observed at (leave blank for now)</span>
        <input
          className={inputClass}
          type="datetime-local"
          value={observedAt}
          onChange={(event) => setObservedAt(event.target.value)}
          disabled={!editable}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!editable || submitting || selectedEdges.length === 0}
        className="rounded-full bg-[var(--accent)] px-5 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        aria-busy={submitting}>
        <LoadingButtonContent pending={submitting} pendingLabel="Publishing…">
          Publish closure
        </LoadingButtonContent>
      </button>
    </form>
  );
}

function ClosureRow({ closure, onReopened }: { closure: SnapshotClosure; onReopened: () => void }) {
  const toast = useToast();
  const [reopening, setReopening] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function reopen() {
    setError(null);
    const parsed = roadClosureReopenSchema.safeParse({ reason });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter a reason');
      return;
    }
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error: rpcError } = await supabase.rpc('reopen_road_closure', {
      p_closure_id: closure.id,
      p_reason: parsed.data.reason,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      toast.showError(`Closure not reopened: ${rpcError.message}`);
      return;
    }
    const result = routingMutationResultSchema.safeParse(data);
    toast.showSuccess(result.success ? `Road reopened (revision ${result.data.revision}).` : 'Road reopened.');
    setReopening(false);
    onReopened();
  }

  return (
    <li className="rounded-lg border border-black/5 p-3 dark:border-white/10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {closure.label}
            {closure.edgeIds === null ? (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                Not mapped to the active map data
              </span>
            ) : null}
          </p>
          <p className="text-xs text-zinc-600 dark:text-zinc-300">{closure.reason}</p>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Observed {formatTime(closure.observedAt)} · published {formatTime(closure.publishedAt)} · revision {closure.revision} ·{' '}
            {closure.sourceRefs.length} segment{closure.sourceRefs.length === 1 ? '' : 's'}
          </p>
        </div>
        {!reopening ? (
          <button
            type="button"
            onClick={() => setReopening(true)}
            className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200">
            Reopen…
          </button>
        ) : null}
      </div>
      {reopening ? (
        <div className="mt-2 flex flex-col gap-2">
          <label className="text-sm">
            <span className={labelClass}>Why is the road open again? *</span>
            <input
              className={inputClass}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. Water receded; inspected by DRRM"
              maxLength={500}
            />
          </label>
          {error ? (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void reopen()}
              disabled={submitting}
              className="rounded-full bg-red-600 px-4 py-1 text-xs font-semibold text-white disabled:opacity-50"
              aria-busy={submitting}>
              <LoadingButtonContent pending={submitting} pendingLabel="Reopening…">
                Confirm reopen
              </LoadingButtonContent>
            </button>
            <button
              type="button"
              onClick={() => {
                setReopening(false);
                setError(null);
              }}
              disabled={submitting}
              className="rounded-full bg-zinc-200 px-4 py-1 text-xs font-semibold disabled:opacity-50 dark:bg-zinc-700">
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function EntrancePanel({
  center,
  candidate,
  saving,
  onPickCoordinates,
  onSave,
  onCancel,
}: {
  center: SnapshotCenter;
  candidate: PackNode | null;
  saving: boolean;
  /** Snaps to the nearest walkable road point; the caller reports when none is close enough. */
  onPickCoordinates: (point: LatLng) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [center.id]);
  const [coordinateError, setCoordinateError] = useState<string | null>(null);

  function findRoadPoint(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedLat = lat.trim() === '' ? NaN : Number(lat);
    const parsedLng = lng.trim() === '' ? NaN : Number(lng);
    if (!Number.isFinite(parsedLat) || parsedLat < -90 || parsedLat > 90) {
      setCoordinateError('Enter a latitude between -90 and 90.');
      return;
    }
    if (!Number.isFinite(parsedLng) || parsedLng < -180 || parsedLng > 180) {
      setCoordinateError('Enter a longitude between -180 and 180.');
      return;
    }
    setCoordinateError(null);
    onPickCoordinates({ lat: parsedLat, lng: parsedLng });
  }

  const metersFromCenter = candidate && center.position ? Math.round(haversineDistanceMeters(center.position, candidate)) : null;
  // The server refuses an entrance more than 250 m from the pin; don't offer a save that must fail.
  const tooFar = metersFromCenter !== null && metersFromCenter > 250;

  return (
    <section className={`${cardClass} flex flex-col gap-3`}>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="text-sm font-semibold text-zinc-600 outline-none dark:text-zinc-300">
          Entrance for {center.name}
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          Click the walkable road point where residents enter the center (within {ENTRANCE_PICK_RADIUS_METERS} m of a road and
          250 m of the center).
        </p>
      </div>
      <form onSubmit={findRoadPoint} noValidate className="flex flex-col gap-2">
        <p className="text-xs text-zinc-500">Or enter the entrance coordinates:</p>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className={labelClass}>Latitude</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="14.677740"
              disabled={saving}
            />
          </label>
          <label>
            <span className={labelClass}>Longitude</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="121.116886"
              disabled={saving}
            />
          </label>
        </div>
        {coordinateError ? (
          <p role="alert" className="text-xs text-red-600">
            {coordinateError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-full bg-zinc-200 px-4 py-1.5 text-xs font-semibold disabled:opacity-50 dark:bg-zinc-700">
          Find road point
        </button>
      </form>
      <p className="text-xs" aria-live="polite">
        {candidate
          ? `Selected road point ${candidate.id} (${candidate.lat.toFixed(6)}, ${candidate.lng.toFixed(6)})${
              metersFromCenter !== null ? ` · ${metersFromCenter} m from the center` : ''
            }`
          : 'No point selected yet.'}
      </p>
      {tooFar ? (
        <p role="alert" className="text-xs text-red-600">
          This point is more than 250 m from the center&apos;s pin. Move the center on the Evacuation Centers page first.
        </p>
      ) : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={!candidate || saving || tooFar}
          className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          aria-busy={saving}>
          <LoadingButtonContent pending={saving} pendingLabel="Saving…">
            Save entrance
          </LoadingButtonContent>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full bg-zinc-200 px-4 py-1.5 text-xs font-semibold disabled:opacity-50 dark:bg-zinc-700">
          Cancel
        </button>
      </div>
    </section>
  );
}

function detailText(details: Json, key: string): string | null {
  if (typeof details !== 'object' || details === null || Array.isArray(details)) return null;
  const value = details[key];
  return typeof value === 'string' ? value : null;
}

function describeEvent(event: RoutingEventView): string {
  const label = detailText(event.details, 'label') ?? detailText(event.details, 'name');
  const subject = label ? ` — ${label}` : '';
  switch (`${event.entityType}:${event.action}`) {
    case 'road_closure:published':
      return `Closure published${subject}`;
    case 'road_closure:reopened':
      return `Road reopened${subject}`;
    case 'road_closure:mapped':
      return `Closure mapped to new map data${subject}`;
    case 'evacuation_center:created':
      return `Center added${subject}`;
    case 'evacuation_center:updated':
      return `Center updated${subject}`;
    case 'evacuation_center:deleted':
      return `Center removed${subject}`;
    case 'evacuation_center:mapped':
      return `Entrance mapped to new map data${subject}`;
    case 'routing_graph:registered':
      return 'Map data registered';
    case 'routing_graph:activated':
      return 'Map data activated';
    default:
      return `${event.entityType} ${event.action}${subject}`;
  }
}
