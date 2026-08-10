import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { FAQ_CATEGORY_META } from '@/hooks/use-faq-articles';
import { supabase } from '@/lib/supabase';
import type { FaqArticle } from '@/hooks/use-faq-articles';

export default function HelpArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
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

  const meta = article ? FAQ_CATEGORY_META[article.category] : null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => {}}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}>
            <ThemedText style={[styles.backText, { color: theme.onPrimary }]}>‹</ThemedText>
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]} numberOfLines={1}>
              {article?.category ? FAQ_CATEGORY_META[article.category]?.label : 'Help Article'}
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <ThemedText themeColor="textSecondary" style={{ marginTop: Spacing.three }}>
                Loading article…
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorContainer}>
              <ThemedText themeColor="textSecondary">Unable to load article.</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">{error}</ThemedText>
            </View>
          ) : !article ? (
            <View style={styles.errorContainer}>
              <ThemedText themeColor="textSecondary">Article not found.</ThemedText>
            </View>
          ) : (
            <Animated.View entering={FadeIn.duration(300)}>
              <View style={styles.metaRow}>
                {meta && (
                  <View style={[styles.categoryBadge, { backgroundColor: `${meta.color}1A` }]}>
                    <ThemedText style={[styles.categoryBadgeText, { color: meta.color }]}>
                      {meta.label}
                    </ThemedText>
                  </View>
                )}
              </View>
              <ThemedText type="heading" style={styles.questionTitle}>
                {article.question}
              </ThemedText>
              <View style={styles.divider} />
              <ThemedText type="body" style={styles.answerBody}>
                {article.answer}
              </ThemedText>
            </Animated.View>
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
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  errorContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
  },
  categoryBadge: {
    borderRadius: 8,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  questionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: Spacing.two,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.three,
  },
  answerBody: {
    fontSize: 15,
    lineHeight: 22,
  },
});
