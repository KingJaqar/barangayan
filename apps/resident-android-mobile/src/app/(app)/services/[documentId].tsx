import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, formatProcessingTime, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing, Fonts } from '@/constants/theme';
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
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [doc, setDoc] = useState<DocumentType | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from('document_types')
      .select('*')
      .eq('id', documentId)
      .single()
      .then(({ data }) => setDoc(data));
  }, [documentId]);

  if (doc === undefined) {
    return <DocumentDetailSkeleton />;
  }
  if (doc === null) {
    return <PlaceholderPanel label="Document not found." />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              Requirements & Guidelines
            </ThemedText>
          </View>
        </View>

      <ScrollView contentContainerStyle={styles.content}>
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
              {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
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
              <ThemedText type="smallBold">{formatProcessingTime(doc.processing_target_hours)}</ThemedText>
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

  /* Header */
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44, height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
    letterSpacing: -0.3,
    flex: 1,
  },
  feePill: {
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  skeletonBlockGap: {
    marginTop: Spacing.two,
  },
});
