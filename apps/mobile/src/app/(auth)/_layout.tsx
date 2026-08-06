import { Stack } from 'expo-router';

// Only ever mounted when Stack.Protected's guard={!session} is true — see the root
// _layout.tsx. Blank titles + native back button, approximating the design file's
// minimal back-chevron header without a bespoke header component.
export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerTitle: '', headerShadowVisible: false }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
      <Stack.Screen name="value-prop" options={{ headerShown: false }} />
      <Stack.Screen name="personalization" options={{ headerShown: false }} />
      <Stack.Screen name="auth-choice" options={{ headerShown: false }} />
      <Stack.Screen name="completion" options={{ headerShown: false }} />
    </Stack>
  );
}
