import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Camera } from 'expo-camera';

import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useEmergencyQrContent } from '@/hooks/use-emergency-qr-content';
import { QrScannerOverlay } from '@/components/qr-scanner-overlay';
import { QrPermissionModal } from '@/components/qr-permission-modal';
import { QrShowModal } from '@/components/qr-show-modal';

export function QrGuideContent() {
  const theme = useTheme();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;
  const { content, isLoading, error, isOffline } = useEmergencyQrContent(barangayId);
  const [showScanner, setShowScanner] = useState(false);
  const [showShowQr, setShowShowQr] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  const whyScan = content.find((c) => c.section === 'why_scan');
  const howItWorks = content.find((c) => c.section === 'how_it_works');

  const handleStartScanning = useCallback(async () => {
    const { status, canAskAgain } = await Camera.getCameraPermissionsAsync();
    if (status === 'granted') {
      setShowScanner(true);
    } else if (!canAskAgain) {
      setShowPermissionModal(true);
    } else {
      setShowPermissionModal(true);
    }
  }, []);

  const handleCloseScanner = useCallback(() => {
    setShowScanner(false);
  }, []);

  const handleOpenShowQr = useCallback(() => {
    setShowShowQr(true);
  }, []);

  const handleCloseShowQr = useCallback(() => {
    setShowShowQr(false);
  }, []);

  const handleClosePermissionModal = useCallback(() => {
    setShowPermissionModal(false);
  }, []);

  const handlePermissionGranted = useCallback(() => {
    setShowPermissionModal(false);
    setShowScanner(true);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.intro}>
          <View style={styles.titleRow}>
            <ThemedText style={[styles.mainTitle, { color: theme.primary }]}>
              QR Check-In Guide
            </ThemedText>
            {isOffline && (
              <View style={[styles.offlineBadge, { borderColor: theme.primary }]}>
                <Ionicons name="wifi-outline" size={10} color={theme.primary} />
                <ThemedText style={[styles.offlineBadgeText, { color: theme.primary }]}>Offline</ThemedText>
              </View>
            )}
          </View>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Follow these quick steps to register your presence securely.
          </ThemedText>
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.startButton, { backgroundColor: theme.primary }]}
            onPress={handleStartScanning}
            accessibilityRole="button"
            accessibilityLabel="Scan QR code">
            <Ionicons name="qr-code-outline" size={20} color={theme.onPrimary} />
            <ThemedText style={[styles.startButtonText, { color: theme.onPrimary }]}>
              Scan QR
            </ThemedText>
          </Pressable>
          <Pressable
            style={[styles.startButton, { backgroundColor: theme.background, borderColor: theme.primary, borderWidth: 1 }]}
            onPress={handleOpenShowQr}
            accessibilityRole="button"
            accessibilityLabel="Show QR code">
            <Ionicons name="checkbox-outline" size={20} color={theme.primary} />
            <ThemedText style={[styles.startButtonText, { color: theme.primary }]}>
              Show QR
            </ThemedText>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ThemedText themeColor="textSecondary">Loading instructions...</ThemedText>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <ThemedText themeColor="textSecondary">Unable to load instructions.</ThemedText>
          </View>
        ) : (
          <>
            {whyScan && (
              <View style={[styles.whyCard, { backgroundColor: whyScan.icon_bg || '#FEF9E7' }]}>
                <View style={styles.whyHeader}>
                  <Ionicons name={whyScan.icon as any} size={20} color={whyScan.icon_color || theme.primary} />
                  {/* whyCard's background is a fixed light pastel from the DB (icon_bg),
                      not theme-linked — its text must stay fixed dark too, or it goes
                      invisible against the light card in dark mode. */}
                  <ThemedText type="smallBold" style={[styles.whyTitle, { color: '#1F2937' }]}>
                    {whyScan.title}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.whyBody, { color: '#4B5563' }]}>
                  {whyScan.body}
                </ThemedText>
              </View>
            )}

            {howItWorks && (() => {
              const steps = (howItWorks.content as unknown as { step: number; title: string; desc: string }[] | undefined) ?? [];
              return (
                <View style={[styles.stepsCard, { borderColor: theme.backgroundSelected }]}>
                  <ThemedText type="smallBold" style={[styles.howTitle, { color: theme.text }]}>
                    {howItWorks.title}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.howBody}>
                    {howItWorks.body}
                  </ThemedText>
                  <View style={styles.stepsContainer}>
                    {steps.map((step, idx) => (
                      <View key={idx} style={styles.stepRow}>
                        <View style={styles.stepLeft}>
                          <View style={[styles.stepNumber, { backgroundColor: theme.primary }]}>
                            <ThemedText style={[styles.stepNumberText, { color: theme.onPrimary }]}>
                              {step.step}
                            </ThemedText>
                          </View>
                        </View>
                        <View style={styles.stepContent}>
                          <View style={styles.stepTextColumn}>
                            <ThemedText type="smallBold" style={styles.stepTitle}>
                              {step.title}
                            </ThemedText>
                            <ThemedText themeColor="textSecondary" style={styles.stepBody}>
                              {step.desc}
                            </ThemedText>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })()}
          </>
        )}
      </View>

      <QrScannerOverlay visible={showScanner} onClose={handleCloseScanner} />
      <QrShowModal visible={showShowQr} onClose={handleCloseShowQr} />
      <QrPermissionModal
        visible={showPermissionModal}
        onClose={handleClosePermissionModal}
        onGranted={handlePermissionGranted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    gap: 12,
  },
  intro: {
    gap: 4,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  offlineBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  whyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F3E8C7',
    padding: 12,
    gap: 6,
  },
  whyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  whyTitle: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  whyBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  stepsCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  howTitle: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
  },
  howBody: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
    marginBottom: 12,
  },
  stepsContainer: {
    gap: 12,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepLeft: {
    alignItems: 'center',
    width: 24,
    flexShrink: 0,
  },
  stepNumber: {
    width: 24,
    minHeight: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
  },
  stepContent: {
    flex: 1,
  },
  stepTextColumn: {
    flex: 1,
    gap: 3,
  },
  stepTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  stepBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    minHeight: 48,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 12,
  },
  startButtonText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
});
