import { useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { ThemedText } from './themed-text';
import { startGoogleAuth } from '@/lib/google-auth';

const googleFonts = { GoogleSansMedium: require('../../assets/fonts/google-sans-medium.ttf') };
export function GoogleButton({ label, link = false }: { label: string; link?: boolean }) {
  const busy = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fontsLoaded] = useFonts(googleFonts);
  async function start() {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(null);
    try { await startGoogleAuth(link); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Google sign-in failed. Please retry.'); }
    finally { busy.current = false; setLoading(false); }
  }
  return (
    <View style={{ gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: loading, busy: loading }}
        disabled={loading}
        onPress={start}
        style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>
        <Image source={require('../../assets/images/google-g.png')} style={styles.logo} resizeMode="contain" accessible={false} />
        <Text style={[styles.label, fontsLoaded && { fontFamily: 'GoogleSansMedium' }]}>{label}</Text>
        <View style={styles.progress}>
          {loading && <ActivityIndicator size="small" color="#4285f4" accessible={false} />}
        </View>
      </Pressable>
      {error && <ThemedText accessibilityLiveRegion="polite" themeColor="accentRed">{error}</ThemedText>}
    </View>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 48, paddingHorizontal: 12, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: '#747775', backgroundColor: '#ffffff', flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 18, height: 18 },
  label: { flex: 1, color: '#1f1f1f', fontSize: 14, lineHeight: 20, fontWeight: '500', textAlign: 'center' },
  progress: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  pressed: { backgroundColor: '#eef3fc' },
  disabled: { opacity: 0.7 },
});
