import { Host, Slider } from '@expo/ui';
import { accessibilityLabel, accessibilityValue } from '@expo/ui/swift-ui/modifiers';
import { useMemo, useState } from 'react';
import { PanResponder, Text, View, useColorScheme, type GestureResponderEvent } from 'react-native';
import { Action, Body, confirmDestructive, Field, Notice, Sheet } from '../../components/ui';
import { hexToHsv, hsvToHex, isValidHex, type Hsv } from '../../lib/color-math';
import { derivePalette } from '../../lib/palette';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { useLatest } from '../../lib/use-latest';
import { COLOR_PROBLEM_COPY, MAX_CUSTOM_COLORS, type ColorProblem } from './preferences';

const SQUARE = 240;
const HUE_STOPS = '#FF0000, #FFFF00, #00FF00, #00FFFF, #0000FF, #FF00FF, #FF0000';
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const percent = (value: number) => Math.round(value * 100);

/** Labeled native slider; VoiceOver reads the label and the current value and can adjust it. */
function LabeledSlider({ label, value, min, max, valueText, onChange }: { label: string; value: number; min: number; max: number; valueText: string; onChange: (value: number) => void }) {
  const colors = useColors();
  const type = useType();
  return <View style={{ gap: space[1] }}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={[type.subheadline, { color: colors.textPrimary, fontWeight: '600' }]}>{label}</Text>
      <Text style={[type.subheadline, { color: colors.textSecondary }]}>{valueText}</Text>
    </View>
    <Host matchContents={{ vertical: true }} seedColor={colors.primary} style={{ minHeight: layout.controlMin, width: '100%' }}>
      <Slider value={value} min={min} max={max} step={1} onValueChange={onChange} modifiers={[accessibilityLabel(label), accessibilityValue(valueText)]} />
    </Host>
  </View>;
}

/**
 * Hue slider plus a saturation/brightness square. The square is dragged by touch; every control
 * also has a non-gesture equivalent (the three sliders, VoiceOver adjust actions and the hex
 * field in the sheet), so no color needs a drag.
 */
export function ColorPicker({ hsv, onChange }: { hsv: Hsv; onChange: (next: Hsv) => void }) {
  const colors = useColors();
  const latest = useLatest({ hsv, onChange });
  const responder = useMemo(() => {
    const update = (event: GestureResponderEvent) => {
      const { x, y } = { x: event.nativeEvent.locationX, y: event.nativeEvent.locationY };
      const { hsv: current, onChange: emit } = latest.current;
      emit({ h: current.h, s: clamp(x / SQUARE, 0, 1), v: clamp(1 - y / SQUARE, 0, 1) });
    };
    return PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderGrant: update, onPanResponderMove: update });
  }, [latest]);
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);
  const nudge = (change: Partial<Hsv>) => onChange({ ...hsv, ...change });
  const step = (value: number, delta: number) => clamp(Math.round((value + delta) * 20) / 20, 0, 1);
  return <View style={{ gap: space[4], alignItems: 'center' }}>
    <View accessible accessibilityRole="adjustable" accessibilityLabel="Saturation and brightness" accessibilityHint="Swipe up or down to change brightness. Use the actions rotor for saturation."
      accessibilityValue={{ text: `Saturation ${percent(hsv.s)} percent, brightness ${percent(hsv.v)} percent` }}
      accessibilityActions={[
        { name: 'increment', label: 'Brighter' }, { name: 'decrement', label: 'Darker' },
        { name: 'saturationUp', label: 'More saturated' }, { name: 'saturationDown', label: 'Less saturated' },
      ]}
      onAccessibilityAction={(event) => {
        const name = event.nativeEvent.actionName;
        if (name === 'increment') nudge({ v: step(hsv.v, 0.05) });
        else if (name === 'decrement') nudge({ v: step(hsv.v, -0.05) });
        else if (name === 'saturationUp') nudge({ s: step(hsv.s, 0.05) });
        else if (name === 'saturationDown') nudge({ s: step(hsv.s, -0.05) });
      }}
      style={{ width: SQUARE, height: SQUARE, borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: pure, borderWidth: 1, borderColor: colors.border }}
      {...responder.panHandlers}>
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'linear-gradient(to right, #FFFFFF, rgba(255,255,255,0))' }} />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, experimental_backgroundImage: 'linear-gradient(to bottom, rgba(0,0,0,0), #000000)' }} />
      <View pointerEvents="none" style={{ position: 'absolute', left: hsv.s * SQUARE - 11, top: (1 - hsv.v) * SQUARE - 11, width: 22, height: 22, borderRadius: 11, borderWidth: 3, borderColor: '#FFFFFF', backgroundColor: current }} />
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: '100%', height: 10, borderRadius: 5, experimental_backgroundImage: `linear-gradient(to right, ${HUE_STOPS})` }} />
    <View style={{ width: '100%', gap: space[2] }}>
      <LabeledSlider label="Hue" value={Math.round(hsv.h)} min={0} max={360} valueText={`${Math.round(hsv.h)} degrees`} onChange={(h) => onChange({ ...hsv, h })} />
      <LabeledSlider label="Saturation" value={percent(hsv.s)} min={0} max={100} valueText={`${percent(hsv.s)} percent`} onChange={(s) => onChange({ ...hsv, s: s / 100 })} />
      <LabeledSlider label="Brightness" value={percent(hsv.v)} min={0} max={100} valueText={`${percent(hsv.v)} percent`} onChange={(v) => onChange({ ...hsv, v: v / 100 })} />
    </View>
  </View>;
}

function PickerBody({ initial, savedCount, onSave, onCancel, onDirty }: { initial: string; savedCount: number; onSave: (color: string) => ColorProblem | null; onCancel: () => void; onDirty: (dirty: boolean) => void }) {
  const colors = useColors();
  const type = useType();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const [hsv, setHsv] = useState(() => hexToHsv(initial));
  const [draft, setDraft] = useState<string | null>(null);
  const [problem, setProblem] = useState<ColorProblem | null>(null);
  const hex = hsvToHex(hsv);
  const typed = draft === null ? null : draft.startsWith('#') ? draft : `#${draft}`;
  const invalid = typed !== null && !isValidHex(typed);
  const adjusted = derivePalette(scheme, hex).primary.toLowerCase() !== hex.toLowerCase();
  const atLimit = savedCount >= MAX_CUSTOM_COLORS;

  function change(next: Hsv) {
    setHsv(next); setDraft(null); setProblem(null); onDirty(true);
  }
  function edit(text: string) {
    const value = text.trim();
    setDraft(value); setProblem(null); onDirty(true);
    const candidate = value.startsWith('#') ? value : `#${value}`;
    if (isValidHex(candidate)) setHsv(hexToHsv(candidate));
  }
  return <View style={{ gap: space[4] }}>
    <Body tone="secondary">Choose any color for buttons and highlights. {savedCount} of {MAX_CUSTOM_COLORS} custom colors saved.</Body>
    <ColorPicker hsv={hsv} onChange={change} />
    <View accessible accessibilityLabel={`Preview ${hex}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: hex, borderWidth: 1, borderColor: colors.border }} />
      <Text style={[type.headline, { color: colors.textPrimary }]}>{hex}</Text>
    </View>
    {adjusted && <Body tone="secondary" role="footnote">This color is shown slightly {scheme === 'dark' ? 'lighter' : 'darker'} in the app so text on it stays readable. Your saved color does not change.</Body>}
    <Field label="Hex color" value={draft ?? hex} onChangeText={edit} onBlur={() => setDraft(null)} autoCapitalize="characters" maxLength={7}
      error={invalid ? COLOR_PROBLEM_COPY.invalid : undefined} placeholder="#0F6E5B" />
    {atLimit && <Notice tone="danger" message={COLOR_PROBLEM_COPY.limit} />}
    {problem && <Notice tone="danger" message={COLOR_PROBLEM_COPY[problem]} />}
    <Action label="Save color" disabled={invalid || atLimit} hint="Saves this color and uses it as your accent" onPress={() => {
      const result = onSave(hex);
      if (result) setProblem(result);
    }} />
    <Action label="Cancel" secondary onPress={onCancel} />
  </View>;
}

/** Custom accent color sheet. Closing with an unsaved pick asks before discarding it. */
export function CustomColorSheet({ visible, initial, savedCount, onSave, onClose }: { visible: boolean; initial: string; savedCount: number; onSave: (color: string) => ColorProblem | null; onClose: () => void }) {
  const [dirty, setDirty] = useState(false);
  function finish() {
    setDirty(false);
    onClose();
  }
  async function requestClose() {
    if (dirty && !(await confirmDestructive({ title: 'Discard this color?', message: 'The color you picked has not been saved.', confirmLabel: 'Discard color' }))) return;
    finish();
  }
  return <Sheet visible={visible} title="Custom accent color" swipeDismiss={!dirty} onClose={() => void requestClose()}>
    {visible && <PickerBody initial={initial} savedCount={savedCount} onDirty={setDirty} onCancel={() => void requestClose()}
      onSave={(color) => {
        const problem = onSave(color);
        if (!problem) finish();
        return problem;
      }} />}
  </Sheet>;
}
