import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

const headerOptions = {
  headerStyle: { backgroundColor: Colors.light.primary },
  headerTintColor: '#ffffff',
  headerTitleStyle: { fontWeight: '700' as const },
};

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
      <Stack.Screen name="[documentId]" options={{ title: 'Requirements & Guidelines', ...headerOptions }} />
      <Stack.Screen name="request/[documentId]" options={{ title: 'Request Form', ...headerOptions }} />
      <Stack.Screen name="payment/[requestId]" options={{ title: 'Payment Method', ...headerOptions }} />
      <Stack.Screen name="payment/cod/[requestId]" options={{ title: 'Payment', ...headerOptions }} />
      <Stack.Screen name="payment/qrph/[requestId]" options={{ title: 'Payment', ...headerOptions }} />
      <Stack.Screen name="payment/success" options={{ headerShown: false }} />
      <Stack.Screen name="requests/[requestId]" options={{ title: 'Request Tracking', ...headerOptions }} />
    </Stack>
  );
}
