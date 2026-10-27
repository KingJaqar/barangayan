import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

interface DeleteAccountModalProps {
  presentation?: 'default' | 'resident';
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
export function DeleteAccountModal({ visible, onClose, onConfirm, presentation = 'default' }: DeleteAccountModalProps) {
  const theme = useTheme();
  const resident = presentation === 'resident';
  const reducedMotion = useResidentReducedMotion(resident);
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resident) return;
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reducedMotion ? 100 : 200, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, resident, reducedMotion, progress]);

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

  const passwordField = (
    <TextField
      presentation={presentation}
      label="Password"
      value={password}
      onChangeText={(v) => { setPassword(v); setError(null); }}
      autoCapitalize="none"
      autoComplete="current-password"
      editable={!loading}
      passwordVisibility={{ visible: showPassword, onToggle: () => setShowPassword((v) => !v) }}
    />
  );

  const sheet = (
        <Pressable accessible={resident ? false : undefined} accessibilityViewIsModal={resident || undefined} style={[styles.sheet, { backgroundColor: theme.background }, resident && { backgroundColor: theme.resident.card, borderRadius: 24, paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24, gap: 0 }]} onPress={(e) => e.stopPropagation()}>
          {!resident ? <View style={styles.handle} /> : null}
          <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, resident && styles.residentTitle]}>
            Confirm Your Password
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={[styles.subtitle, resident && { color: theme.resident.muted }, resident && styles.residentSubtitle]}>
            For your security, enter your password to permanently delete your account. This cannot be undone.
          </ThemedText>

          {resident ? <View style={styles.residentPassword}>{passwordField}</View> : passwordField}

          {error ? (
            <ThemedText type="small" accessibilityRole={resident ? 'alert' : undefined} style={[styles.error, resident && styles.residentError, { color: resident ? theme.resident.danger : theme.accentRed }]}>
              {error}
            </ThemedText>
          ) : null}

          <View style={[styles.actionsRow, resident && styles.residentActions]}>
            {resident ? <View style={styles.confirmButton}><PrimaryButton presentation="resident" label="Cancel" variant="secondary" disabled={loading} onPress={handleClose} /></View> : <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]}
              onPress={handleClose}
              disabled={loading}>
              <ThemedText style={styles.actionText}>Cancel</ThemedText>
            </Pressable>}
            <View style={styles.confirmButton}>
              {resident ? <PrimaryButton presentation="resident" label="Delete" loading={loading} onPress={handleConfirm} variant="destructiveFilled" /> : <PrimaryButton label="Delete Account" loading={loading} onPress={handleConfirm} variant="destructive" />}
            </View>
          </View>
        </Pressable>
  );
  return (
    <Modal visible={resident ? mounted : visible} transparent animationType={resident ? 'none' : 'fade'} onRequestClose={handleClose}>
      {resident ? <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} style={{ flex: 1 }}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.resident.scrim, opacity: progress }]}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cancel account deletion" onPress={handleClose} /></Animated.View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <Pressable accessible={false} onPress={handleClose} style={{ flex: 1, justifyContent: 'center', padding: 32 }}>
            <Animated.View style={{ opacity: progress, transform: [{ scale: reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }}>{sheet}</Animated.View>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView> : <Pressable style={styles.overlay} onPress={handleClose}>{sheet}</Pressable>}
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
  residentTitle: {
    fontSize: 19,
    lineHeight: 28.5,
    fontWeight: '800',
    textAlign: 'left',
  },
  residentSubtitle: {
    fontSize: 14.5,
    lineHeight: 20,
    textAlign: 'left',
    marginTop: 6,
  },
  residentPassword: {
    marginTop: 16,
  },
  residentError: {
    textAlign: 'left',
    marginTop: 8,
  },
  residentActions: {
    gap: 12,
    marginTop: 24,
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
