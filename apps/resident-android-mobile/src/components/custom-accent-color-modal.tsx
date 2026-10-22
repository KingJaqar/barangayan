import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { ColorPicker } from '@/components/color-picker';
import { PrimaryButton } from '@/components/primary-button';
import { SettingsSheet } from '@/components/settings-sheet';
import { ThemedText } from '@/components/themed-text';
import { getMobileFontFamily } from '@/constants/fonts';
import { getResidentTheme } from '@/constants/resident-theme';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_ACCENT_COLOR, isValidHexColor, MAX_CUSTOM_COLORS, useThemePreference } from '@/hooks/use-theme-preference';

interface CustomAccentColorModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (color: string) => boolean;
  atLimit: boolean;
  initialColor: string;
}

export function CustomAccentColorModal({ visible, onClose, onSave, atLimit, initialColor }: CustomAccentColorModalProps) {
  const { resident } = useTheme();
  const { scheme } = useThemePreference();
  const { fontId } = useFontPreference();
  const [pickedColor, setPickedColor] = useState(DEFAULT_ACCENT_COLOR);
  const [hexText, setHexText] = useState(DEFAULT_ACCENT_COLOR);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!visible) return;
    const initial = isValidHexColor(initialColor) ? initialColor : DEFAULT_ACCENT_COLOR;
    setPickedColor(initial);
    setHexText(initial.toUpperCase());
    setError(null);
  }, [visible, initialColor]);
  const preview = getResidentTheme(scheme, pickedColor);
  function handleSave() {
    if (!isValidHexColor(hexText)) { setError('Enter a six-digit hex color, for example #0F6E5B.'); return; }
    if (atLimit) { setError(`You can save up to ${MAX_CUSTOM_COLORS} custom colors. Remove one to add another.`); return; }
    if (onSave(hexText)) onClose();
    else setError('That color is already saved.');
  }
  return <SettingsSheet visible={visible} title="Custom Accent Color" onClose={onClose} footer={
    <View style={styles.actions}>
      <View style={styles.action}><PrimaryButton presentation="resident" variant="secondary" label="Cancel" onPress={onClose} /></View>
      <View style={styles.action}><PrimaryButton presentation="resident" label="Save Color" disabled={!isValidHexColor(hexText)} onPress={handleSave} /></View>
    </View>
  }>
    <ThemedText style={[styles.subtitle, { color: resident.muted }]}>Drag to pick any color. Up to {MAX_CUSTOM_COLORS} custom colors can be saved.</ThemedText>
    <View style={styles.picker}><ColorPicker value={pickedColor} onChange={hex => { setPickedColor(hex); setHexText(hex.toUpperCase()); setError(null); }} /></View>
    <View style={styles.preview}>
      <View style={[styles.swatch, { backgroundColor: pickedColor, borderColor: preview.accentNeedsOutline ? resident.controlBorder : resident.border }]}>
        <ThemedText style={{ color: preview.onAccent, fontWeight: '700' }}>Aa</ThemedText>
      </View>
      <TextInput accessibilityLabel="Hex color" value={hexText} maxLength={7} autoCapitalize="characters" autoCorrect={false}
        style={[styles.input, { color: resident.text, backgroundColor: resident.surface, borderColor: resident.controlBorder, fontFamily: getMobileFontFamily(fontId) }]}
        onChangeText={value => { const next = (value.startsWith('#') ? value : `#${value}`).toUpperCase(); setHexText(next); setError(null); if (isValidHexColor(next)) setPickedColor(next); }} />
    </View>
    {error ? <ThemedText accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: resident.danger }}>{error}</ThemedText> : null}
  </SettingsSheet>;
}

const styles = StyleSheet.create({
  subtitle: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  picker: { alignItems: 'center', paddingVertical: 8 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 260, width: '100%', alignSelf: 'center' },
  swatch: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, fontSize: 16, fontWeight: '700', letterSpacing: 1 },
  actions: { flexDirection: 'row', gap: 12 },
  action: { flex: 1 },
});
