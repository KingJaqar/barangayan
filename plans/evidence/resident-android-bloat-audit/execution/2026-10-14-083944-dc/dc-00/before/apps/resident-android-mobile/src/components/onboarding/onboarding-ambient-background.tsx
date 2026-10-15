import { StyleSheet, View } from 'react-native';

/**
 * Purely decorative ambient glow layer shared by the 3 onboarding screens (Welcome,
 * Value Prop, Personalization) — two large, low-opacity soft circles that add depth
 * behind the content without a gradient/blur dependency. Absolutely filled and
 * `pointerEvents="none"` so it never intercepts touches or affects layout of whatever
 * renders after it; screens control the tint so it reads correctly against both a
 * solid `theme.primary` hero background and a neutral `theme.background` one.
 */
export function OnboardingAmbientBackground({ tint }: { tint: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.blob, styles.blobTop, { backgroundColor: tint }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: tint }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.14,
  },
  blobTop: {
    width: 420,
    height: 420,
    borderRadius: 210,
    top: -160,
    right: -140,
  },
  blobBottom: {
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.1,
    bottom: -120,
    left: -110,
  },
});
