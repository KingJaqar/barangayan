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
import { ArrowUpRight, Building2, Check, Clock3, Info, MapPin, RefreshCw, Route, Waypoints } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { logAdminAction } from '@/actions/admin-audit-actions';
import { TableDetailDialog } from '@/components/admin/table-detail-dialog';
import { LoadingButtonContent } from '@/components/loading/loading-button-content';
import { useToast } from '@/components/ui/toast';
import { loadPackGraph, nearestNode, type PackNode } from '@/lib/routing-packs';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import styles from './routing.module.css';

const RoutingMap = dynamic(() => import('./routing-map').then((m) => ({ default: m.RoutingMap })), {
  ssr: false,
  loading: () => <div className={styles.mapPlaceholder} role="status" aria-busy="true"><Route size={28} strokeWidth={1.25} aria-hidden="true" />Loading routing map…</div>,
});

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

const inputClass = styles.input;
const labelClass = styles.fieldLabel;
const cardClass = styles.card;

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
  const mapSectionRef = useRef<HTMLElement>(null);
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
    <div className={styles.editor}>
      {clearTarget ? (
        <TableDetailDialog label={`Clear entrance for ${clearTarget.name}`} onClose={() => setClearTarget(null)} preventClose={clearing}>
          <div className={styles.dialog}>
            <h2 className="text-base font-semibold">Clear the entrance for {clearTarget.name}?</h2>
            <p className={styles.recordText}>
              Residents will not get walking routes to this center until a new entrance is set. The center stays listed, and
              routes to other centers are not affected.
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => setClearTarget(null)}
                disabled={clearing}
                className={styles.button}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void clearEntrance(clearTarget)}
                disabled={clearing}
                aria-busy={clearing}
                className={styles.dangerButton}>
                <LoadingButtonContent pending={clearing} pendingLabel="Clearing…">
                  Clear entrance
                </LoadingButtonContent>
              </button>
            </div>
          </div>
        </TableDetailDialog>
      ) : null}
      <StatusCard
        areaName={area.name}
        snapshot={snapshot}
        bundledVersion={bundledVersion}
        bundledRegistered={bundledVersion !== null && registeredGraphVersions.includes(bundledVersion)}
        registering={busyAction === 'register'}
        onRegister={registerBundledGraph}
        onRefresh={() => router.refresh()}
      />

      {graphError ? (
        <p role="alert" className={styles.notice} data-tone="error">
          {graphError}
        </p>
      ) : null}

      <nav className={styles.sectionNav} aria-label="Routing sections">
        <a href="#routing-workspace"><Route size={14} aria-hidden="true" /> Routing map <span>01</span></a>
        <a href="#routing-closures">Active closures <span>{snapshot.closures.length}</span></a>
        <a href="#routing-centers">Centers &amp; entrances <span>{snapshot.centers.length}</span></a>
        <a href="#routing-history">Recent changes <ArrowUpRight size={13} aria-hidden="true" /></a>
      </nav>

      <section ref={mapSectionRef} id="routing-workspace" className={styles.workspace} aria-labelledby="routing-workspace-heading">
        <div className={styles.sectionHeading}>
          <div>
            <h2 id="routing-workspace-heading"><span className={styles.sectionNumber}>01</span> Routing workspace</h2>
            <p>Review the road network, select a closure, or verify a center entrance.</p>
          </div>
          <span className={`${styles.badge} ${!editable ? styles.badgeMuted : ''}`}>
            <Waypoints size={12} aria-hidden="true" /> {editable ? 'Map ready to edit' : 'Map preview'}
          </span>
        </div>
        <div className={styles.workspaceGrid}>
          <div className={`${cardClass} ${styles.mapCard}`}>
            <div className={styles.mapBar}>
              <span><MapPin size={14} aria-hidden="true" /> {area.name}</span>
              <span className={styles.badge}>{entranceCenter ? 'Entrance selection' : 'Road conditions'}</span>
            </div>
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
              <div className={styles.mapPlaceholder} aria-busy={!graphError && bundledPack !== null} role="status">
                <Route size={28} strokeWidth={1.25} aria-hidden="true" />
                {bundledPack ? (graphError ? 'Map unavailable.' : 'Loading routing map data…') : 'No routing map data is bundled for this area.'}
              </div>
            )}
            <p className={styles.mapCaption}><Info size={13} aria-hidden="true" />
              {entranceCenter ? `Pick the walkable road point where residents enter ${entranceCenter.name}.` : editable ? 'Select a road segment to add it to a closure. Click it again to deselect.' : 'Road selection is available when the bundled map data is loaded and active.'}
            </p>
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
      </section>

      <section id="routing-closures" className={cardClass} aria-labelledby="routing-closures-heading">
        <div className={styles.sectionHeading}>
          <div><h2 id="routing-closures-heading"><span className={styles.sectionNumber}>02</span> Active closures</h2>
            <p>Verified restrictions currently excluded from residents&apos; routes.</p></div>
          <span className={styles.count}>{snapshot.closures.length}</span>
        </div>
        {snapshot.closures.length === 0 ? (
          <div className={styles.empty}><p><strong>No active closures reported</strong>This does not confirm that every road is passable.</p></div>
        ) : (
          <ul className={styles.list}>
            {snapshot.closures.map((closure) => (
              <ClosureRow key={closure.id} closure={closure} onReopened={() => router.refresh()} />
            ))}
          </ul>
        )}
      </section>

      <section id="routing-centers" className={cardClass} aria-labelledby="routing-centers-heading">
        <div className={styles.sectionHeading}>
        <div><h2 id="routing-centers-heading"><span className={styles.sectionNumber}>03</span> Centers &amp; entrances</h2>
        <p>
          Routing uses available centers first, and unknown ones only when no available center can be reached. A center
          without a reviewed entrance is shown to residents but never routed to. Moving a center clears its entrance.
        </p></div><span className={styles.count}>{snapshot.centers.length}</span></div>
        {snapshot.centers.length === 0 ? (
          <div className={styles.empty}><Building2 size={22} strokeWidth={1.5} aria-hidden="true" /><p><strong>No evacuation centers yet</strong>Add them under Evacuation Centers to review availability and entrances here.</p></div>
        ) : (
          <ul className={styles.list}>
            {snapshot.centers.map((center) => (
              <li key={center.id} className={`${styles.row} ${styles.centerRow}`}>
                <div className={styles.centerInfo}>
                  <p className={styles.recordTitle}>
                    {center.name}
                    {!center.active ? <span className={`${styles.badge} ${styles.dangerBadge}`}>Inactive</span> : null}
                  </p>
                  <p className={styles.recordText}>
                    <span className={styles.entranceState}>{center.entranceNodeId ? <Check size={12} aria-hidden="true" /> : <Info size={12} aria-hidden="true" />}{center.entranceNodeId ? 'Entrance reviewed' : 'No entrance — not routable'}</span>
                    {center.availabilityUpdatedAt ? ` · Availability updated ${formatTime(center.availabilityUpdatedAt)}` : ''}
                  </p>
                </div>
                <div className={styles.centerActions}>
                  <label className={styles.availability}>
                    <span className="sr-only">Availability of {center.name}</span>
                    <AdminSelect kind="availability"
                      className={inputClass}
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
                    className={styles.button}>
                    {center.entranceNodeId ? 'Change entrance' : 'Set entrance'}
                  </button>
                  {center.entrancePosition ? (
                    <button
                      type="button"
                      disabled={busyAction === `clear:${center.id}`}
                      onClick={() => setClearTarget(center)}
                      className={styles.dangerButton}>
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

      <section id="routing-history" className={cardClass} aria-labelledby="routing-history-heading">
        <div className={styles.sectionHeading}><div>
          <h2 id="routing-history-heading"><span className={styles.sectionNumber}>04</span> Recent changes</h2>
          <p>The latest published updates to this area&apos;s routing conditions.</p>
        </div><Clock3 size={18} className={styles.sectionNumber} aria-hidden="true" /></div>
        {events.length === 0 ? (
          <div className={styles.empty}><Clock3 size={22} strokeWidth={1.5} aria-hidden="true" /><p><strong>No routing changes yet</strong>Published updates will appear here with their revision and time.</p></div>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.history}>
              <thead>
                <tr>
                  <th scope="col">Revision</th>
                  <th scope="col">Change</th>
                  <th scope="col">When</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id}>
                    <td>r{event.revision}</td>
                    <td>{describeEvent(event)}</td>
                    <td>{formatTime(event.createdAt)}</td>
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
  areaName,
  snapshot,
  bundledVersion,
  bundledRegistered,
  registering,
  onRegister,
  onRefresh,
}: {
  areaName: string;
  snapshot: RoutingConditionsSnapshot;
  bundledVersion: string | null;
  bundledRegistered: boolean;
  registering: boolean;
  onRegister: () => void;
  onRefresh: () => void;
}) {
  const needsActivation = bundledVersion !== null && bundledVersion !== snapshot.activeGraphVersion;
  return (
    <section className={`${cardClass} ${styles.status}`} aria-label="Published routing overview">
      <div className={styles.statusTop}>
        <p className={styles.area}><MapPin size={15} aria-hidden="true" /> {areaName}
          <span className={`${styles.badge} ${!snapshot.activeGraphVersion ? styles.badgeMuted : ''}`}>
            {snapshot.activeGraphVersion ? 'Active map data' : 'Awaiting map activation'}
          </span>
        </p>
        <button
          type="button"
          onClick={onRefresh}
          className={styles.button}>
          <RefreshCw size={13} aria-hidden="true" /> Refresh
        </button>
      </div>
      <dl className={styles.stats}>
        <div><dt>Published revision</dt><dd>r{snapshot.revision}<small>{formatTime(snapshot.revisedAt)}</small></dd></div>
        <div><dt>Active closures</dt><dd>{snapshot.closures.length}<small>Excluded from routing</small></dd></div>
        <div><dt>Evacuation centers</dt><dd>{snapshot.centers.length}<small>{snapshot.centers.filter(center => center.active && center.availability === 'available').length} active &amp; available</small></dd></div>
        <div><dt>Reviewed entrances</dt><dd>{snapshot.centers.filter(center => center.entranceNodeId !== null).length}<span className={styles.sectionNumber}> / {snapshot.centers.length}</span><small>Centers with an entrance set</small></dd></div>
      </dl>
      <p className={styles.mapVersion}>
        Active map data: {snapshot.activeGraphVersion ?? 'none'}
        {bundledVersion && bundledVersion !== snapshot.activeGraphVersion ? ` · this admin build has ${bundledVersion}` : ''}
        {' · '}Loaded {formatTime(snapshot.generatedAt)}
      </p>
      {needsActivation ? (
        <div className={styles.activation}>
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
            className={styles.primaryButton}
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
    <form onSubmit={handleSubmit} className={`${cardClass} ${styles.form}`}>
      <div>
        <p className={styles.eyebrow}>Road restriction</p>
        <h2>Publish a verified closure</h2>
        <p className={styles.recordText}>
          {editable
            ? 'Click road segments on the map to select them. A closed road is blocked for every resident until you reopen it.'
            : 'Activate the bundled map data to publish closures.'}
        </p>
      </div>

      <div className={styles.selection}>
        <p><strong>{selectedEdges.length}</strong> segment{selectedEdges.length === 1 ? '' : 's'} selected</p>
        {selectedEdges.length > 0 ? (
          <button type="button" onClick={onClearSelection} className={styles.textButton}>
            Clear
          </button>
        ) : null}
      </div>

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
        <p role="alert" className={styles.error}>
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!editable || submitting || selectedEdges.length === 0}
        className={styles.primaryButton}
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
    <li className={styles.row}>
      <div className={styles.rowTop}>
        <div className="min-w-0">
          <p className={styles.recordTitle}>
            {closure.label}
            {closure.edgeIds === null ? (
              <span className={`${styles.badge} ${styles.warningBadge}`}>
                Not mapped to the active map data
              </span>
            ) : null}
          </p>
          <p className={styles.recordText}>{closure.reason}</p>
          <p className={styles.recordMeta}>
            Observed {formatTime(closure.observedAt)} · published {formatTime(closure.publishedAt)} · revision {closure.revision} ·{' '}
            {closure.sourceRefs.length} segment{closure.sourceRefs.length === 1 ? '' : 's'}
          </p>
        </div>
        {!reopening ? (
          <button
            type="button"
            onClick={() => setReopening(true)}
            className={styles.button}>
            Reopen…
          </button>
        ) : null}
      </div>
      {reopening ? (
        <div className={styles.reopenForm}>
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
            <p role="alert" className={styles.error}>
              {error}
            </p>
          ) : null}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={() => void reopen()}
              disabled={submitting}
              className={styles.dangerButton}
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
              className={styles.button}>
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
    <section className={`${cardClass} ${styles.form}`}>
      <div>
        <h2 ref={headingRef} tabIndex={-1} className="outline-none">
          Entrance for {center.name}
        </h2>
        <p className={styles.recordText}>
          Click the walkable road point where residents enter the center (within {ENTRANCE_PICK_RADIUS_METERS} m of a road and
          250 m of the center).
        </p>
      </div>
      <form onSubmit={findRoadPoint} noValidate className="flex flex-col gap-2">
        <p className={styles.recordText}>Or enter the entrance coordinates:</p>
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
          <p role="alert" className={styles.error}>
            {coordinateError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className={styles.button}>
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
        <p role="alert" className={styles.error}>
          This point is more than 250 m from the center&apos;s pin. Move the center on the Evacuation Centers page first.
        </p>
      ) : null}
      <div className={styles.actions}>
        <button
          type="button"
          onClick={onSave}
          disabled={!candidate || saving || tooFar}
          className={styles.primaryButton}
          aria-busy={saving}>
          <LoadingButtonContent pending={saving} pendingLabel="Saving…">
            Save entrance
          </LoadingButtonContent>
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className={styles.button}>
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
