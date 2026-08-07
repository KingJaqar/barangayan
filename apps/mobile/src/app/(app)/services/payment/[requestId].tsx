import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, type PaymentMethod, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PAYMENT_METHOD_OPTIONS, PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
};

// State 1 of the payment flow: method selection. COD is always available; QR Ph stays
// visible and tappable (so residents can see what's coming) but is gated behind
// PAYMENT_SETTLEMENT_READY — see constants/payment.ts for why this is a single flag
// rather than a per-screen guess.
export default function PaymentMethodScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();

  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  const [selected, setSelected] = useState<PaymentMethod>('cash');
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
    return <PlaceholderPanel label="Loading…" />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  const fee = request.document_types?.fee_centavos ?? 0;
  const isQrphBlocked = selected === 'qrph' && !PAYMENT_SETTLEMENT_READY;

  async function handleContinue() {
    if (isQrphBlocked) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('service_requests')
      .update({ payment_method: selected })
      .eq('id', requestId);
    setSubmitting(false);

    if (error) return;

    router.replace(
      selected === 'cash' ? `/services/payment/cod/${requestId}` : `/services/payment/qrph/${requestId}`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {request.document_types?.name ?? 'Document Request'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Ref #{request.reference_number}</ThemedText>

        <View style={styles.amountRow}>
          <ThemedText type="small">Amount Due</ThemedText>
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}
          </ThemedText>
        </View>

        <ThemedText type="smallBold" style={styles.sectionLabel}>
          Choose Payment Method
        </ThemedText>

        {PAYMENT_METHOD_OPTIONS.map((option) => {
          const isSelected = selected === option.key;
          const isGated = option.key === 'qrph' && !PAYMENT_SETTLEMENT_READY;

          return (
            <Pressable key={option.key} onPress={() => setSelected(option.key)}>
              <ThemedView
                type="backgroundElement"
                style={[
                  styles.methodCard,
                  isSelected && { borderColor: theme.primary, borderWidth: 2 },
                ]}>
                <View style={[styles.methodIcon, { backgroundColor: `${theme.primary}26` }]}>
                  <Ionicons name={option.icon} size={22} color={theme.primary} />
                </View>
                <View style={styles.methodInfo}>
                  <View style={styles.methodTitleRow}>
                    <ThemedText type="smallBold">{option.label}</ThemedText>
                    {isGated ? (
                      <View style={[styles.gatedBadge, { backgroundColor: '#F59E0B26' }]}>
                        <ThemedText type="small" style={{ color: '#B45309' }}>
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
              </ThemedView>
            </Pressable>
          );
        })}

        {isQrphBlocked ? (
          <ThemedView type="backgroundElement" style={styles.noticeCard}>
            <Ionicons name="information-circle-outline" size={18} color={theme.accentRed} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.noticeText}>
              QR Ph is being finalized by your barangay and isn&apos;t accepting live
              payments yet. Choose Cash on Delivery to continue, or check back soon.
            </ThemedText>
          </ThemedView>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.two,
  },
  sectionLabel: {
    marginTop: Spacing.three,
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
});
