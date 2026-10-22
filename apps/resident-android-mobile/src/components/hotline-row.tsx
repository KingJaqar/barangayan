import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { DrrmIconTile } from '@/components/drrm/presentation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface HotlineNumber { label: string; number: string }
export interface HotlineRowProps {
  name: string;
  numbers: HotlineNumber[];
  icon: string;
  iconColor: string;
  iconBg: string;
}

export function HotlineRow({ name, numbers, icon, iconColor, iconBg }: HotlineRowProps) {
  const { resident } = useTheme();
  const pending = useRef(false);
  const mounted = useRef(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const primaryNumber = numbers[0]?.number.trim() ?? '';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function handleCall() {
    if (pending.current || !primaryNumber) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try { await Linking.openURL(`tel:${primaryNumber}`); }
    catch { if (mounted.current) setError(true); }
    finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <View>
    <View style={styles.row}>
      <DrrmIconTile icon={icon} color={iconColor} background={iconBg} />
      <View style={styles.info}>
        <ThemedText style={[styles.name, { color: resident.text }]}>{name}</ThemedText>
        <ThemedText style={[styles.number, { color: resident.muted }]}>{numbers.map(n => n.label || n.number).join(' / ') || 'No phone number available.'}</ThemedText>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Call ${name}`}
        accessibilityState={{ disabled: !primaryNumber || busy, busy }} disabled={!primaryNumber || busy}
        onPress={handleCall} style={({ pressed }) => [styles.call, {
          backgroundColor: !primaryNumber || busy ? resident.surface : resident.callFill,
          borderColor: resident.callNeedsOutline ? resident.controlBorder : resident.callFill, opacity: pressed ? 0.8 : 1,
        }]}>
        <Ionicons name="call-outline" size={20} color={!primaryNumber || busy ? resident.muted : resident.onCallFill} accessible={false} />
      </Pressable>
    </View>
    {error ? <ThemedText accessibilityRole="alert" style={[styles.error, { color: resident.danger }]}>Could not open the phone app. Dial {primaryNumber} manually or try again.</ThemedText> : null}
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, gap: 10 },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  number: { fontSize: 13, lineHeight: 18 },
  call: { width: 44, height: 44, borderWidth: 1, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  error: { paddingHorizontal: 16, paddingBottom: 14, fontSize: 13, lineHeight: 19 },
});
