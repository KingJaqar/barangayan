import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, LinearTransition, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useSiteContent } from '@/hooks/use-site-content';
import { useTheme } from '@/hooks/use-theme';

function ShimmerSkeleton({
  theme,
  height = 12,
  width = '100%',
  style,
  borderRadius = 6,
}: {
  theme: ReturnType<typeof useTheme>;
  height?: number;
  width?: number | string;
  style?: object;
  borderRadius?: number;
}) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.7,
  }));

  return (
    <Animated.View
      style={[
        { height, width: width as any, backgroundColor: theme.backgroundSelected, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

function PolicySkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <Card style={[styles.skeletonCard, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <View style={styles.skeletonHeader}>
        <View style={[styles.skeletonIcon, { backgroundColor: theme.backgroundSelected }]} />
        <View style={[styles.skeletonTitle, { backgroundColor: theme.backgroundSelected }]} />
      </View>
      <View style={styles.skeletonBody}>
        <ShimmerSkeleton theme={theme} width="100%" height={12} />
        <ShimmerSkeleton theme={theme} width="90%" height={12} style={{ marginTop: 8 }} />
        <ShimmerSkeleton theme={theme} width="95%" height={12} style={{ marginTop: 8 }} />
        <ShimmerSkeleton theme={theme} width="60%" height={12} style={{ marginTop: 8 }} />
      </View>
    </Card>
  );
}

export default function TermsPrivacyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { profile } = useProfile();
  const { items, isLoading } = useSiteContent(profile?.barangay_id ?? null);

  const terms = items.find((i) => i.section === 'terms_of_service');
  const privacy = items.find((i) => i.section === 'privacy_policy');

  const [expandedTerms, setExpandedTerms] = useState(true);
  const [expandedPrivacy, setExpandedPrivacy] = useState(true);

  const termsRotation = useSharedValue(0);
  const privacyRotation = useSharedValue(0);

  const termsChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${termsRotation.value * 180}deg` }],
  }));

  const privacyChevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${privacyRotation.value * 180}deg` }],
  }));

  const toggleTerms = () => {
    setExpandedTerms((prev) => {
      termsRotation.value = withSpring(prev ? 1 : 0);
      return !prev;
    });
  };

  const togglePrivacy = () => {
    setExpandedPrivacy((prev) => {
      privacyRotation.value = withSpring(prev ? 1 : 0);
      return !prev;
    });
  };

  const markdownStyle = {
    body: { color: theme.text, fontSize: 14, lineHeight: 22, fontWeight: 500 },
    heading1: { color: theme.text, fontFamily: Fonts.gideonRoman, fontSize: 20, fontWeight: 700, marginTop: Spacing.three, marginBottom: Spacing.two },
    heading2: { color: theme.text, fontFamily: Fonts.gideonRoman, fontSize: 18, fontWeight: 600, marginTop: Spacing.two, marginBottom: Spacing.two },
    strong: { fontWeight: 700 },
    bullet_list: { marginBottom: Spacing.two },
    list_item: { marginBottom: 4 },
  } as const;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
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
              Terms & Privacy Policy
            </ThemedText>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {isLoading ? (
            <View style={styles.skeletonContainer}>
              <PolicySkeleton theme={theme} />
              <PolicySkeleton theme={theme} />
            </View>
          ) : !terms && !privacy ? (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyIconContainer, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="document-text-outline" size={48} color={theme.textSecondary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
                Content Coming Soon
              </ThemedText>
              <ThemedText style={{ color: theme.textSecondary, textAlign: 'center', marginTop: Spacing.one }}>
                Terms of Service / Privacy Policy content is not yet available.
              </ThemedText>
            </View>
          ) : (
            <View style={styles.sections}>
              {terms && (
                <Animated.View entering={FadeIn.duration(400).delay(100)} layout={LinearTransition.duration(250)}>
                  <Card style={[styles.sectionCard, { borderColor: theme.backgroundSelected }]}>
                    <Pressable
                      onPress={toggleTerms}
                      style={styles.sectionHeader}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: expandedTerms }}>
                      <View style={styles.sectionHeaderLeft}>
                        <View style={[styles.iconBadge, { backgroundColor: theme.primary + '15' }]}>
                          <Ionicons name="document-text-outline" size={20} color={theme.primary} />
                        </View>
                        <ThemedText type="heading" style={styles.sectionTitle}>
                          {terms.title}
                        </ThemedText>
                      </View>
                      <Animated.View style={termsChevronStyle}>
                        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                      </Animated.View>
                    </Pressable>
                    <Animated.View layout={LinearTransition.duration(250)}>
                      {expandedTerms && (
                        <View style={[styles.sectionContent, { borderTopColor: theme.backgroundSelected }]}>
                          <Markdown style={markdownStyle}>{`# ${terms.title}\n\n${terms.body}`}</Markdown>
                        </View>
                      )}
                    </Animated.View>
                  </Card>
                </Animated.View>
              )}
              {privacy && (
                <Animated.View entering={FadeIn.duration(400).delay(200)} layout={LinearTransition.duration(250)}>
                  <Card style={[styles.sectionCard, { borderColor: theme.backgroundSelected }]}>
                    <Pressable
                      onPress={togglePrivacy}
                      style={styles.sectionHeader}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: expandedPrivacy }}>
                      <View style={styles.sectionHeaderLeft}>
                        <View style={[styles.iconBadge, { backgroundColor: theme.primary + '15' }]}>
                          <Ionicons name="shield-checkmark-outline" size={20} color={theme.primary} />
                        </View>
                        <ThemedText type="heading" style={styles.sectionTitle}>
                          {privacy.title}
                        </ThemedText>
                      </View>
                      <Animated.View style={privacyChevronStyle}>
                        <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
                      </Animated.View>
                    </Pressable>
                    <Animated.View layout={LinearTransition.duration(250)}>
                      {expandedPrivacy && (
                        <View style={[styles.sectionContent, { borderTopColor: theme.backgroundSelected }]}>
                          <Markdown style={markdownStyle}>{`# ${privacy.title}\n\n${privacy.body}`}</Markdown>
                        </View>
                      )}
                    </Animated.View>
                  </Card>
                </Animated.View>
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },
  content: {
    padding: Spacing.three,
  },
  sections: {
    gap: Spacing.three,
  },
  sectionCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.gideonRoman,
    fontWeight: '600',
  },
  sectionContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },
  skeletonContainer: {
    gap: Spacing.three,
  },
  skeletonCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  skeletonIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
  },
  skeletonTitle: {
    height: 18,
    width: '40%',
    borderRadius: 6,
  },
  skeletonBody: {
    gap: 8,
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: Fonts.gideonRoman,
    fontWeight: '600',
  },
});
