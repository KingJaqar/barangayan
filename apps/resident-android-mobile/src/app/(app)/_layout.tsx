import AppTabs from '@/components/app-tabs';
import { UnreadCountsProvider } from '@/hooks/use-unread-counts';

// The 6-tab bottom bar (Home/Services/Maps/Health/Reports/Settings). Only ever mounted
// when Stack.Protected's guard={!!session} is true — see the root _layout.tsx.
//
// UnreadCountsProvider is mounted here (not inside the Reports screen) so the Reports
// tab's three live badges — and the Home bell, which shares the same announcements
// count — keep updating no matter which tab the resident is currently on.
export default function AppLayout() {
  return (
    <UnreadCountsProvider>
      <AppTabs />
    </UnreadCountsProvider>
  );
}
