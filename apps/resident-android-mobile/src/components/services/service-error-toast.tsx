import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function ServiceErrorToast({ notice, onDismiss }: {
  notice: { message: string } | null;
  onDismiss: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [notice, onDismiss]);
  if (!notice) return null;
  return (
    <View pointerEvents="box-none" style={[styles.position, { top: insets.top + 12 }]}>
      <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
        style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.accentRed }]}>
        <Ionicons name="alert-circle-outline" size={24} color={theme.accentRed} />
        <ThemedText style={{ flex: 1 }}>{notice.message}</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss error notification"
          onPress={onDismiss} hitSlop={8} style={styles.close}>
          <Ionicons name="close" size={22} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  position: { position: 'absolute', left: 16, right: 16, zIndex: 1000, elevation: 12 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16,
    borderWidth: 1, borderRadius: 16, maxWidth: 540, width: '100%', alignSelf: 'center', elevation: 12 },
  close: { padding: 4 },
});
