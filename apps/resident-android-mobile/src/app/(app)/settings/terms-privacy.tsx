import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SITE_CONTENT_SECTION_META, type SiteContentSection } from '@barangayan/shared';
import { SegmentedControl } from '@/components/segmented-control';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ContentState, ManagedMarkdown, SettingsContentTransition } from '@/components/settings/managed-content';
import { ThemedText } from '@/components/themed-text';
import { useProfile } from '@/hooks/use-profile';
import { useSiteContent } from '@/hooks/use-site-content';
import { useTheme } from '@/hooks/use-theme';

const tabs: { key: SiteContentSection; label: string }[] = [
  { key: 'terms_of_service', label: SITE_CONTENT_SECTION_META.terms_of_service.label },
  { key: 'privacy_policy', label: SITE_CONTENT_SECTION_META.privacy_policy.label },
];
export default function TermsPrivacyScreen() {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { items, isLoading, error, refetch } = useSiteContent(profile?.barangay_id ?? null);
  const [section, setSection] = useState<SiteContentSection>('terms_of_service');
  const policy = items.find(item => item.section === section);
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: resident.card }}>
    <ServiceScreenHeader title="Terms & Privacy Policy" />
    <SegmentedControl variant="underline" segments={tabs} activeKey={section} onChange={setSection} />
    <ScrollView key={section} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {isLoading ? <ContentState loading title="Loading policies…" /> : error ?
        <ContentState title="Unable to load policies" message="Check your connection and try again." onRetry={refetch} /> : policy ? <SettingsContentTransition contentKey={section}>
          <ThemedText accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{policy.title}</ThemedText>
          <View style={[styles.body, { borderTopColor: resident.border }]}><ManagedMarkdown compact>{policy.body}</ManagedMarkdown></View>
        </SettingsContentTransition> : <ContentState title="Content Coming Soon" message={`${SITE_CONTENT_SECTION_META[section].label} content is not yet available.`} />}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: '800' },
  body: { marginTop: 8, paddingTop: 4, borderTopWidth: 1 },
});
