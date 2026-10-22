import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { QrGuideContent } from '@/components/qr-guide-content';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function AuthenticatedScanView() {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  return <View style={[styles.root, { backgroundColor: resident.card }]}>
    <ServiceScreenHeader title="Emergency QR Check-In" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
      <QrGuideContent />
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1 }, body: { padding: 20 } });
