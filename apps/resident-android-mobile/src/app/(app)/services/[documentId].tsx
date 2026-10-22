import { idVerificationState, servicePriceLabel, serviceProcessingLabel } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { type Tables } from '@barangayan/shared';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ThemedText } from '@/components/themed-text';
import { DocumentGuideContent } from '@/components/services/document-guide-content';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
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
      <View style={styles.skeletonTitleRow}>
        <SkeletonBlock width="70%" height={28} />
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
  const { profile, isLoading: isProfileLoading, error: profileError, refetch } = useProfile();
  const hasVerifiedId = !profileError && idVerificationState(profile) === 'verified';
  useFocusEffect(useCallback(() => { if (session) refetch(); }, [refetch, session]));
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
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.resident.card }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <ServiceScreenHeader presentation="resident" title="Requirements & Guidelines" compact singleLine />

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
              <ThemedText type="title" style={styles.title}>
                {doc.name}
              </ThemedText>
            {doc.description ? (
              <ThemedText themeColor="textSecondary" style={styles.description}>
                {doc.description}
              </ThemedText>
            ) : null}
            <View style={[styles.metaRow, { backgroundColor: theme.resident.surface }]}>
              <View style={styles.metaItem}>
                <Ionicons name="cash-outline" size={15} color={theme.resident.accentText} accessible={false} />
                <ThemedText type="smallBold" style={styles.metaText}>
                  {servicePriceLabel(doc)}
                </ThemedText>
              </View>
              <View style={[styles.metaItem, styles.processingItem]}>
                <Ionicons name="time-outline" size={15} color={theme.resident.accentText} accessible={false} />
                <ThemedText type="smallBold" style={styles.metaText}>
                  {serviceProcessingLabel(doc)}
                </ThemedText>
              </View>
            </View>
          </View>

          <DocumentGuideContent doc={doc} />
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: theme.resident.card, borderTopColor: theme.resident.border }]}>
          <View style={styles.footerPrice}>
            <ThemedText type="small" themeColor="textSecondary">
              Fee
            </ThemedText>
            <ThemedText type="smallBold">
              {servicePriceLabel(doc)}
            </ThemedText>
          </View>
          <View style={styles.footerAction}>
            {session ? (
              <PrimaryButton
                presentation="resident"
                label={isProfileLoading ? 'Checking Valid ID…' : hasVerifiedId ? 'Request' : 'Verify Valid ID'}
                disabled={isProfileLoading}
                onPress={() => router.push(hasVerifiedId ? `/services/request/${doc.id}` : '/settings/valid-id')}
              />
            ) : (
              // Submitting a request requires an identity — guests get routed to Login
              // instead of the Request Form.
              <PrimaryButton presentation="resident" label="Log In to Request" onPress={() => router.push('/(auth)/login')} />
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
    padding: 20,
    gap: 24,
  },

  hero: {
    gap: 8,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    columnGap: 12,
    rowGap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    maxWidth: '100%',
  },
  processingItem: { flexGrow: 1, flexShrink: 1, flexBasis: 160 },
  metaText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: 20,
    paddingVertical: 12,
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
    padding: Spacing.three,
    gap: Spacing.two,
  },
  skeletonTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  skeletonBlockGap: {
    marginTop: Spacing.two,
  },
});
