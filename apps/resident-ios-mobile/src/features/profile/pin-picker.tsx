import { isPointInPolygon, type LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Action, Body, Notice } from '../../components/ui';
import { useLatest } from '../../lib/use-latest';
import { radius, space, useColors } from '../../lib/theme';
import { boundaryCenter, deliver, mapHtml, nudge, parseMapMessage, type Direction } from './location-map';

const MAP_HEIGHT = 320;
const DIRECTIONS: { direction: Direction; label: string }[] = [
  { direction: 'north', label: 'Move pin north' }, { direction: 'south', label: 'Move pin south' },
  { direction: 'west', label: 'Move pin west' }, { direction: 'east', label: 'Move pin east' },
];

type Boundary = Polygon | MultiPolygon | null;
export type Placement = {
  /** Accepts a point only inside the boundary; a refused point leaves the pin where it was. */
  place: (point: LatLng) => boolean;
  /** True after the latest attempt was refused. */
  refused: 'outside' | 'no-boundary' | null;
  /** Bumped on every refusal so the map pin snaps back. */
  snap: number;
  clear: () => void;
};

/** Boundary-checked pin placement shared by the Settings location screen and the registration home pin. */
export function usePinPlacement(boundary: Boundary, onAccept: (point: LatLng) => void): Placement {
  const [refused, setRefused] = useState<Placement['refused']>(null);
  const [snap, setSnap] = useState(0);
  return {
    refused, snap,
    clear: () => setRefused(null),
    place(point) {
      if (!boundary) { setRefused('no-boundary'); setSnap((value) => value + 1); return false; }
      if (!isPointInPolygon(point, boundary)) { setRefused('outside'); setSnap((value) => value + 1); return false; }
      setRefused(null);
      onAccept(point);
      return true;
    },
  };
}

/** The map, a plain-language hint, the refusal message and accessible buttons that move the pin in small steps. */
export function PinPicker({ boundary, position, placement, tiles, areaName, disabled = false }: {
  boundary: Boundary; position: LatLng | null; placement: Placement; tiles: boolean; areaName: string; disabled?: boolean;
}) {
  return <View style={{ gap: space[3] }}>
    <LocationMap boundary={boundary} position={position} snap={placement.snap} tiles={tiles} center={boundary ? boundaryCenter(boundary) : null} onPin={placement.place} />
    <Body role="footnote" tone="secondary">Tap the map or drag the pin. If you cannot use the map, use the buttons below to move the pin in small steps.</Body>
    {placement.refused === 'outside' && <Notice tone="danger" message={`That spot is outside ${areaName}'s boundary. Place the pin inside the outlined area.`} />}
    {placement.refused === 'no-boundary' && <Notice tone="danger" message="Your barangay boundary is not available yet, so the pin cannot be placed." />}
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {DIRECTIONS.map(({ direction, label }) => <View key={direction} style={{ minWidth: '45%', flexGrow: 1 }}>
        <Action label={label} secondary disabled={!position || disabled} onPress={() => { if (position) placement.place(nudge(position, direction)); }} />
      </View>)}
    </View>
    {position && <Body role="footnote" tone="secondary">{`Pin at ${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}`}</Body>}
  </View>;
}

/**
 * Bundled-Leaflet map in a locked-down WebView: no external navigation, validated bridge messages only.
 * `readOnly` shows the pin without letting it be moved; `recenter` flies back to the pin each time it changes.
 */
export function LocationMap({ boundary, position, snap = 0, center, tiles, onPin, readOnly = false, recenter = 0, label = 'Map of your barangay with a draggable pin' }: {
  boundary: Boundary; position: LatLng | null; snap?: number; center: LatLng | null; tiles: boolean; onPin?: (point: LatLng) => void;
  readOnly?: boolean; recenter?: number; label?: string;
}) {
  const colors = useColors();
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);
  const html = useMemo(() => mapHtml({ tiles }), [tiles]);

  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_BOUNDARY', payload: { geometry: boundary } }));
  }, [ready, boundary]);
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_PICKER', payload: { enabled: !readOnly, position } }));
  }, [ready, position, snap, readOnly]);
  const pinned = useLatest(position);
  useEffect(() => {
    const point = pinned.current;
    if (ready && recenter > 0 && point) ref.current?.injectJavaScript(deliver({ type: 'SET_VIEW', payload: { lat: point.lat, lng: point.lng, zoom: 17 } }));
  }, [ready, recenter, pinned]);
  useEffect(() => {
    if (ready && !boundary && center) ref.current?.injectJavaScript(deliver({ type: 'SET_VIEW', payload: { ...center, zoom: 16 } }));
  }, [ready, boundary, center]);
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_TILES', payload: { enabled: tiles } }));
  }, [ready, tiles]);

  function onMessage(event: WebViewMessageEvent) {
    const message = parseMapMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'ready') { setReady(true); setFailed(false); }
    else if (message.type === 'error') setFailed(true);
    else if (message.type === 'pin' && !readOnly) onPin?.(message.point);
  }
  if (failed) {
    return <View style={{ gap: space[2] }}>
      <Notice tone="danger" message={readOnly ? "The map could not be shown. The address and coordinates are shown below." : "The map could not be shown. You can still place the pin with the buttons below."} />
      <Action label="Reload map" secondary onPress={() => { setReady(false); setFailed(false); setGeneration((value) => value + 1); }} />
    </View>;
  }
  return <View accessible={false} accessibilityLabel={label}
    style={{ height: MAP_HEIGHT, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
    <WebView key={generation} ref={ref} originWhitelist={['about:blank']} source={{ html }} onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
      onError={() => setFailed(true)} onContentProcessDidTerminate={() => { setReady(false); setGeneration((value) => value + 1); }}
      javaScriptEnabled domStorageEnabled={false} incognito cacheEnabled={false} allowsLinkPreview={false} setSupportMultipleWindows={false}
      scrollEnabled={false} bounces={false} />
  </View>;
}
