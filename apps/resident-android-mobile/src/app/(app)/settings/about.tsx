import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { type ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Markdown from 'react-native-markdown-display';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAboutUs } from '@/hooks/use-about-us';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

// ─── Shimmer skeleton atom ─────────────────────────────────────────────────────
function ShimmerSkeleton({
  theme,
  height = 12,
  width = '100%',
  borderRadius = 6,
  style,
}: {
  theme: ReturnType<typeof useTheme>;
  height?: number;
  width?: number | string;
  borderRadius?: number;
  style?: object;
}) {
  const shimmer = useSharedValue(0);
  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1000 }), -1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: 0.3 + shimmer.value * 0.7,
  }));

  return (
    <Animated.View
      style={[
        { height, width: width as any, backgroundColor: theme.backgroundSelected, borderRadius },
        animStyle,
        style,
      ]}
    />
  );
}

// ─── Loading skeleton for the full screen ─────────────────────────────────────
function AboutSkeleton({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={sk.wrap}>
      {/* Logo circle */}
      <View style={sk.logoRow}>
        <ShimmerSkeleton theme={theme} width={80} height={80} borderRadius={40} />
      </View>

      {/* Three content-section skeletons */}
      {([0, 1, 2] as const).map((i) => (
        <Card key={i} style={[sk.card, { borderColor: theme.backgroundSelected }]}>
          <View style={sk.cardHead}>
            <ShimmerSkeleton theme={theme} width={36} height={36} borderRadius={10} />
            <ShimmerSkeleton theme={theme} width="45%" height={16} />
          </View>
          <View style={sk.cardBody}>
            <ShimmerSkeleton theme={theme} width="100%" height={12} />
            <ShimmerSkeleton theme={theme} width="88%" height={12} style={{ marginTop: 8 }} />
            <ShimmerSkeleton theme={theme} width="72%" height={12} style={{ marginTop: 8 }} />
          </View>
        </Card>
      ))}

      {/* Developer section skeleton */}
      <Card style={[sk.card, { borderColor: theme.backgroundSelected }]}>
        <View style={sk.cardHead}>
          <ShimmerSkeleton theme={theme} width={36} height={36} borderRadius={10} />
          <ShimmerSkeleton theme={theme} width="42%" height={16} />
        </View>
        {([0, 1] as const).map((j) => (
          <View key={j} style={[sk.devRow, { borderTopColor: theme.backgroundSelected }]}>
            <ShimmerSkeleton theme={theme} width={52} height={52} borderRadius={26} />
            <View style={{ flex: 1, gap: 6 }}>
              <ShimmerSkeleton theme={theme} width="50%" height={14} />
              <ShimmerSkeleton theme={theme} width="32%" height={10} borderRadius={12} />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { gap: Spacing.three },
  logoRow: { alignItems: 'center', paddingVertical: Spacing.two },
  card: {
    padding: Spacing.three,
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Spacing.three,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginBottom: Spacing.one,
  },
  cardBody: { gap: 8 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    marginTop: Spacing.two,
  },
});

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({
  icon,
  title,
  delay = 0,
  theme,
  children,
}: {
  icon: string;
  title: string;
  delay?: number;
  theme: ReturnType<typeof useTheme>;
  children: ReactNode;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400).delay(delay)} layout={LinearTransition.duration(250)}>
      <Card style={[styles.sectionCard, { borderColor: theme.backgroundSelected }]}>
        <View style={styles.sectionHead}>
          <View style={[styles.iconBadge, { backgroundColor: theme.primary + '18' }]}>
            <Ionicons name={icon as any} size={20} color={theme.primary} />
          </View>
          <ThemedText style={[styles.sectionTitle, { color: theme.text }]}>{title}</ThemedText>
        </View>
        <View style={[styles.sectionBody, { borderTopColor: theme.backgroundSelected }]}>
          {children}
        </View>
      </Card>
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function AboutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { profile } = useProfile();
  const { about, developers, isLoading } = useAboutUs(profile?.barangay_id ?? null);

  const markdownStyle = {
    body: { color: theme.text, fontSize: 14, lineHeight: 22, fontWeight: 500 as const },
    heading2: {
      color: theme.text,
      fontFamily: Fonts.gideonRoman,
      fontSize: 16,
      fontWeight: '600' as const,
    },
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        {/* ── Header — NOT MODIFIED ─────────────────────────────────── */}
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
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>About Us</ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <AboutSkeleton theme={theme} />
          ) : !about ? (
            /* ── Empty state ── */
            <Animated.View entering={FadeIn.duration(400)} style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="information-circle-outline" size={44} color={theme.textSecondary} />
              </View>
              <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>About Us</ThemedText>
              <ThemedText
                style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
                About Us content is not yet available.
              </ThemedText>
            </Animated.View>
          ) : (
            <View style={styles.sections}>
              {/* ── Logo + Title ── */}
              {(about.logo_url || about.title) ? (
                <Animated.View entering={FadeIn.duration(400)} style={styles.logoWrap}>
                  {about.logo_url ? (
                    <View
                      style={[
                        styles.logoRing,
                        {
                          borderColor: theme.primary + '30',
                          width: about.logo_size + 10,
                          height: about.logo_size + 10,
                          borderRadius: (about.logo_size + 10) / 2,
                        },
                      ]}>
                      <Image
                        source={{ uri: about.logo_url }}
                        style={{ width: about.logo_size, height: about.logo_size, borderRadius: about.logo_size / 2 }}
                        contentFit="cover"
                      />
                    </View>
                  ) : null}
                  {about.title ? (
                    <ThemedText style={[styles.logoTitle, { color: theme.text }]}>{about.title}</ThemedText>
                  ) : null}
                </Animated.View>
              ) : null}

              {/* ── Mission ── */}
              {about.mission ? (
                <SectionCard icon="flag-outline" title="Mission" delay={100} theme={theme}>
                  <Markdown style={markdownStyle}>{about.mission}</Markdown>
                </SectionCard>
              ) : null}

              {/* ── Vision ── */}
              {about.vision ? (
                <SectionCard icon="eye-outline" title="Vision" delay={200} theme={theme}>
                  <Markdown style={markdownStyle}>{about.vision}</Markdown>
                </SectionCard>
              ) : null}

              {/* ── History ── */}
              {about.history ? (
                <SectionCard icon="book-outline" title="History" delay={300} theme={theme}>
                  <Markdown style={markdownStyle}>{about.history}</Markdown>
                </SectionCard>
              ) : null}

              {/* ── Contact ── */}
              {(about.contact_email || about.contact_phone || about.address) ? (
                <SectionCard icon="call-outline" title="Contact" delay={400} theme={theme}>
                  <View style={styles.contactList}>
                    {about.contact_email ? (
                      <View style={styles.contactRow}>
                        <View style={[styles.contactIconWrap, { backgroundColor: theme.backgroundElement }]}>
                          <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
                        </View>
                        <ThemedText style={[styles.contactText, { color: theme.text }]}>
                          {about.contact_email}
                        </ThemedText>
                      </View>
                    ) : null}
                    {about.contact_phone ? (
                      <View style={styles.contactRow}>
                        <View style={[styles.contactIconWrap, { backgroundColor: theme.backgroundElement }]}>
                          <Ionicons name="call-outline" size={16} color={theme.textSecondary} />
                        </View>
                        <ThemedText style={[styles.contactText, { color: theme.text }]}>
                          {about.contact_phone}
                        </ThemedText>
                      </View>
                    ) : null}
                    {about.address ? (
                      <View style={styles.contactRow}>
                        <View style={[styles.contactIconWrap, { backgroundColor: theme.backgroundElement }]}>
                          <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                        </View>
                        <ThemedText style={[styles.contactText, { color: theme.text }]}>
                          {about.address}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </SectionCard>
              ) : null}

              {/* ── Development Team ── */}
              {developers.length > 0 ? (
                <SectionCard icon="people-outline" title="Development Team" delay={500} theme={theme}>
                  <View style={styles.devList}>
                    {developers.map((dev, idx) => (
                      <Animated.View
                        key={dev.id}
                        entering={FadeIn.duration(300).delay(500 + idx * 80)}>
                        <View
                          style={[
                            styles.devCard,
                            { backgroundColor: theme.backgroundElement },
                            idx > 0 && styles.devCardSpacing,
                          ]}>
                          {dev.photo_url ? (
                            <Image
                              source={{ uri: dev.photo_url }}
                              style={styles.devPhoto}
                              contentFit="cover"
                            />
                          ) : (
                            <View
                              style={[styles.devPhotoFallback, { backgroundColor: theme.primary + '20' }]}>
                              <Ionicons name="person-outline" size={22} color={theme.primary} />
                            </View>
                          )}
                          <View style={styles.devInfo}>
                            <ThemedText style={[styles.devName, { color: theme.text }]}>
                              {dev.name}
                            </ThemedText>
                            {dev.role ? (
                              <View style={[styles.roleBadge, { backgroundColor: theme.primary + '15' }]}>
                                <ThemedText style={[styles.roleText, { color: theme.primary }]}>
                                  {dev.role}
                                </ThemedText>
                              </View>
                            ) : null}
                            {dev.bio ? (
                              <ThemedText style={[styles.devBio, { color: theme.textSecondary }]}>
                                {dev.bio}
                              </ThemedText>
                            ) : null}
                          </View>
                        </View>
                      </Animated.View>
                    ))}
                  </View>
                </SectionCard>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // ── Header (UNCHANGED from original) ────────────────────────
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

  // ── Scroll content ──────────────────────────────────────────
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  sections: {
    gap: Spacing.three,
  },

  // ── Logo hero ───────────────────────────────────────────────
  logoWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  logoRing: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: {
    fontSize: 22,
    fontFamily: Fonts.gideonRoman,
    fontWeight: '700',
    textAlign: 'center',
  },

  // ── Section card ────────────────────────────────────────────
  sectionCard: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
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
    flex: 1,
  },
  sectionBody: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
  },

  // ── Contact rows ────────────────────────────────────────────
  contactList: {
    gap: Spacing.two,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  contactIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  contactText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },

  // ── Developer cards ─────────────────────────────────────────
  devList: {},
  devCardSpacing: {
    marginTop: Spacing.two,
  },
  devCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: 12,
  },
  devPhoto: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  devPhotoFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  devInfo: {
    flex: 1,
    gap: 4,
    paddingTop: 2,
  },
  devName: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  devBio: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 2,
  },

  // ── Empty state ─────────────────────────────────────────────
  emptyWrap: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
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
