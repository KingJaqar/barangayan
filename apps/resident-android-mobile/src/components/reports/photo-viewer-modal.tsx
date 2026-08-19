import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Spacing } from '@/constants/theme';

/**
 * Full-screen photo preview — slides/fades up from the card it was opened from instead
 * of the abrupt full-bleed `<Image>` swap the detail screen used to do implicitly.
 * Presentation only: no new data is fetched, it just displays the URI it's given.
 */
export function PhotoViewerModal({
  visible,
  uri,
  onClose,
}: {
  visible: boolean;
  uri: string | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const translateY = useSharedValue(height * 0.06);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 25, stiffness: 220, mass: 0.8, overshootClamping: true });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      translateY.value = height * 0.06;
      opacity.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const sheetStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!uri) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.content, sheetStyle]}>
          <Image source={{ uri }} style={styles.image} contentFit="contain" />
        </Animated.View>
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close photo preview"
          style={[styles.closeBtn, { top: insets.top + Spacing.two }]}
          hitSlop={Spacing.two}>
          <Ionicons name="close" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    width: '100%',
    height: '80%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  closeBtn: {
    position: 'absolute',
    right: Spacing.three,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
