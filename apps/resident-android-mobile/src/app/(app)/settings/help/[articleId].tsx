import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Shimmer } from '@/components/reports/shimmer';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';
import { supabase } from '@/lib/supabase';
import type { FaqArticle } from '@/hooks/use-faq-articles';

// Same glyph map as the Help Center list — kept local to this screen for the same reason
// (FAQ_CATEGORY_META only carries label/color, not an icon).
const CATEGORY_ICONS: Record<FaqCategory, keyof typeof Ionicons.glyphMap> = {
  general: 'information-circle-outline',
  services: 'briefcase-outline',
  emergency: 'alert-circle-outline',
  health: 'medkit-outline',
  billing: 'card-outline',
  account: 'person-circle-outline',
};

// ─── Skeleton — mirrors the loaded layout's shape (badge, title, paragraph) ─────

function ArticleSkeleton() {
  const theme = useTheme();
  return (
    <View style={styles.skeletonWrap}>
      <Shimmer style={styles.skeletonBadge} />
      <Shimmer style={styles.skeletonTitleLine} />
      <Shimmer style={styles.skeletonTitleLineShort} />
      <View style={[styles.skeletonDivider, { backgroundColor: theme.backgroundSelected }]} />
      <Shimmer style={styles.skeletonBodyLine} />
      <Shimmer style={styles.skeletonBodyLine} />
      <Shimmer style={styles.skeletonBodyLineShort} />
      <Shimmer style={styles.skeletonBodyLine} />
      <Shimmer style={styles.skeletonBodyLineShort} />
    </View>
  );
}

// ─── Empty / error message state ────────────────────────────────────────────

function MessageState({
  icon,
  iconColor,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.stateContainer}>
      <View style={[styles.stateIconWrap, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name={icon} size={30} color={iconColor ?? theme.textSecondary} />
      </View>
      <ThemedText type="smallBold" style={styles.stateTitle}>
        {title}
      </ThemedText>
      {!!subtitle && (
        <ThemedText themeColor="textSecondary" style={styles.stateSubtitle}>
          {subtitle}
        </ThemedText>
      )}
    </View>
  );
}

// A plain `entering={FadeIn...}` prop on Animated.View gets stuck permanently invisible
// on this app's web target (confirmed on ScrollView children, not just FlatList rows) —
// a manual shared-value fade is the reliable substitute here.
function FadeInView({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 220 });
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
}

export default function HelpArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;

  const [article, setArticle] = useState<FaqArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!articleId || !barangayId) {
      setArticle(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    supabase
      .from('faq_articles')
      .select('*')
      .eq('id', articleId)
      .eq('barangay_id', barangayId)
      .eq('is_active', true)
      .is('deleted_at', null)
      .single()
      .then(({ data, error: qErr }) => {
        if (cancelled) return;
        if (qErr) {
          setError(qErr.message);
        } else {
          setArticle(data as FaqArticle | null);
        }
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [articleId, barangayId]);

  const category = article ? (article.category as FaqCategory) : null;
  const meta = category ? FAQ_CATEGORY_META[category] : null;
  const icon = category ? (CATEGORY_ICONS[category] ?? 'help-circle-outline') : 'help-circle-outline';

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
            <ThemedText style={[styles.backText, { color: theme.onPrimary }]}>‹</ThemedText>
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]} numberOfLines={1}>
              {article?.category ? FAQ_CATEGORY_META[article.category as FaqCategory]?.label : 'Help Article'}
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {isLoading ? (
            <ArticleSkeleton />
          ) : error ? (
            <MessageState
              icon="cloud-offline-outline"
              iconColor={theme.accentRed}
              title="Unable to load article"
              subtitle={error}
            />
          ) : !article ? (
            <MessageState icon="document-text-outline" title="Article not found" />
          ) : (
            <FadeInView>
              {!!meta && (
                <View style={[styles.categoryBadge, { backgroundColor: `${meta.color}1A` }]}>
                  <Ionicons name={icon} size={13} color={meta.color} />
                  <ThemedText style={[styles.categoryBadgeText, { color: meta.color }]}>{meta.label}</ThemedText>
                </View>
              )}
              <ThemedText type="heading" style={styles.questionTitle}>
                {article.question}
              </ThemedText>
              <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />
              <ThemedText type="body" style={styles.answerBody}>
                {article.answer}
              </ThemedText>
            </FadeInView>
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
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
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
  backText: {
    fontSize: 32,
    fontWeight: '300',
    lineHeight: 36,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
  },

  // Loaded article
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half + 2,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  questionTitle: {
    fontSize: 21,
    fontWeight: '700',
    letterSpacing: -0.2,
    marginTop: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.three,
  },
  answerBody: {
    fontSize: 15,
    lineHeight: 23,
  },

  // Skeleton
  skeletonWrap: {
    gap: Spacing.two + 2,
  },
  skeletonBadge: {
    width: 84,
    height: 22,
    borderRadius: Spacing.two,
  },
  skeletonTitleLine: {
    width: '92%',
    height: 20,
    borderRadius: 8,
    marginTop: Spacing.two,
  },
  skeletonTitleLineShort: {
    width: '60%',
    height: 20,
    borderRadius: 8,
  },
  skeletonDivider: {
    height: 1,
    marginVertical: Spacing.two,
  },
  skeletonBodyLine: {
    width: '100%',
    height: 13,
    borderRadius: 6,
  },
  skeletonBodyLineShort: {
    width: '70%',
    height: 13,
    borderRadius: 6,
  },

  // Empty / error state
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 56,
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  stateIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  stateTitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginTop: -Spacing.one,
  },
});
