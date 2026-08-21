import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Green header bar shared by Login/Register — same shape as Settings > Profile's
 * header (back chevron + centered title on a theme.primary bar, safe-area aware).
 * Pass `onBack` to override the default `router.back()`.
 */
export function AuthHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={styles.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={Spacing.two}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>
      <View style={styles.headerContent}>
        <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>{title}</ThemedText>
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
});
