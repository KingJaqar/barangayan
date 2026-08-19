import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface HotlineNumber {
  label: string;
  number: string;
}

export interface HotlineRowProps {
  name: string;
  numbers: HotlineNumber[];
  icon: string;
  iconColor: string;
  iconBg: string;
}

export function HotlineRow({ name, numbers, icon, iconColor, iconBg }: HotlineRowProps) {
  const theme = useTheme();
  const primaryNumber = numbers[0]?.number ?? '';

  function handleCall() {
    if (primaryNumber) {
      Linking.openURL(`tel:${primaryNumber}`);
    }
  }

  return (
    <View style={[styles.row, styles.rowBorder, { borderBottomColor: theme.backgroundSelected }]}>
      <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
        <Ionicons name={icon as any} size={20} color={iconColor} />
      </View>
      <View style={styles.infoColumn}>
        <ThemedText type="smallBold" style={styles.nameText}>
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.numberText}>
          {numbers.map((n) => n.label).join(' / ')}
        </ThemedText>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Call ${name}`}
        onPress={handleCall}
        style={styles.callButton}
        hitSlop={Spacing.one}
      >
        <Ionicons name="call-outline" size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  rowBorder: {
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoColumn: {
    flex: 1,
    gap: 2,
  },
  nameText: {
    fontSize: 14,
    fontWeight: '600',
  },
  numberText: {
    fontSize: 13,
  },
  callButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
});