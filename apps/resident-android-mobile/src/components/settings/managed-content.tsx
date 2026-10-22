import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useTheme } from '@/hooks/use-theme';

/** Policy and About bodies retain the complete stored Markdown. */
export function ManagedMarkdown({ children }: { children: string }) {
  const { resident } = useTheme();
  const { fontId } = useFontPreference();
  const fontFamily = getMobileFontFamily(fontId);
  const heading = { color: resident.text, fontFamily, fontWeight: '700' as const };
  return <Markdown style={{
    body: { color: resident.text, fontFamily, fontSize: 15, lineHeight: 23 },
    heading1: { ...heading, fontSize: 23, lineHeight: 29, marginTop: 16, marginBottom: 8 },
    heading2: { ...heading, fontSize: 18, lineHeight: 25, marginTop: 16, marginBottom: 8 },
    heading3: { ...heading, fontSize: 16, lineHeight: 23, marginTop: 12, marginBottom: 6 },
    heading4: heading, heading5: heading, heading6: heading,
    paragraph: { marginTop: 4, marginBottom: 8 },
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
