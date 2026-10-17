import type { LatLng, MapMarker } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Action, Notice } from '../../components/ui';
import { radius, space, useColors } from '../../lib/theme';
import { boundaryCenter, deliver, mapHtml, parseMapMessage } from '../profile/location-map';

const MAP_HEIGHT = 340;

export type UserFix = { position: LatLng; accuracyMeters: number | null; pending: boolean };
export type MapFocus = { point: LatLng; nonce: number };

/**
 * The discovery map: the bundled Leaflet page in a locked-down WebView (no navigation, validated
 * bridge messages only). It is a visual aid; the list beside it carries every record, so nothing
 * depends on the markers alone. `frame` bumps to refit the boundary and markers.
 */
export function DiscoveryMap({ boundary, markers, kindColors, user, tiles, focus, frame, route = null, onMarker }: {
  boundary: Polygon | MultiPolygon | null; markers: MapMarker[]; kindColors: Record<string, string>; user: UserFix | null; tiles: boolean;
  focus: MapFocus | null; frame: number; /** A walking route the service computed; never a straight line between two points. */ route?: LatLng[] | null; onMarker: (id: string) => void;
}) {
  const colors = useColors();
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [generation, setGeneration] = useState(0);
  const html = useMemo(() => mapHtml({ tiles }), [tiles]);
  const center = useMemo(() => (boundary ? boundaryCenter(boundary) : null), [boundary]);

  useEffect(() => { if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_BOUNDARY', payload: { geometry: boundary } })); }, [ready, boundary]);
  useEffect(() => { if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_MARKERS', payload: { markers, kindColors } })); }, [ready, markers, kindColors]);
  useEffect(() => {
    if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_USER_LOCATION', payload: user ? { position: user.position, accuracyMeters: user.accuracyMeters, pending: user.pending } : null }));
  }, [ready, user]);
  useEffect(() => { if (ready && focus) ref.current?.injectJavaScript(deliver({ type: 'SET_VIEW', payload: { ...focus.point, zoom: 17 } })); }, [ready, focus]);
  useEffect(() => { if (ready) ref.current?.injectJavaScript(deliver(route && route.length >= 2 ? { type: 'DRAW_ROUTE', payload: { points: route } } : { type: 'CLEAR_ROUTE' })); }, [ready, route]);
  useEffect(() => { if (ready && frame > 0) ref.current?.injectJavaScript(deliver({ type: 'FIT_ALL' })); }, [ready, frame]);
  useEffect(() => { if (ready && !boundary && center) ref.current?.injectJavaScript(deliver({ type: 'SET_VIEW', payload: { ...center, zoom: 16 } })); }, [ready, boundary, center]);
  useEffect(() => { if (ready) ref.current?.injectJavaScript(deliver({ type: 'SET_TILES', payload: { enabled: tiles } })); }, [ready, tiles]);

  function onMessage(event: WebViewMessageEvent) {
    const message = parseMapMessage(event.nativeEvent.data);
    if (!message) return;
    if (message.type === 'ready') { setReady(true); setFailed(false); }
    else if (message.type === 'error') setFailed(true);
    else if (message.type === 'marker') onMarker(message.id);
  }
  if (failed) {
    return <View style={{ gap: space[2] }}>
      <Notice tone="danger" message="The map could not be shown. The list below has the same places." />
      <Action label="Reload map" secondary onPress={() => { setReady(false); setFailed(false); setGeneration((value) => value + 1); }} />
    </View>;
  }
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: MAP_HEIGHT, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: colors.border }}>
    <WebView key={generation} ref={ref} originWhitelist={['about:blank']} source={{ html }} onMessage={onMessage}
      onShouldStartLoadWithRequest={(request) => request.url === 'about:blank'}
      onError={() => setFailed(true)} onContentProcessDidTerminate={() => { setReady(false); setGeneration((value) => value + 1); }}
      javaScriptEnabled domStorageEnabled={false} incognito cacheEnabled={false} allowsLinkPreview={false} setSupportMultipleWindows={false}
      scrollEnabled={false} bounces={false} />
  </View>;
}
