import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AppTabs from '@/components/app-tabs';
import { ResidentHeader } from '@/components/resident-header';
import { UnreadCountsProvider } from '@/hooks/use-unread-counts';
import { ResidentSearchProvider } from '@/hooks/use-resident-search';
import { useAuth } from '@/hooks/use-auth';
import { FloatingTabLayoutProvider } from '@/hooks/use-floating-tab-layout';
import { useTheme } from '@/hooks/use-theme';
import { EmergencyMapHeaderProvider } from '@/hooks/use-emergency-map-header';

export default function AppLayout() {
  const { session } = useAuth();
  const theme = useTheme();
  return <UnreadCountsProvider>
    <ResidentSearchProvider key={session?.user.id ?? 'guest'}>
      <FloatingTabLayoutProvider>
        <StatusBar style={theme.resident.onAccent === '#000000' ? 'dark' : 'light'} />
        <EmergencyMapHeaderProvider>
          <View style={{ flex: 1 }}><ResidentHeader /><AppTabs /></View>
        </EmergencyMapHeaderProvider>
      </FloatingTabLayoutProvider>
    </ResidentSearchProvider>
  </UnreadCountsProvider>;
}
