import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function ReportPhoto({ uri, viewer = false }: { uri: string; viewer?: boolean }) {
  return <PhotoContent key={uri} uri={uri} viewer={viewer} />;
}
function PhotoContent({ uri, viewer }: { uri: string; viewer: boolean }) {
  const { resident } = useTheme();
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  return <View style={{ flex: 1, width: '100%' }}>
    <Image key={attempt} source={{ uri }} contentFit="contain" style={StyleSheet.absoluteFill}
      onLoad={() => { setLoading(false); setFailed(false); }} onError={() => { setLoading(false); setFailed(true); }} />
    {loading || failed ? <View style={[StyleSheet.absoluteFill, styles.state, { backgroundColor: viewer ? resident.mediaBackdrop : resident.surface }]}>
      {failed ? <><ThemedText style={{ color: viewer ? resident.mediaForeground : resident.text }}>Photo could not be loaded.</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel="Retry photo" style={styles.retry} onPress={event => {
          event.stopPropagation(); setLoading(true); setFailed(false); setAttempt(value => value + 1);
        }}><ThemedText style={{ color: viewer ? resident.mediaForeground : resident.accentText }}>Try again</ThemedText></Pressable></> :
        <ActivityIndicator accessibilityLabel="Loading photo" color={viewer ? resident.mediaForeground : resident.accentText} />}
    </View> : null}
  </View>;
}
const styles = StyleSheet.create({
  state: { alignItems: 'center', justifyContent: 'center', gap: 8 },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16 },
});
