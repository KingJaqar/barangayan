import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function PaymentMethodRow({ label, description, icon, disabled, onPress }: {
  label: string;
  description: string;
  icon: 'cash-outline' | 'qr-code-outline';
  disabled: boolean;
  onPress: () => void;
}) {
  const { resident } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}. ${description}`}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.row, { backgroundColor: pressed ? resident.pressed : resident.card, borderColor: resident.border }]}>
    <View style={[styles.icon, { backgroundColor: disabled ? resident.surface : resident.accent }]}>
      <Ionicons name={icon} size={22} color={disabled ? resident.muted : resident.onAccent} accessible={false} />
    </View>
    <View style={styles.copy}>
      <ThemedText style={{ fontSize: 15.5, lineHeight: 21, fontWeight: '700', color: disabled ? resident.muted : resident.text }}>{label}</ThemedText>
      <ThemedText style={{ fontSize: 12.5, lineHeight: 16, color: resident.muted }}>{description}</ThemedText>
    </View>
    {!disabled ? <Ionicons name="chevron-forward" size={20} color={resident.muted} accessible={false} /> : null}
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderTopWidth: 1, minHeight: 88 },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
});
