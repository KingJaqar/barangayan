'use client';

import type { LatLng, RoutingConditionsSnapshot, RoutingPackEditorGraph } from '@barangayan/shared';
import L, { type LatLngTuple, type LeafletEventHandlerFnMap, type PathOptions } from 'leaflet';
import { memo, useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import type { PackNode } from '@/lib/routing-packs';

type PackEdge = RoutingPackEditorGraph['edges'][number];

interface RoutingMapProps {
  graph: RoutingPackEditorGraph;
  attribution: string;
  closures: RoutingConditionsSnapshot['closures'];
  closedEdgeIds: ReadonlySet<string>;
  selectedEdgeIds: ReadonlySet<string>;
  onToggleEdge: (edgeId: string) => void;
  centers: RoutingConditionsSnapshot['centers'];
  entranceMode: boolean;
  entranceCandidate: PackNode | null;
  onMapClick: (point: LatLng) => void;
  editable: boolean;
}

const EDGE_STYLE: PathOptions = { color: '#475569', weight: 3, opacity: 0.75 };
const SELECTED_STYLE: PathOptions = { color: '#f97316', weight: 7, opacity: 0.95 };
const CLOSED_STYLE: PathOptions = { color: '#dc2626', weight: 6, opacity: 0.95 };

function toLatLngs(geometry: readonly (readonly [number, number])[]): LatLngTuple[] {
  return geometry.map(([lng, lat]) => [lat, lng]);
}

function FitCoverage({ coverage }: { coverage: LatLngTuple[][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || coverage.length === 0) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(coverage.flat()), { padding: [16, 16] });
  }, [map, coverage]);
  return null;
}

function MapClicks({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({ click: (event) => onClick({ lat: event.latlng.lat, lng: event.latlng.lng }) });
  return null;
}

const EdgeLine = memo(function EdgeLine({ edge, style, handlers }: { edge: PackEdge; style: PathOptions; handlers: LeafletEventHandlerFnMap }) {
  const positions = useMemo(() => toLatLngs(edge.geometry), [edge.geometry]);
  return (
    <Polyline positions={positions} pathOptions={style} eventHandlers={handlers}>
      <Tooltip sticky>{edge.name ?? 'Unnamed way'}{edge.bridge ? ' (bridge)' : ''}{edge.stairs ? ' (stairs)' : ''}</Tooltip>
    </Polyline>
  );
});

export function RoutingMap({
  graph,
  attribution,
  closures,
  closedEdgeIds,
  selectedEdgeIds,
  onToggleEdge,
  centers,
  entranceMode,
  entranceCandidate,
  onMapClick,
  editable,
}: RoutingMapProps) {
  // Canvas rendering with a click tolerance keeps ~1,000 thin road lines selectable.
  const renderer = useMemo(() => L.canvas({ tolerance: 6 }), []);
  const coverage = useMemo(() => graph.coverage.map(toLatLngs), [graph.coverage]);

  // Stable per-edge handlers read the latest callbacks through refs, so a selection
  // change re-styles lines without rebinding a thousand event listeners.
  const latest = useRef({ onToggleEdge, entranceMode, editable });
  useEffect(() => {
    latest.current = { onToggleEdge, entranceMode, editable };
  }, [onToggleEdge, entranceMode, editable]);
  const handlers = useMemo(
    () =>
      new Map<string, LeafletEventHandlerFnMap>(
        graph.edges.map((edge) => [
          edge.id,
          {
            click: (event) => {
              // In entrance mode the click falls through to the map to pick a node.
              if (latest.current.entranceMode || !latest.current.editable) return;
              L.DomEvent.stopPropagation(event);
              latest.current.onToggleEdge(edge.id);
            },
          },
        ]),
      ),
    [graph.edges],
  );

  const unmappedClosureLines = useMemo(
    () => closures.filter((closure) => closure.edgeIds === null).flatMap((closure) => closure.geometry.coordinates.map(toLatLngs)),
    [closures],
  );

  return (
    <div className="relative h-[560px] w-full overflow-hidden rounded-xl">
      <MapContainer className="h-full w-full" center={[14.6803, 121.1187]} zoom={16} renderer={renderer} preferCanvas>
        <TileLayer
          attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Routing data: ${attribution}`}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />
        <FitCoverage coverage={coverage} />
        <MapClicks onClick={(point) => entranceMode && onMapClick(point)} />
        <Polygon positions={coverage} pathOptions={{ color: '#64748b', weight: 1, dashArray: '4 4', fillOpacity: 0.03 }} interactive={false} />

        {graph.edges.map((edge) => (
          <EdgeLine
            key={edge.id}
            edge={edge}
            style={closedEdgeIds.has(edge.id) ? CLOSED_STYLE : selectedEdgeIds.has(edge.id) ? SELECTED_STYLE : EDGE_STYLE}
            handlers={handlers.get(edge.id) ?? {}}
          />
        ))}

        {unmappedClosureLines.map((line, index) => (
          <Polyline key={`unmapped-${index}`} positions={line} pathOptions={{ ...CLOSED_STYLE, dashArray: '6 6' }} interactive={false} />
        ))}

        {centers.flatMap((center) =>
          center.position
            ? [
                <CircleMarker
                  key={center.id}
                  center={[center.position.lat, center.position.lng]}
                  radius={9}
                  pathOptions={{ color: '#047857', fillColor: '#10b981', fillOpacity: 0.9, weight: 2 }}
                  interactive={!entranceMode}>
                  <Tooltip>{center.name}</Tooltip>
                </CircleMarker>,
              ]
            : [],
        )}
        {centers.flatMap((center) =>
          center.entrancePosition
            ? [
                <CircleMarker
                  key={`entrance-${center.id}`}
                  center={[center.entrancePosition.lat, center.entrancePosition.lng]}
                  radius={5}
                  pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
                  interactive={!entranceMode}>
                  <Tooltip>Entrance: {center.name}</Tooltip>
                </CircleMarker>,
              ]
            : [],
        )}
        {entranceCandidate ? (
          <CircleMarker
            center={[entranceCandidate.lat, entranceCandidate.lng]}
            radius={7}
            pathOptions={{ color: '#c2410c', fillColor: '#f97316', fillOpacity: 1, weight: 2 }}
            interactive={false}
          />
        ) : null}
      </MapContainer>
      <div className="pointer-events-none absolute left-3 top-3 z-[400] rounded-lg bg-white/90 px-3 py-2 text-[11px] text-zinc-700 shadow dark:bg-zinc-900/90 dark:text-zinc-200">
        <p><span className="mr-1 inline-block h-1 w-4 bg-[#dc2626] align-middle" /> Closed</p>
        <p><span className="mr-1 inline-block h-1 w-4 bg-[#f97316] align-middle" /> Selected</p>
        <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[#10b981] align-middle" /> Center · <span className="mx-1 inline-block h-2 w-2 rounded-full bg-[#3b82f6] align-middle" /> Entrance</p>
        {entranceMode ? <p className="mt-1 font-semibold">Click near a road to pick the entrance</p> : null}
      </div>
    </div>
  );
}
