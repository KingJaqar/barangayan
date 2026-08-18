import { useMemo, useState, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming } from 'react-native-reanimated';

import { useRouter } from 'expo-router';

import { Card } from '@/components/card';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useFaqArticles } from '@/hooks/use-faq-articles';
import { FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';

type CategoryFilter = 'all' | 'general' | 'services' | 'emergency' | 'health' | 'billing' | 'account';

const CATEGORY_TABS: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'general', label: 'General' },
  { key: 'services', label: 'Services' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'health', label: 'Health' },
  { key: 'billing', label: 'Billing' },
  { key: 'account', label: 'Account' },
];

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

export default function HelpCenterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;

  const { articles, isLoading, error, refetch } = useFaqArticles(barangayId);
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    if (category === 'all') return articles;
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  function handlePress(articleId: string) {
    router.push({ pathname: '/settings/help/[articleId]', params: { articleId } });
  }

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
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              Help Center
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <SegmentedControl
            segments={CATEGORY_TABS}
            activeKey={category}
            onChange={(key) => setCategory(key)}
            activeColor="primary"
          />

          <View style={styles.listContainer}>
            {isLoading ? (
              <View style={styles.skeletonContainer}>
                {[0, 1, 2, 3].map((i) => (
                  <View key={i} style={styles.skeletonCard}>
                    <ShimmerSkeleton theme={theme} width="60%" height={16} />
                    <ShimmerSkeleton theme={theme} width="100%" height={12} style={{ marginTop: 8 }} />
                    <ShimmerSkeleton theme={theme} width="85%" height={12} style={{ marginTop: 4 }} />
                  </View>
                ))}
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <ThemedText themeColor="textSecondary">Unable to load help articles.</ThemedText>
                <Pressable onPress={refetch} style={styles.retryButton}>
                  <ThemedText style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</ThemedText>
                </Pressable>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.emptyContainer}>
                <ThemedText themeColor="textSecondary">
                  {category === 'all' ? 'No articles available yet.' : 'No articles in this category.'}
                </ThemedText>
              </View>
            ) : (
              filtered.map((article, index) => {
                const meta = FAQ_CATEGORY_META[article.category as FaqCategory];
                return (
                  <Animated.View key={article.id} entering={FadeIn.duration(300).delay(index * 40)}>
                    <Pressable onPress={() => handlePress(article.id)}>
                      <Card style={styles.articleCard}>
                        <View style={styles.cardHeader}>
                          <View style={[styles.categoryDot, { backgroundColor: meta?.color }]} />
                          <View style={[styles.categoryBadge, { backgroundColor: `${meta?.color}1A` }]}>
                            <ThemedText style={[styles.categoryBadgeText, { color: meta?.color }]}>
                              {meta?.label}
                            </ThemedText>
                          </View>
                        </View>
                        <ThemedText type="smallBold" style={styles.questionText}>
                          {article.question}
                        </ThemedText>
                        <ThemedText
                          themeColor="textSecondary"
                          style={styles.answerPreview}
                          numberOfLines={2}>
                          {article.answer}
                        </ThemedText>
                      </Card>
                    </Pressable>
                  </Animated.View>
                );
              })
            )}
          </View>
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
    padding: Spacing.three,
    gap: Spacing.three,
  },
  listContainer: {
    gap: Spacing.three,
  },
  skeletonContainer: {
    gap: Spacing.three,
    paddingTop: Spacing.two,
  },
  skeletonCard: {
    gap: 6,
    padding: Spacing.four,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  errorContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
  },
  retryButton: {
    backgroundColor: '#0F6E5B',
    borderRadius: 20,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  emptyContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  articleCard: {
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  questionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  answerPreview: {
    fontSize: 13,
    lineHeight: 18,
  },
});
