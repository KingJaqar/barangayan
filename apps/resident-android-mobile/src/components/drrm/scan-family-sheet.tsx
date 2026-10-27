import { useState, type ReactNode } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { useDrrmSheetMotion } from '@/hooks/use-drrm-sheet-motion';
import { useTheme } from '@/hooks/use-theme';

/** The three DRRM sheets share only presentation; callers retain all action/state ownership. */
export function ScanFamilySheet({ visible, onClose, title, children, footer, busy = false, picker = false, slide = false }: {
  visible: boolean; onClose: () => void; title: string; children: ReactNode;
  footer?: ReactNode; busy?: boolean; picker?: boolean; slide?: boolean;
}) {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [panelHeight, setPanelHeight] = useState(0);
  const { mounted, panel, scrim, reduced, onShow } = useDrrmSheetMotion(visible, picker, slide, panelHeight > 0);
  const close = () => { if (!busy) onClose(); };
  return <Modal visible={mounted} transparent animationType="none" onShow={onShow} onRequestClose={close} statusBarTranslucent>
    <KeyboardAvoidingView style={[styles.overlay, { paddingTop: insets.top + 12 }, picker && styles.pickerOverlay]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]} />
      <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel={`Dismiss ${title}`} accessibilityRole="button" disabled={busy} />
      <Animated.View accessibilityViewIsModal pointerEvents={visible ? 'auto' : 'none'} onLayout={event => {
        const next = Math.ceil(event.nativeEvent.layout.height);
        setPanelHeight(previous => previous === next ? previous : next);
      }} style={[styles.panel, {
        backgroundColor: resident.card, maxHeight: Math.min(height * (picker ? 0.8 : 0.92), height - insets.top - 12),
        opacity: slide && !reduced ? (panelHeight > 0 ? 1 : 0) : panel,
        transform: reduced || picker ? []
          : [{ translateY: panel.interpolate({ inputRange: [0, 1], outputRange: [slide ? (panelHeight || height) + insets.bottom : Math.min(panelHeight * 0.12, 48), 0] }) }],
      }, picker && styles.picker]}>
        {!picker ? <View style={[styles.handle, { backgroundColor: resident.border }]} /> : null}
        <View style={styles.header}>
          <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{title}</ThemedText>
          <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel={`Close ${title}`} accessibilityState={{ disabled: busy }} style={[styles.close, { backgroundColor: resident.surface }]}>
            <Ionicons name="close" size={20} color={resident.text} />
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll} contentContainerStyle={[styles.body, { paddingBottom: footer ? 12 : Math.max(insets.bottom, 16) }]}>
          {children}
        </ScrollView>
        {footer ? <View style={[styles.footer, { borderColor: resident.border, paddingBottom: Math.max(insets.bottom, 16) }]}>{footer}</View> : null}
      </Animated.View>
    </KeyboardAvoidingView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  pickerOverlay: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  panel: { flexShrink: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden', paddingTop: 8 },
  picker: { borderRadius: 24, width: '100%', maxWidth: 360, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center' },
  header: { paddingHorizontal: 16, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { flex: 1, minWidth: 0, fontSize: 18, lineHeight: 24, fontWeight: '800' },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  scroll: { flexShrink: 1 },
  body: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  footer: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1, gap: 8 },
});
