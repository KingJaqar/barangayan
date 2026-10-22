import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function ServiceScreenHeader({
  title,
  backLabel = 'Go back',
  backIcon = 'chevron-back',
  onBack,
  compact = false,
  singleLine = false,
  presentation = 'resident',
}: {
  title: string;
  backLabel?: string;
  backIcon?: keyof typeof Ionicons.glyphMap;
  onBack?: () => void;
  compact?: boolean;
  singleLine?: boolean;
  presentation?: 'default' | 'resident';
}) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: presentation === 'resident' ? theme.resident.accent : theme.primary, paddingTop: insets.top, paddingLeft: insets.left, paddingRight: insets.right }}>
      <View style={styles.header}>
        <Pressable
          onPress={onBack ?? (() => router.back())}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={backLabel}>
          <Ionicons name={backIcon} size={24} color={presentation === 'resident' ? theme.resident.onAccent : theme.onPrimary} />
        </Pressable>
        <View style={[styles.headerContent, compact && styles.compactContent]}>
          <ThemedText accessibilityRole="header" numberOfLines={singleLine ? 1 : undefined} adjustsFontSizeToFit={singleLine} type={presentation === 'resident' ? 'residentHeader' : 'default'} style={[compact ? styles.compactTitle : styles.headerTitle, { color: presentation === 'resident' ? theme.resident.onAccent : theme.onPrimary }]}>
            {title}
          </ThemedText>
        </View>
        <View style={styles.balance} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: { width: 44 },
  headerTitle: { fontSize: 21, lineHeight: 26, textAlign: 'center', fontFamily: Fonts.gideonRoman },
  compactContent: { paddingHorizontal: Spacing.one },
  compactTitle: { fontSize: 21, lineHeight: 26, textAlign: 'center' },
});
