import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, type PaymentMethod, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { AnimatedAppear } from '@/components/services/animated-appear';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
};

/** Shimmer stand-in for the loading state, shaped like the fee/method rows below it.
 * Rendered only while `request === undefined` — same early-return slot `PlaceholderPanel`
 * used to occupy. */
function PaymentMethodSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBlock width="60%" height={26} />
      <SkeletonBlock width="40%" height={16} style={styles.skeletonGapSm} />
      <SkeletonBlock width="100%" height={20} style={styles.skeletonGap} />
      <SkeletonBlock width="100%" height={20} style={styles.skeletonGapSm} />
      <SkeletonBlock width="100%" height={76} borderRadius={Spacing.three} style={styles.skeletonGap} />
      <SkeletonBlock width="100%" height={76} borderRadius={Spacing.three} style={styles.skeletonGapSm} />
    </View>
  );
}

/** Wraps a method-card's selection highlight in a Reanimated spring — the vertical-stack
 * analog of a segmented control's sliding pill indicator (the two cards are stacked, not
 * side-by-side, so the highlight animates in place on the selected card rather than
 * sliding a shared background between them). The onPress/selection state itself is fully
 * owned by the caller; this component only animates the *result* of that selection. */
function AnimatedMethodCard({ selected, onPress, children }: { selected: boolean; onPress: () => void; children: ReactNode }) {
  const theme = useTheme();
  const progress = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(selected ? 1 : 0, { damping: 16, stiffness: 200 });
  }, [selected, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(progress.value, [0, 1], ['transparent', theme.primary]),
    transform: [{ scale: 1 + progress.value * 0.015 }],
    shadowOpacity: 0.06 + progress.value * 0.08,
  }));

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.methodCardPressed]}>
      <Animated.View
        style={[styles.methodCard, styles.methodCardShadow, { backgroundColor: theme.backgroundElement }, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

// State 1 of the payment flow: method selection. Pay at Pickup is always available;
// QR PH stays visible and tappable (so residents can see what's coming) but is gated
// behind PAYMENT_SETTLEMENT_READY — see constants/payment.ts for why this is a single
// flag rather than a per-screen guess.
export default function PaymentMethodScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  const [selected, setSelected] = useState<PaymentMethod>('pickup');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase
      .from('service_requests')
      .select('*, document_types(name, fee_centavos)')
      .eq('id', requestId)
      .single()
      .then(({ data }) => setRequest(data as ServiceRequest | null));
  }, [requestId]);

  if (request === undefined) {
    return <PaymentMethodSkeleton />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  const fee = request.document_types?.fee_centavos ?? 0;
  const totalDue = fee;
  const isQrphBlocked = selected === 'qrph' && !PAYMENT_SETTLEMENT_READY;
  // PayMongo rejects QR PH sources with amount < 100 centavos — drop it from the
  // options rather than let the resident hit a confusing error on the next screen.
  const availableOptions = PAYMENT_METHOD_OPTIONS.filter((opt) => opt.key !== 'qrph' || totalDue >= 100);

  async function handleContinue() {
    if (isQrphBlocked) return;
    setSubmitting(true);

    // A plain `.update()` here is silently swallowed by RLS — the 0002 migration
    // deliberately has no resident UPDATE policy on service_requests (status transitions
    // are admin-only). The 0010 migration adds a security-definer RPC that lets a
    // resident set *only* payment_method on rows they own, without opening a broad
    // UPDATE policy on the whole table.
    const { error } = await supabase.rpc('set_service_request_payment_method', {
      p_request_id: requestId,
      p_method: selected,
    });
    setSubmitting(false);

    if (error) {
      // Surface the error so the resident knows something went wrong rather than
      // silently navigating to a confirmation screen with stale data.
      console.error('[payment] set_service_request_payment_method:', error.message);
      return;
    }

    router.replace(
      selected === 'pickup' ? `/services/payment/pickup/${requestId}` : `/services/payment/qrph/${requestId}`,
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={styles.root}>
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
              Payment Method
            </ThemedText>
          </View>
        </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {request.document_types?.name ?? 'Document Request'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Ref #{request.reference_number}</ThemedText>

        <View style={styles.amountRow}>
          <ThemedText type="small" themeColor="textSecondary">Document Fee</ThemedText>
          <ThemedText type="small">{fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}</ThemedText>
        </View>
        <View style={styles.amountRow}>
          <ThemedText type="smallBold">Total Amount Due</ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {totalDue === 0 ? 'Free' : formatCentavosAsPHP(totalDue)}
          </ThemedText>
        </View>

        <ThemedText type="small" style={[styles.sectionLabel, styles.sectionLabelSpacing]} themeColor="textSecondary">
          Choose Payment Method
        </ThemedText>

        {availableOptions.map((option) => {
          const isSelected = selected === option.key;
          const isGated = option.key === 'qrph' && !PAYMENT_SETTLEMENT_READY;

          return (
            <AnimatedMethodCard key={option.key} selected={isSelected} onPress={() => setSelected(option.key)}>
              <View style={[styles.methodIcon, { backgroundColor: `${theme.primary}26` }]}>
                <Ionicons name={option.icon} size={22} color={theme.primary} />
              </View>
              <View style={styles.methodInfo}>
                <View style={styles.methodTitleRow}>
                  <ThemedText type="smallBold">{option.label}</ThemedText>
                  {isGated ? (
                    <View style={[styles.gatedBadge, { backgroundColor: '#F59E0B26' }]}>
                      <ThemedText type="small" style={[styles.gatedBadgeText, { color: '#B45309' }]}>
                        Setup in Progress
                      </ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {option.subtitle}
                </ThemedText>
              </View>
              <Ionicons
                name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                size={22}
                color={isSelected ? theme.primary : theme.textSecondary}
              />
            </AnimatedMethodCard>
          );
        })}

        {isQrphBlocked ? (
          <AnimatedAppear>
            <ThemedView type="backgroundElement" style={[styles.noticeCard, styles.hairline]}>
              <Ionicons name="information-circle-outline" size={18} color={theme.accentRed} />
              <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
                QR PH is being finalized by your barangay and isn&apos;t accepting live
                payments yet. Choose Pay at Pickup to continue, or check back soon.
              </ThemedText>
            </ThemedView>
          </AnimatedAppear>
        ) : null}

        {totalDue < 100 ? (
          <AnimatedAppear>
            <ThemedView type="backgroundElement" style={[styles.noticeCard, styles.hairline]}>
              <ThemedText type="small" themeColor="textSecondary">
                This request has no payable amount — QR PH is only available above ₱1.00.
              </ThemedText>
            </ThemedView>
          </AnimatedAppear>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Continue"
          loading={submitting}
          disabled={isQrphBlocked}
          onPress={handleContinue}
        />
      </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1, backgroundColor: '#F6F6F6' },
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
  hairline: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },
  sectionLabelSpacing: {
    marginTop: Spacing.three,
  },

  title: {
    fontSize: 24,
    letterSpacing: -0.3,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  methodCardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  methodCardPressed: {
    opacity: 0.96,
  },
  methodIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  methodTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  gatedBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.four,
  },
  gatedBadgeText: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noticeCard: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginTop: Spacing.one,
  },
  noticeText: {
    flex: 1,
  },
  footer: {
    padding: Spacing.four,
  },

  /* Loading skeleton */
  skeletonContainer: {
    flex: 1,
    padding: Spacing.four,
    backgroundColor: '#F6F6F6',
  },
  skeletonGap: {
    marginTop: Spacing.three,
  },
  skeletonGapSm: {
    marginTop: Spacing.one,
  },
});
