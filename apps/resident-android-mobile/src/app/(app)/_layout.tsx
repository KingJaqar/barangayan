import { View } from 'react-native';
import AppTabs from '@/components/app-tabs';
import { ResidentHeader } from '@/components/resident-header';
import { UnreadCountsProvider } from '@/hooks/use-unread-counts';
import { ResidentSearchProvider } from '@/hooks/use-resident-search';
import { useAuth } from '@/hooks/use-auth';

export default function AppLayout() {
  const { session } = useAuth();
  return <UnreadCountsProvider>
    <ResidentSearchProvider key={session?.user.id ?? 'guest'}>
      <View style={{ flex: 1 }}><ResidentHeader /><AppTabs /></View>
    </ResidentSearchProvider>
  </UnreadCountsProvider>;
}
