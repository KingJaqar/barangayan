import { Ionicons } from '@expo/vector-icons';
import { useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';

/** Shared presentation for the color, profile-option and local household editors. */
export function SettingsSheet({ visible, title, onClose, children, footer, appearance = 'default' }: {
  visible: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
  appearance?: 'default' | 'profile' | 'family';
}) {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const [height, setHeight] = useState(0);
  const profile = appearance !== 'default';
  const family = appearance === 'family';
  const { mounted, panel, scrim, reduced } = useReportModalMotion(visible, profile ? (visible ? 280 : 200) : 280, profile ? 180 : 200);
  return <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
    <KeyboardAvoidingView style={[styles.overlay, { paddingTop: insets.top + 12 }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={`Dismiss ${title}`} />
      <Animated.View accessibilityViewIsModal onAccessibilityEscape={profile ? onClose : undefined} pointerEvents={visible ? 'auto' : 'none'}
        onLayout={event => { const next = Math.ceil(event.nativeEvent.layout.height); setHeight(current => current === next ? current : next); }}
        style={[styles.sheet, profile && styles.profileSheet, { backgroundColor: resident.card, maxHeight: profile ? screenHeight - insets.top - 12 : screenHeight * 0.92,
          opacity: reduced ? panel : height > 0 ? 1 : 0,
          transform: [{ translateY: reduced ? 0 : panel.interpolate({ inputRange: [0, 1], outputRange: [height || screenHeight, 0] }) }],
        }]}>
        <View style={[styles.handle, { backgroundColor: resident.border }]} />
        <View style={[styles.header, profile && styles.profileHeader, family && styles.familyHeader]}>
          <ThemedText accessibilityRole="header" style={[styles.title, profile && { color: resident.text }, family && styles.centeredTitle]}>{title}</ThemedText>
          {!family ? <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={`Close ${title}`} style={({ pressed }) => [styles.close, { backgroundColor: pressed ? resident.pressed : resident.surface }]}>
            <Ionicons name="close" size={20} color={resident.text} />
          </Pressable> : null}
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={profile ? false : undefined} style={styles.scroll} contentContainerStyle={[styles.body, profile && styles.profileBody, { paddingBottom: footer ? 16 : Math.max(insets.bottom, profile ? 24 : 20) }]}>
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, profile && styles.profileFooter, { borderTopColor: resident.border, paddingBottom: Math.max(insets.bottom, profile ? 28 : 20) }]}>{footer}</View> : null}
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 12 },
  profileSheet: { paddingTop: 10 },
  profileHeader: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  familyHeader: { paddingTop: 16, paddingBottom: 16 },
  centeredTitle: { textAlign: 'center' },
  profileBody: { paddingHorizontal: 20, gap: 0 },
  profileFooter: { borderTopWidth: 0, paddingHorizontal: 20, paddingTop: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 8, gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 19, lineHeight: 25, fontWeight: '800' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  body: { paddingHorizontal: 24, gap: 12 },
  footer: { borderTopWidth: 1, paddingTop: 16, paddingHorizontal: 24, gap: 12 },
});
