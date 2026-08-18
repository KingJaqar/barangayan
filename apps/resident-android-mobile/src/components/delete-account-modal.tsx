import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  /** Re-authenticates with the given password, then performs the deletion. Throws on failure. */
  onConfirm: (password: string) => Promise<void>;
}

/**
 * Password re-entry gate shown before "Delete My Account" actually runs.
 *
 * The account-deletion edge function only checks that the caller holds a
 * valid session — a left-open or stolen session could otherwise permanently
 * anonymize and ban the account with nothing but a tap on the earlier
 * Alert.alert confirm. Requiring the current password here (same
 * re-authenticate-before-mutating pattern as settings/change-password.tsx)
 * makes this last, irreversible step deliberate.
 */
export function DeleteAccountModal({ visible, onClose, onConfirm }: DeleteAccountModalProps) {
  const theme = useTheme();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      setPassword('');
      setError(null);
      setLoading(false);
    }
  }, [visible]);

  function handleClose() {
    if (loading) return; // don't let a backdrop tap interrupt an in-flight deletion
    onClose();
  }

  async function handleConfirm() {
    if (!password) {
      setError('Enter your password to continue.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onConfirm(password);
      // On success the caller (settings screen) closes this modal itself as
      // part of logging out — nothing further to do here.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not verify your password. Please try again.');
      setLoading(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ThemedText type="smallBold" style={styles.title}>
            Confirm Your Password
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            For your security, enter your password to permanently delete your account. This cannot be undone.
          </ThemedText>

          <TextField
            label="Password"
            value={password}
            onChangeText={(v) => { setPassword(v); setError(null); }}
            autoCapitalize="none"
            autoComplete="current-password"
            editable={!loading}
            passwordVisibility={{ visible: showPassword, onToggle: () => setShowPassword((v) => !v) }}
          />

          {error ? (
            <ThemedText type="small" style={[styles.error, { color: theme.accentRed }]}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={handleClose}
              disabled={loading}>
              <ThemedText style={styles.actionText}>Cancel</ThemedText>
            </Pressable>
            <View style={styles.confirmButton}>
              <PrimaryButton label="Delete Account" loading={loading} onPress={handleConfirm} variant="destructive" />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
  },
  error: {
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
    alignItems: 'stretch',
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmButton: {
    flex: 1,
  },
});
