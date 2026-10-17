'use client';

import type { LatLng, RoutingConditionsSnapshot, RoutingPackEditorGraph } from '@barangayan/shared';
import L, { type LatLngTuple, type LeafletEventHandlerFnMap, type PathOptions } from 'leaflet';
import { memo, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { MapPin, MousePointer2 } from 'lucide-react';
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';

import type { PackNode } from '@/lib/routing-packs';
import { Spinner } from '@/components/loading/spinner';
import { MapViewportControls } from '../incident-map/MapViewportControls';
import mapStyles from '../incident-map/incident-map.module.css';

import styles from './routing.module.css';

type PackEdge = RoutingPackEditorGraph['edges'][number];

interface RoutingMapProps {
  areaName: string;
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

const MAP_COLOR_NAMES = ['road', 'selected', 'closed', 'center', 'entrance', 'coverage'] as const;
type MapColors = Record<(typeof MAP_COLOR_NAMES)[number], string>;

function subscribeToMotion(callback: () => void) {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
}
const readReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Canvas cannot draw CSS variables directly. Resolve the saved theme and keep it live. */
function useMapColors() {
  const element = useRef<HTMLDivElement>(null);
  const [colors, setColors] = useState<MapColors | null>(null);
  useEffect(() => {
    let disposed = false;
    const readColors = () => {
      if (disposed || !element.current) return;
      const probe = document.createElement('span');
      probe.hidden = true;
      element.current.append(probe);
      const resolved = {} as MapColors;
      for (const name of MAP_COLOR_NAMES) {
        probe.style.color = `var(--routing-map-${name})`;
        resolved[name] = getComputedStyle(probe).color;
      }
      probe.remove();
      setColors(resolved);
    };
    queueMicrotask(readColors);
    const observer = new MutationObserver(readColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });
    return () => { disposed = true; observer.disconnect(); };
  }, []);
  return { element, colors };
}

function toLatLngs(geometry: readonly (readonly [number, number])[]): LatLngTuple[] {
  return geometry.map(([lng, lat]) => [lat, lng]);
}

function FitCoverage({ coverage }: { coverage: LatLngTuple[][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  useEffect(() => {
    if (fitted.current || coverage.length === 0) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(coverage.flat()).pad(0.05), {
      paddingTopLeft: [24, 100], paddingBottomRight: [80, 80], animate: false,
    });
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
  areaName,
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
  const { element, colors } = useMapColors();
  const reducedMotion = useSyncExternalStore(subscribeToMotion, readReducedMotion, () => false);
  const [tilesLoading, setTilesLoading] = useState(true);
  const tileEvents = useMemo(() => ({ loading: () => setTilesLoading(true), load: () => setTilesLoading(false) }), []);
  const palette = useMemo(() => colors ? {
    road: { color: colors.road, weight: 3, opacity: 0.75 },
    selected: { color: colors.selected, weight: 7, opacity: 0.95 },
    closed: { color: colors.closed, weight: 6, opacity: 0.95 },
  } satisfies Record<string, PathOptions> : null, [colors]);
  // Canvas rendering with a click tolerance keeps ~1,000 thin road lines selectable.
  const renderer = useMemo(() => L.canvas({ tolerance: 6 }), []);
  const coverage = useMemo(() => graph.coverage.map(toLatLngs), [graph.coverage]);
  const coverageBoundary = useMemo<GeoJSON.MultiPolygon>(() => ({
    type: 'MultiPolygon',
    coordinates: graph.coverage.map((ring) => [ring.map(([lng, lat]) => [lng, lat])]),
  }), [graph.coverage]);

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
    <div ref={element} className={`${mapStyles.workspace} ${styles.map}`} role="region" aria-label="Evacuation routing map">
      <div className={`${mapStyles.mapFrame} ${styles.mapFrame}`}>
        {colors && palette ? <MapContainer className={mapStyles.map} center={[14.6803, 121.1187]} zoom={16} renderer={renderer} preferCanvas
          fadeAnimation={!reducedMotion} zoomAnimation={!reducedMotion}>
          <TileLayer
            attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · Routing data: ${attribution}`}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
            eventHandlers={tileEvents}
          />
          <FitCoverage coverage={coverage} />
          <MapViewportControls viewport={element} boundary={coverageBoundary} boundaryLabel="Show whole routing coverage"
            markers={[]} defaultCenter={{ lat: 14.6803, lng: 121.1187 }} defaultZoom={16} />
          <MapClicks onClick={(point) => entranceMode && onMapClick(point)} />
          <Polygon positions={coverage} pathOptions={{ color: colors.coverage, weight: 1, dashArray: '4 4', fillOpacity: 0.03 }} interactive={false} />

          {graph.edges.map((edge) => (
            <EdgeLine
              key={edge.id}
              edge={edge}
              style={closedEdgeIds.has(edge.id) ? palette.closed : selectedEdgeIds.has(edge.id) ? palette.selected : palette.road}
              handlers={handlers.get(edge.id) ?? {}}
            />
          ))}

          {unmappedClosureLines.map((line, index) => (
            <Polyline key={`unmapped-${index}`} positions={line} pathOptions={{ ...palette.closed, dashArray: '6 6' }} interactive={false} />
          ))}

          {centers.flatMap((center) =>
            center.position
              ? [
                  <CircleMarker
                    key={center.id}
                    center={[center.position.lat, center.position.lng]}
                    radius={9}
                    pathOptions={{ color: colors.center, fillColor: colors.center, fillOpacity: 0.9, weight: 2 }}
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
                    pathOptions={{ color: colors.entrance, fillColor: colors.entrance, fillOpacity: 1, weight: 2 }}
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
              pathOptions={{ color: colors.selected, fillColor: colors.selected, fillOpacity: 1, weight: 2 }}
              interactive={false}
            />
          ) : null}
        </MapContainer> : null}
        <div className={styles.mapContext} data-map-controls>
          <div className={styles.mapLocation}><MapPin size={15} aria-hidden="true" /> {areaName}</div>
          <div className={styles.mapMode}><MousePointer2 size={14} aria-hidden="true" />
            {entranceMode ? 'Choose an entrance' : editable ? 'Road conditions' : 'Road network preview'}
          </div>
          {entranceMode ? <p className={styles.mapInstruction}>Click near a road to pick the entrance</p> : null}
        </div>
        <div className={styles.legend} aria-label="Map legend">
          <span><i aria-hidden="true" /> Closed</span>
          <span><i className={styles.selectedKey} aria-hidden="true" /> Selected</span>
          <span><i className={styles.centerKey} aria-hidden="true" /> Center</span>
          <span><i className={styles.entranceKey} aria-hidden="true" /> Entrance</span>
        </div>
        <div className={`${mapStyles.mapActivity} ${styles.mapLoading}`} data-active={tilesLoading || undefined} role="status" aria-live="polite">
          {tilesLoading && <><Spinner /> Loading map…</>}
        </div>
      </div>
    </div>
  );
}
