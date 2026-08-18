import { Stack } from 'expo-router';

// Native Stack nested inside the "Services" NativeTabs tab, so screens here (Document
// Detail, Request Form, Payment, Request Tracking detail) can push over the
// Documents/Requests/Logs segmented-control index screen — see Expo Router's guidance on
// nesting a Stack inside NativeTabs for header + push support.
export default function ServicesLayout() {
  return (
    <Stack>
      {/* index.tsx builds its own segmented-control header — the native Stack header
          would otherwise show a stray "index" title above it (same fix as Settings). */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[documentId]" options={{ headerShown: false }} />
      <Stack.Screen name="request/[documentId]" options={{ headerShown: false }} />
      <Stack.Screen name="payment/[requestId]" options={{ headerShown: false }} />
      <Stack.Screen name="payment/cod/[requestId]" options={{ headerShown: false }} />
      <Stack.Screen name="payment/qrph/[requestId]" options={{ headerShown: false }} />
      <Stack.Screen name="payment/success" options={{ headerShown: false }} />
      <Stack.Screen name="requests/[requestId]" options={{ headerShown: false }} />
    </Stack>
  );
}
