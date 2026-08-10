import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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
  const { content, isLoading, error } = useEmergencyQrContent(barangayId);
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}>
        <ThemedText style={[styles.mainTitle, { color: theme.primary }]}>
          QR Check-In Guide
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Follow these quick steps to register your presence securely.
        </ThemedText>

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
                <View style={[styles.shieldIconContainer, { backgroundColor: whyScan.icon_bg || '#FEF9E7' }]}>
                  <Ionicons name={whyScan.icon as any} size={28} color={whyScan.icon_color || theme.primary} />
                </View>
                <View style={styles.whyTextContainer}>
                  <ThemedText type="smallBold" style={styles.whyTitle}>
                    {whyScan.title}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.whyBody}>
                    {whyScan.body}
                  </ThemedText>
                </View>
              </View>
            )}

            {howItWorks && (() => {
              const steps = (howItWorks.content as unknown as { step: number; title: string; desc: string }[] | undefined) ?? [];
              return (
                <View>
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
                          {idx < steps.length - 1 && (
                            <View style={styles.stepLine} />
                          )}
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

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.startButton, { backgroundColor: theme.primary }]}
            onPress={handleStartScanning}
            accessibilityRole="button"
            accessibilityLabel="Scan QR code">
            <Ionicons name="qr-code-outline" size={22} color={theme.onPrimary} />
            <ThemedText style={[styles.startButtonText, { color: theme.onPrimary }]}>
              Scan QR
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.startButton, styles.secondaryButton, { backgroundColor: theme.background, borderColor: theme.primary, borderWidth: 1 }]}
            onPress={handleOpenShowQr}
            accessibilityRole="button"
            accessibilityLabel="Show QR code">
            <Ionicons name="checkbox-outline" size={22} color={theme.primary} />
            <ThemedText style={[styles.startButtonText, { color: theme.primary }]}>
              Show QR
            </ThemedText>
          </Pressable>
        </View>
      </ScrollView>

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
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -Spacing.three,
  },
  whyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3E8C7',
    padding: Spacing.four,
    gap: Spacing.three,
  },
  shieldIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  whyTextContainer: {
    flex: 1,
    gap: Spacing.one,
  },
  whyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000000',
  },
  whyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#60646C',
  },
  howTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  howBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#60646C',
    marginBottom: Spacing.three,
  },
  stepsContainer: {
    gap: Spacing.four,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepLeft: {
    alignItems: 'center',
    width: 32,
    flexShrink: 0,
    position: 'relative',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700',
  },
  stepLine: {
    position: 'absolute',
    top: 32,
    bottom: -20,
    left: 15,
    width: 2,
    backgroundColor: '#0F6E5B',
    opacity: 0.3,
  },
  stepContent: {
    flex: 1,
    paddingBottom: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepTextColumn: {
    flex: 1,
    gap: Spacing.one,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  stepBody: {
    fontSize: 14,
    lineHeight: 20,
    color: '#60646C',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  startButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: 26,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  secondaryButton: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
});
