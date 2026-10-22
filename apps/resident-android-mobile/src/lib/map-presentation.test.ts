import { describe, expect, it } from 'vitest';
import { isMapPosition, readMapMessage } from './map-presentation';

describe('Android-local map message boundary', () => {
  it('keeps marker, background, picker and routing events distinct', () => {
    for (const message of [
      { type: 'BACKGROUND_TAPPED' }, { type: 'MARKER_TAPPED', payload: { markerId: 'incident' } },
      { type: 'PICKER_MOVED', payload: { lat: 14.68, lng: 121.12 } },
      { type: 'MAP_TAPPED', payload: { lat: 14.68, lng: 121.12 } },
      { type: 'MAP_MOVED', payload: { center: { lat: 14.68, lng: 121.12 }, zoom: 17 } },
      { type: 'MAP_READY' }, { type: 'MAP_ERROR' },
    ]) expect(readMapMessage(JSON.stringify(message))).toEqual(message);
  });
  it('rejects malformed and unknown native messages without dispatching them', () => {
    for (const value of ['{', 'null', '[]', '{}', '{"type":"UNKNOWN"}',
      '{"type":"MARKER_TAPPED","payload":null}', '{"type":"MARKER_TAPPED","payload":{"markerId":42}}',
      '{"type":"PICKER_MOVED","payload":{"lat":121,"lng":14}}',
      '{"type":"MAP_TAPPED","payload":{"lat":"14","lng":121}}',
      '{"type":"MAP_MOVED","payload":{"center":{"lat":14,"lng":121},"zoom":null}}',
    ]) expect(readMapMessage(value)).toBeNull();
  });
  it('preserves latitude/longitude order and validates finite coordinate bounds', () => {
    expect(isMapPosition({ lat: 14.68, lng: 121.12 })).toBe(true);
    expect(isMapPosition({ lat: -90, lng: 180 })).toBe(true);
    for (const position of [null, { lat: NaN, lng: 121 }, { lat: 14, lng: Infinity },
      { lat: 91, lng: 0 }, { lat: 0, lng: -181 }, { lat: 121.12, lng: 14.68 }]) expect(isMapPosition(position)).toBe(false);
  });
});
