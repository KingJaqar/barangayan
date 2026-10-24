import { useEffect, useRef, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

/** Short native opacity feedback; content keeps its natural height and scroll position. */
export function SettingsContentTransition({ children, contentKey }: { children: ReactNode; contentKey: string }) {
  const reducedMotion = useResidentReducedMotion(true);
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    opacity.stopAnimation();
    if (reducedMotion) { opacity.setValue(1); return; }
    opacity.setValue(0.65);
    const animation = Animated.timing(opacity, { toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [contentKey, reducedMotion, opacity]);
  return <Animated.View style={{ opacity }}>{children}</Animated.View>;
}

/** Policy and About bodies retain the complete stored Markdown. */
export function ManagedMarkdown({ children, compact = false }: { children: string; compact?: boolean }) {
  const { resident } = useTheme();
  const { fontId } = useFontPreference();
  const fontFamily = getMobileFontFamily(fontId);
  const heading = { color: resident.text, fontFamily, fontWeight: '700' as const };
  return <Markdown style={{
    body: { color: resident.text, fontFamily, fontSize: 15, lineHeight: compact ? 21 : 23 },
    heading1: { ...heading, fontSize: compact ? 21 : 23, lineHeight: compact ? 27 : 29, marginTop: compact ? 10 : 16, marginBottom: compact ? 6 : 8 },
    heading2: { ...heading, fontSize: 18, lineHeight: 25, marginTop: compact ? 10 : 16, marginBottom: compact ? 6 : 8 },
    heading3: { ...heading, fontSize: 16, lineHeight: 23, marginTop: compact ? 8 : 12, marginBottom: 6 },
    heading4: heading, heading5: heading, heading6: heading,
    paragraph: { marginTop: compact ? 2 : 4, marginBottom: compact ? 6 : 8 },
    link: { color: resident.accentText, textDecorationLine: 'underline' },
    blockquote: { backgroundColor: resident.surface, borderColor: resident.border },
    code_inline: { color: resident.text, backgroundColor: resident.surface, borderColor: resident.border },
    code_block: { color: resident.text, backgroundColor: resident.surface, borderColor: resident.border },
    fence: { color: resident.text, backgroundColor: resident.surface, borderColor: resident.border },
    hr: { backgroundColor: resident.border }, table: { borderColor: resident.border },
    thead: { backgroundColor: resident.surface }, tr: { borderColor: resident.border },
    bullet_list: { marginBottom: 8 }, ordered_list: { marginBottom: 8 }, list_item: { marginBottom: 4 },
  }}>{children}</Markdown>;
}

export function ContentState({ title, message, loading = false, onRetry }: {
  title: string; message?: string; loading?: boolean; onRetry?: () => void;
}) {
  const { resident } = useTheme();
  return <View style={styles.state} accessibilityLiveRegion="polite" accessibilityState={{ busy: loading }}>
    {loading ? <ActivityIndicator color={resident.accentText} accessibilityLabel={title} /> : null}
    <ThemedText type="smallBold" style={{ color: resident.text, textAlign: 'center' }}>{title}</ThemedText>
    {message ? <ThemedText type="small" style={{ color: resident.muted, textAlign: 'center' }}>{message}</ThemedText> : null}
    {onRetry ? <PrimaryButton presentation="resident" compact label="Retry" onPress={onRetry} /> : null}
  </View>;
}
const styles = StyleSheet.create({ state: { paddingVertical: 32, gap: 12, alignItems: 'center' } });
