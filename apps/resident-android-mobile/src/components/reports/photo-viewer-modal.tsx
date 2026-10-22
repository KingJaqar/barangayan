import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ReportPhoto } from '@/components/reports/report-photo';
import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';

/** Original images stay contained; retained content survives the opacity-only exit. */
export function PhotoViewerModal({ visible, uri, photos, onClose }: {
  visible: boolean; uri: string | null; photos?: string[]; onClose: () => void;
}) {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, panel } = useReportModalMotion(visible, 200);
  const [retained, setRetained] = useState(uri);
  const [index, setIndex] = useState(0);
  const requestedIndex = Math.max(0, photos?.indexOf(uri ?? '') ?? 0);
  useEffect(() => {
    if (uri) { setRetained(uri); setIndex(requestedIndex); }
    // An account theme/font update or same-list refresh must not reset a viewed photo.
  }, [uri, visible, requestedIndex]);
  const current = Math.min(index, Math.max(0, (photos?.length ?? 1) - 1));
  const image = photos?.[current] ?? retained;
  const multiple = (photos?.length ?? 0) > 1;
  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <Animated.View accessibilityViewIsModal style={[styles.backdrop, { opacity: panel, backgroundColor: resident.mediaBackdrop }]}>
      <View style={styles.content}>{image ? <ReportPhoto uri={image} viewer /> : null}</View>
      {multiple ? <>
        <ThemedText accessibilityLiveRegion="polite" style={[styles.counter, { top: insets.top + 20, color: resident.mediaForeground }]}>{current + 1} / {photos?.length}</ThemedText>
        <View pointerEvents="box-none" style={styles.navigation}>
          {(['back', 'forward'] as const).map(direction => <Pressable key={direction} accessibilityRole="button" accessibilityLabel={direction === 'back' ? 'Previous full-screen photo' : 'Next full-screen photo'}
            onPress={() => setIndex(value => { const length = photos?.length ?? 0; return length ? (value + (direction === 'back' ? -1 : 1) + length) % length : 0; })} style={styles.arrow}>
            <Ionicons name={direction === 'back' ? 'chevron-back' : 'chevron-forward'} size={26} color={resident.mediaForeground} />
          </Pressable>)}
        </View>
      </> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="Close photo preview" onPress={onClose} style={[styles.close, { top: insets.top + 12 }]}>
        <Ionicons name="close" size={26} color={resident.mediaForeground} />
      </Pressable>
    </Animated.View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center' }, content: { width: '100%', height: '80%' },
  counter: { position: 'absolute', left: 20, fontSize: 14, fontWeight: '700' },
  close: { position: 'absolute', right: 12, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navigation: { position: 'absolute', left: 12, right: 12, top: '50%', flexDirection: 'row', justifyContent: 'space-between' },
  arrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
