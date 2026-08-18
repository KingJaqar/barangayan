import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP } from '@barangayan/shared';
import { Modal, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Centered confirmation shown the instant a QR Ph payment is detected as paid (whether
 * the resident is still looking at the QR screen or just switched back to the app from
 * their bank/e-wallet app). Tapping OK is what actually navigates to the success screen
 * — see payment/qrph/[requestId].tsx — rather than auto-navigating the moment `status`
 * flips to 'paid', so the resident gets a clear, deliberate confirmation step.
 */
export function PaymentSuccessModal({
  visible,
  amountCentavos,
  onConfirm,
}: {
  visible: boolean;
  amountCentavos: number;
  onConfirm: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <View style={[styles.checkOuter, { backgroundColor: `${theme.primary}26` }]}>
            <View style={[styles.checkInner, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={32} color={theme.onPrimary} />
            </View>
          </View>
          <ThemedText type="title" style={styles.title}>
            Payment Successful
          </ThemedText>
          <ThemedText type="title" style={[styles.amount, { color: theme.primary }]}>
            {formatCentavosAsPHP(amountCentavos)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
            We've received your payment via QR Ph.
          </ThemedText>
          <View style={styles.buttonRow}>
            <PrimaryButton label="OK" onPress={onConfirm} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: Spacing.three,
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.one,
  },
  checkOuter: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  checkInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    textAlign: 'center',
  },
  amount: {
    fontSize: 24,
  },
  caption: {
    textAlign: 'center',
    marginBottom: Spacing.two,
  },
  buttonRow: {
    width: '100%',
  },
});
