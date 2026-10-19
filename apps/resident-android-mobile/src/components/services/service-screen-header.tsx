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
  onBack,
  compact = false,
  presentation = 'default',
}: {
  title: string;
  backLabel?: string;
  onBack?: () => void;
  compact?: boolean;
  presentation?: 'default' | 'resident';
}) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { backgroundColor: presentation === 'resident' ? theme.resident.accent : theme.primary, paddingTop: insets.top + Spacing.two }]}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        hitSlop={Spacing.two}>
        <Ionicons name="chevron-back" size={26} color={presentation === 'resident' ? theme.resident.onAccent : theme.onPrimary} />
      </Pressable>
      <View style={[styles.headerContent, compact && styles.compactContent]}>
        <ThemedText type={presentation === 'resident' ? 'residentHeader' : 'default'} style={[compact ? styles.compactTitle : styles.headerTitle, { color: presentation === 'resident' ? theme.resident.onAccent : theme.onPrimary }]}>
          {title}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },
  compactContent: { height: 'auto', minHeight: 28, paddingHorizontal: 52 },
  compactTitle: { fontSize: 18, lineHeight: 24, fontWeight: '700', textAlign: 'center' },
});
