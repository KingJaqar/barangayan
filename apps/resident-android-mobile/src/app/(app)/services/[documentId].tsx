import { catalogContract, charterSections, servicePriceLabel, serviceProcessingLabel } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

/** Shimmer stand-in for the loading state, shaped like the real content below it so
 * nothing reflows once the document loads. Rendered only while `doc === undefined` —
 * same early-return slot `PlaceholderPanel` used to occupy. */
function DocumentDetailSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.skeletonContainer, { backgroundColor: theme.background }]}>
      <SkeletonBlock width="100%" height={180} borderRadius={Spacing.three} />
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

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ServiceScreenHeader title="Requirements & Guidelines" />

      <ScrollView contentContainerStyle={styles.content}>
        {catalogContract(doc) ? <View style={{ gap: 16 }}>{charterSections.map(([key,label]) => <View key={key}><ThemedText type="smallBold">{label}</ThemedText><ThemedText>{catalogContract(doc)!.charter[key] ?? 'Not specified in the source charter'}</ThemedText></View>)}</View> : null}
        <ThemedView type="backgroundElement" style={[styles.illustration, styles.shadowSm]}>
          <View style={[styles.auraBack, { backgroundColor: `${theme.primary}14` }]} />
          <View style={[styles.auraFront, { backgroundColor: `${theme.primary}0A` }]} />
          <Ionicons name="document-text-outline" size={72} color={theme.textSecondary} />
        </ThemedView>

        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>
            {doc.name}
          </ThemedText>
          <View style={[styles.feePill, styles.hairline, { backgroundColor: `${theme.primary}26` }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {servicePriceLabel(doc)}
            </ThemedText>
          </View>
        </View>

        {doc.description ? (
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {doc.description}
          </ThemedText>
        ) : null}

        {doc.requirements.length > 0 ? (
          <View style={[styles.cardShadowWrap, styles.card]}>
            <Card>
              <View style={styles.cardHeader}>
                <Ionicons name="checkmark-done-outline" size={18} color={theme.primary} />
                <ThemedText type="small" style={styles.sectionLabel} themeColor="textSecondary">
                  Requirements
                </ThemedText>
              </View>
              <Divider />
              {doc.requirements.map((req, index) => (
                <View key={req}>
                  <View style={styles.requirementRow}>
                    <Ionicons name="ellipse-outline" size={16} color={theme.textSecondary} />
                    <ThemedText type="small" style={styles.requirementText}>
                      {req}
                    </ThemedText>
                  </View>
                  {index < doc.requirements.length - 1 ? <Divider /> : null}
                </View>
              ))}
            </Card>
          </View>
        ) : null}

        <View style={[styles.cardShadowWrap, styles.card]}>
          <Card>
            <View style={styles.cardHeader}>
              <Ionicons name="time-outline" size={18} color={theme.primary} />
              <ThemedText type="small" style={styles.sectionLabel} themeColor="textSecondary">
                Processing & Pickup
              </ThemedText>
            </View>
            <Divider />
            <View style={styles.processingRow}>
              <ThemedText type="small" themeColor="textSecondary">
                Estimated Time
              </ThemedText>
              <ThemedText type="smallBold">{serviceProcessingLabel(doc)}</ThemedText>
            </View>
          </Card>
        </View>

        <Collapsible title="Additional Notes">
          <ThemedText type="small" themeColor="textSecondary">
            Please ensure all requirements are complete before proceeding. Bring the
            original documents for verification at the Barangay Hall. Processing times
            are estimates and may vary during peak periods.
          </ThemedText>
        </Collapsible>
      </ScrollView>

      <View style={styles.footer}>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1 },

  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },

  /* Design-system recipes (shared literally across the Services screens) */
  shadowSm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  hairline: {
    borderWidth: 1,
    borderColor: 'rgba(128,128,128,0.25)',
  },
  cardShadowWrap: {
    // Card has overflow:'hidden' internally, which would clip a shadow applied directly
    // to it — this wrapper carries the shadow instead, without touching Card itself.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderRadius: Spacing.three,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },

  illustration: {
    height: 180,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    overflow: 'hidden',
  },
  auraBack: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    top: -120,
    right: -80,
  },
  auraFront: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -100,
    left: -60,
  },
  titleRow: {
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.3,
    alignSelf: 'stretch',
  },
  feePill: {
    maxWidth: '100%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  description: {
    marginTop: Spacing.one,
  },
  card: {
    marginTop: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  requirementText: {
    flex: 1,
  },
  processingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  footer: {
    padding: Spacing.four,
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
