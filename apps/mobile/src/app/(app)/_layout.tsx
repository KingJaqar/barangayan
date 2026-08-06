import AppTabs from '@/components/app-tabs';

// The 6-tab bottom bar (Home/Services/Maps/Health/Reports/Settings). Only ever mounted
// when Stack.Protected's guard={!!session} is true — see the root _layout.tsx.
export default function AppLayout() {
  return <AppTabs />;
}
