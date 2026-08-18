import { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Spacing } from '@/constants/theme';
import { hexToHsv, hsvToHex, type HSV } from '@/lib/color-utils';

const SV_SIZE = 220;
const HUE_HEIGHT = 24;
const THUMB_SIZE = 22;

const HUE_STOPS = [
  { offset: '0%', color: '#FF0000' },
  { offset: '16.66%', color: '#FFFF00' },
  { offset: '33.33%', color: '#00FF00' },
  { offset: '50%', color: '#00FFFF' },
  { offset: '66.66%', color: '#0000FF' },
  { offset: '83.33%', color: '#FF00FF' },
  { offset: '100%', color: '#FF0000' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
}

/** Visual saturation/value square + hue slider, replacing free-typed hex entry for picking
 * a custom accent color. No external color-picker dependency — built on react-native-svg
 * (already pulled in via react-native-qrcode-svg) for the gradients, and PanResponder for
 * dragging, both already used elsewhere in this app's dependency tree. */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hsv, setHsv] = useState<HSV>(() => hexToHsv(value));
  const hueRef = useRef(hsv.h);
  hueRef.current = hsv.h;

  function updateFromSv(x: number, y: number) {
    const s = clamp(x / SV_SIZE, 0, 1);
    const v = clamp(1 - y / SV_SIZE, 0, 1);
    const next = { h: hueRef.current, s, v };
    setHsv(next);
    onChange(hsvToHex(next));
  }

  function updateFromHue(x: number) {
    const h = clamp((x / SV_SIZE) * 360, 0, 360);
    setHsv((prev) => {
      const next = { ...prev, h };
      onChange(hsvToHex(next));
      return next;
    });
  }

  const svResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => updateFromSv(e.nativeEvent.locationX, e.nativeEvent.locationY),
        onPanResponderMove: (e: GestureResponderEvent) => updateFromSv(e.nativeEvent.locationX, e.nativeEvent.locationY),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const hueResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e: GestureResponderEvent) => updateFromHue(e.nativeEvent.locationX),
        onPanResponderMove: (e: GestureResponderEvent) => updateFromHue(e.nativeEvent.locationX),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const thumbX = clamp(hsv.s * SV_SIZE, 0, SV_SIZE) - THUMB_SIZE / 2;
  const thumbY = clamp((1 - hsv.v) * SV_SIZE, 0, SV_SIZE) - THUMB_SIZE / 2;
  const hueThumbX = clamp((hsv.h / 360) * SV_SIZE, 0, SV_SIZE) - THUMB_SIZE / 2.5;

  return (
    <View style={styles.container}>
      <View style={styles.svBox} {...svResponder.panHandlers}>
        <Svg width={SV_SIZE} height={SV_SIZE}>
          <Defs>
            <LinearGradient id="saturation" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor="#ffffff" stopOpacity={1} />
              <Stop offset="100%" stopColor={hueColor} stopOpacity={1} />
            </LinearGradient>
            <LinearGradient id="value" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#000000" stopOpacity={0} />
              <Stop offset="100%" stopColor="#000000" stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SV_SIZE} height={SV_SIZE} fill="url(#saturation)" />
          <Rect x={0} y={0} width={SV_SIZE} height={SV_SIZE} fill="url(#value)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.thumb,
            { left: thumbX, top: thumbY, backgroundColor: hsvToHex(hsv), width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: THUMB_SIZE / 2 },
          ]}
        />
      </View>

      <View style={styles.hueBox} {...hueResponder.panHandlers}>
        <Svg width={SV_SIZE} height={HUE_HEIGHT}>
          <Defs>
            <LinearGradient id="hue" x1="0" y1="0" x2="1" y2="0">
              {HUE_STOPS.map((stop) => (
                <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} stopOpacity={1} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={SV_SIZE} height={HUE_HEIGHT} rx={HUE_HEIGHT / 2} fill="url(#hue)" />
        </Svg>
        <View
          pointerEvents="none"
          style={[
            styles.hueThumb,
            { left: hueThumbX, backgroundColor: hueColor },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  svBox: {
    width: SV_SIZE,
    height: SV_SIZE,
    borderRadius: 16,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  hueBox: {
    width: SV_SIZE,
    height: HUE_HEIGHT,
    justifyContent: 'center',
  },
  hueThumb: {
    position: 'absolute',
    width: HUE_HEIGHT / 1.2,
    height: HUE_HEIGHT / 1.2,
    borderRadius: HUE_HEIGHT / 2,
    borderWidth: 3,
    borderColor: '#ffffff',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});
