import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Pressable, View } from 'react-native';
import { Body, Destination, SymbolIcon } from '../../components/ui';
import { layout, radius, space, useColors } from '../../lib/theme';
import { PanelMotion } from './panel-motion';

const SHORTCUTS = [
  { title: 'Preparedness guide and hotlines', detail: 'Guidelines and emergency phone numbers', section: 'guidelines' },
  { title: 'Evacuation centers', detail: 'Centers in your barangay', section: 'centers' },
  { title: 'Family status', detail: 'Household QR code and members', section: 'family' },
] as const;

/**
 * The DRRM shortcut panel (A19-027…033). The handle toggles it with a tap — the accessible action —
 * and also follows a vertical drag. Motion is skipped when the system asks for reduced motion.
 */
export function DrrmPanel({ onMeasured }: { onMeasured: (height: number) => void }) {
  const colors = useColors();
  const [collapsed, setCollapsed] = useState(false);
  const [motion] = useState(() => new PanelMotion(setCollapsed));
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => motion.setReduceMotion(value));
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => motion.setReduceMotion(value));
    return () => subscription.remove();
  }, [motion]);

  return <Animated.View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, transform: [{ translateY: motion.offset }], backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, borderWidth: 1, borderColor: colors.border }}>
    <Pressable accessibilityRole="button" accessibilityLabel="DRRM info hub" accessibilityValue={{ text: collapsed ? 'Collapsed' : 'Expanded' }} accessibilityState={{ expanded: !collapsed }}
      accessibilityHint={collapsed ? 'Shows the emergency shortcuts' : 'Hides the emergency shortcuts'} onPress={() => motion.toggle()} {...motion.responder.panHandlers}
      style={{ minHeight: layout.controlMin, alignItems: 'center', justifyContent: 'center', gap: space[1], paddingTop: space[2] }}>
      <View style={{ width: 36, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
      <SymbolIcon name={collapsed ? 'chevron.up' : 'chevron.down'} color={colors.textSecondary} size={14} />
    </Pressable>
    <View accessibilityElementsHidden={collapsed} importantForAccessibility={collapsed ? 'no-hide-descendants' : 'auto'}
      onLayout={(event) => { motion.measured(event.nativeEvent.layout.height); onMeasured(event.nativeEvent.layout.height); }}
      style={{ paddingHorizontal: layout.margin, paddingBottom: space[4], gap: space[2] }}>
      <Body heading role="headline">DRRM info hub</Body>
      {SHORTCUTS.map((shortcut) => <Destination key={shortcut.section} title={shortcut.title} detail={shortcut.detail} href={{ pathname: '/emergency', params: { section: shortcut.section } }} />)}
    </View>
  </Animated.View>;
}
