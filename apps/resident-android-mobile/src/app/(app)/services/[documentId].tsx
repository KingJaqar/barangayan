import { catalogContract, charterSections, servicePriceLabel, serviceProcessingLabel } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ThemedText } from '@/components/themed-text';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

const CHARTER_ICONS: Record<(typeof charterSections)[number][0], keyof typeof Ionicons.glyphMap> = {
  officeDivision: 'business-outline',
  classification: 'layers-outline',
  transactionType: 'swap-horizontal-outline',
  whoMayAvail: 'people-outline',
  checklistOfRequirements: 'checkbox-outline',
  whereToSecureRequirements: 'location-outline',
  clientSteps: 'footsteps-outline',
  agencyActions: 'briefcase-outline',
  feesToBePaid: 'cash-outline',
  processingTime: 'time-outline',
  personResponsible: 'person-outline',
};

/** Shimmer stand-in for the loading state, shaped like the real content below it so
 * nothing reflows once the document loads. Rendered only while `doc === undefined` —
 * same early-return slot `PlaceholderPanel` used to occupy. */
function DocumentDetailSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.skeletonContainer, { backgroundColor: theme.background }]}>
      <SkeletonBlock width={56} height={56} borderRadius={16} />
      <View style={styles.skeletonTitleRow}>
        <SkeletonBlock width="70%" height={30} />
        <SkeletonBlock width={72} height={26} borderRadius={Spacing.four} />
      </View>
      <SkeletonBlock width="90%" height={16} />
      <SkeletonBlock width="60%" height={16} />
      <SkeletonBlock width="100%" height={140} borderRadius={Spacing.three} style={styles.skeletonBlockGap} />
      <SkeletonBlock width="100%" height={64} borderRadius={Spacing.three} style={styles.skeletonBlockGap} />
    </View>
  );
}

/** Airbnb-style flat section: leading icon, bold heading, body text, hairline separator. */
function InfoSection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: theme.backgroundSelected }]}>
      <Ionicons name={icon} size={24} color={theme.text} style={styles.sectionIcon} />
      <View style={styles.sectionBody}>
        <ThemedText type="heading" style={styles.sectionTitle}>
          {title}
        </ThemedText>
        {children}
      </View>
    </View>
  );
}

export default function DocumentDetailScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  return <DocumentDetailContent key={documentId}/>;
}
function DocumentDetailContent() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();
  const [doc, setDoc] = useState<DocumentType | null | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    supabase
      .from('document_types')
      .select('*')
      .eq('id', documentId)
      .eq('is_active', true).is('deleted_at', null).maybeSingle()
      .then(({ data, error }) => { if (active) { setDoc(data); setLoadError(error ? 'Could not load this service. Reconnect and retry.' : null); } });
    return () => { active = false; };
  }, [documentId, retry]);

  if (loadError) return <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}><View style={{ padding: 20, gap: 16 }}><ThemedText accessibilityRole="alert">{loadError}</ThemedText><PrimaryButton label="Retry loading service" onPress={() => { setLoadError(null); setDoc(undefined); setRetry(value => value + 1); }}/><PrimaryButton label="Back to Services" variant="secondary" onPress={() => router.replace('/services')}/></View></SafeAreaView>;
  if (doc === undefined) {
    return <DocumentDetailSkeleton />;
  }
  if (doc === null) {
    return <PlaceholderPanel label="Document not found." />;
  }

  const contract = catalogContract(doc);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ServiceScreenHeader title="Requirements & Guidelines" />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: `${theme.primary}1F` }]}>
              <Ionicons name="document-text-outline" size={30} color={theme.primary} />
            </View>
            <ThemedText type="title" style={styles.title}>
              {doc.name}
            </ThemedText>
            {doc.description ? (
              <ThemedText themeColor="textSecondary" style={styles.description}>
                {doc.description}
              </ThemedText>
            ) : null}
            <View style={styles.metaRow}>
              <View style={[styles.metaChip, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="cash-outline" size={15} color={theme.primary} />
                <ThemedText type="smallBold" style={styles.metaText}>
                  {servicePriceLabel(doc)}
                </ThemedText>
              </View>
              <View style={[styles.metaChip, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="time-outline" size={15} color={theme.primary} />
                <ThemedText type="smallBold" style={styles.metaText}>
                  {serviceProcessingLabel(doc)}
                </ThemedText>
              </View>
            </View>
          </View>

          {contract
            ? charterSections.map(([key, label]) => {
                const value = contract.charter[key] ?? 'Not specified in the source charter';
                const lines = String(value)
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                return (
                  <InfoSection key={key} icon={CHARTER_ICONS[key]} title={label}>
                    {lines.map((line, index) => (
                      <ThemedText key={`${index}-${line}`} style={styles.bodyText}>
                        {line}
                      </ThemedText>
                    ))}
                  </InfoSection>
                );
              })
            : null}

          {doc.requirements.length > 0 ? (
            <InfoSection icon="checkmark-done-outline" title="Requirements">
              {doc.requirements.map((req) => (
                <View key={req} style={styles.requirementRow}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.primary} />
                  <ThemedText style={styles.requirementText}>{req}</ThemedText>
                </View>
              ))}
            </InfoSection>
          ) : null}

          {contract ? null : (
            <InfoSection icon="time-outline" title="Processing & Pickup">
              <ThemedText themeColor="textSecondary">Estimated time</ThemedText>
              <ThemedText type="smallBold">{serviceProcessingLabel(doc)}</ThemedText>
            </InfoSection>
          )}

          <View style={[styles.notes, { borderTopColor: theme.backgroundSelected }]}>
            <Collapsible title="Additional Notes">
              <ThemedText type="small" themeColor="textSecondary">
                Please ensure all requirements are complete before proceeding. Bring the
                original documents for verification at the Barangay Hall. Processing times
                are estimates and may vary during peak periods.
              </ThemedText>
            </Collapsible>
          </View>
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected }]}>
          <View style={styles.footerPrice}>
            <ThemedText type="small" themeColor="textSecondary">
              Fee
            </ThemedText>
            <ThemedText type="smallBold" numberOfLines={2}>
              {servicePriceLabel(doc)}
            </ThemedText>
          </View>
          <View style={styles.footerAction}>
            {session ? (
              <PrimaryButton
                label="Request This Document"
                onPress={() => router.push(`/services/request/${doc.id}`)}
              />
            ) : (
              // Submitting a request requires an identity — guests get routed to Login
              // instead of the Request Form.
              <PrimaryButton label="Log In to Request" onPress={() => router.push('/(auth)/login')} />
            )}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1 },

  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.five,
  },

  hero: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  description: {
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 999,
  },
  metaText: {
    flexShrink: 1,
  },

  section: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionIcon: {
    width: 28,
    marginTop: 1,
  },
  sectionBody: {
    flex: 1,
    gap: Spacing.two,
  },
  sectionTitle: {
    fontSize: 18,
    lineHeight: 24,
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  requirementText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  notes: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerPrice: {
    flex: 1,
  },
  footerAction: {
    flex: 1.1,
  },

  /* Loading skeleton */
  skeletonContainer: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  skeletonTitleRow: {
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  skeletonBlockGap: {
    marginTop: Spacing.two,
  },
});
