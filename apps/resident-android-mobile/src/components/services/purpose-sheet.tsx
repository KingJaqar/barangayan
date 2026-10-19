import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { ResidentLayout } from '@/constants/resident-theme';

type Option = { code: string; label: string };

const OPEN_MS = 320;
const CLOSE_MS = 240;

/** Bottom-sheet picker: slides up on open, slides down on close (button, backdrop tap,
 * swipe-down on the handle, Android back). `visible` is the parent's source of truth; the
 * sheet stays mounted until the slide-out animation finishes. */
export function PurposeSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  presentation = 'default',
}: {
  visible: boolean;
  title: string;
  options: readonly Option[];
  selected?: string;
  onSelect: (code: string) => void;
  onClose: () => void;
  presentation?: 'default' | 'resident';
}) {
  const theme = useTheme();
  const resident = presentation === 'resident';
  const reducedMotion = useResidentReducedMotion(resident);
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current; // 0 = hidden, 1 = shown
  const dragY = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const height = Dimensions.get('window').height;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (resident) {
      progress.stopAnimation();
      scrim.stopAnimation();
      if (visible) { dragY.setValue(0); setMounted(true); }
      const animation = Animated.parallel([
        Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reducedMotion ? 100 : 280, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
        Animated.timing(scrim, { toValue: visible ? 1 : 0, duration: reducedMotion ? 100 : 200, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
      ]);
      animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
      return () => { animation.stop(); dragY.stopAnimation(); };
    }
    if (visible) {
      dragY.setValue(0);
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: OPEN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: CLOSE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible, progress, dragY, scrim, resident, reducedMotion]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => dragY.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 90 || g.vy > 0.8) {
            onCloseRef.current();
          } else {
            if (resident && reducedMotion) dragY.setValue(0);
            else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
          }
        },
        onPanResponderTerminate: () => {
          if (resident && reducedMotion) dragY.setValue(0);
          else Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [dragY, resident, reducedMotion],
  );

  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
    dragY,
  );

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: resident ? scrim : progress }, resident && { backgroundColor: theme.resident.scrim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close purpose selection"
            onPress={onClose}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal={resident || undefined}
          style={[
            styles.sheet,
            resident && { maxHeight: '92%', borderTopLeftRadius: ResidentLayout.overlayRadius, borderTopRightRadius: ResidentLayout.overlayRadius, paddingHorizontal: ResidentLayout.screenPadding },
            {
              backgroundColor: resident ? theme.resident.card : theme.background,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
              opacity: resident && reducedMotion ? progress : 1,
              transform: [{ translateY: resident && reducedMotion ? 0 : translateY }],
            },
          ]}>
          <View {...pan.panHandlers} style={styles.dragZone}>
            <View style={[styles.grabber, { backgroundColor: theme.backgroundSelected }]} />
            <View style={styles.headerRow}>
              <ThemedText type="heading" style={styles.title}>
                {title}
              </ThemedText>
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Cancel purpose selection"
                style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="close" size={18} color={theme.text} />
              </Pressable>
            </View>
          </View>

          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}>
            {options.map((item, index) => {
              const active = item.code === selected;
              return (
                <Pressable
                  key={item.code}
                  accessibilityRole="button"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: active }}
                  onPress={() => {
                    onSelect(item.code);
                    onClose();
                  }}
                  android_ripple={{ color: theme.backgroundSelected }}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: resident ? theme.resident.border : theme.backgroundSelected,
                    },
                    pressed && { backgroundColor: resident ? theme.resident.pressed : theme.backgroundElement },
                  ]}>
                  <ThemedText style={[styles.rowLabel, active && { fontWeight: '700' }]}>
                    {item.label}
                  </ThemedText>
                  {active ? (
                    <Ionicons name="checkmark-circle" size={22} color={resident ? theme.resident.accentText : theme.primary} />
                  ) : (
                    <View style={[styles.radio, { borderColor: theme.backgroundSelected }]} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  dragZone: { paddingTop: 10, paddingBottom: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 20, lineHeight: 26 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  list: { paddingTop: 4 },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 4,
  },
  rowLabel: { flex: 1, fontSize: 16, lineHeight: 22 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
});
