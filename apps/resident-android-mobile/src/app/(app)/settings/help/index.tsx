import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useRouter } from 'expo-router';

import { PrimaryButton } from '@/components/primary-button';
import { Shimmer } from '@/components/reports/shimmer';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useFaqArticles, type FaqArticle } from '@/hooks/use-faq-articles';
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

// One glyph per FAQ category, purely a visual anchor — FAQ_CATEGORY_META (shared) only
// carries label/color, not an icon, so this stays local to the screen that needs it.
const CATEGORY_ICONS: Record<FaqCategory, keyof typeof Ionicons.glyphMap> = {
  general: 'information-circle-outline',
  services: 'briefcase-outline',
  emergency: 'alert-circle-outline',
  health: 'medkit-outline',
  billing: 'card-outline',
  account: 'person-circle-outline',
};

// ─── Article card ────────────────────────────────────────────────────────────

function FaqCard({ article, onPress }: { article: FaqArticle; onPress: () => void }) {
  const theme = useTheme();
  const category = article.category as FaqCategory;
  const meta = FAQ_CATEGORY_META[category];
  const icon = CATEGORY_ICONS[category] ?? 'help-circle-outline';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Read article: ${article.question}`}
      style={({ pressed }) => [pressed && styles.cardPressed]}>
      <ThemedView type="backgroundElement" style={[styles.articleCard, { borderColor: theme.backgroundSelected }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${meta?.color}1A` }]}>
          <Ionicons name={icon} size={19} color={meta?.color} />
        </View>
        <View style={styles.cardContent}>
          <ThemedText style={[styles.categoryLabel, { color: meta?.color }]}>{meta?.label}</ThemedText>
          <ThemedText type="smallBold" numberOfLines={1} style={styles.questionText}>
            {article.question}
          </ThemedText>
          <ThemedText themeColor="textSecondary" numberOfLines={2} style={styles.answerPreview}>
            {article.answer}
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.backgroundSelected} style={styles.chevron} />
      </ThemedView>
    </Pressable>
  );
}

// ─── Skeleton — mirrors FaqCard's own layout so the loading-in feels seamless ────

function SkeletonCard() {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.articleCard, { borderColor: theme.backgroundSelected }]}>
      <Shimmer style={styles.iconWrap} />
      <View style={[styles.cardContent, { gap: Spacing.two }]}>
        <Shimmer style={styles.skeletonBadge} />
        <Shimmer style={styles.skeletonTitle} />
        <Shimmer style={styles.skeletonLine} />
      </View>
    </ThemedView>
  );
}

// ─── Empty / error state card ───────────────────────────────────────────────

function StateCard({
  icon,
  iconColor,
  title,
  subtitle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  title: string;
  subtitle?: string;
  children?: ReactNode;
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
      {children}
    </View>
  );
}

// ─── Centered feedback pop-up for the Retry action ──────────────────────────
//
// Same visual language as ActionSuccessModal (spring/fade centered card over a dimmed
// backdrop) but self-dismissing and generic over success/error, since a manual retry
// can land either way. Stays mounted with `visible` toggled — same convention
// ActionSuccessModal uses — so RN Modal's own fade animationType plays cleanly on close.
function RetryToast({
  visible,
  kind,
  message,
}: {
  visible: boolean;
  kind: 'success' | 'error';
  message: string;
}) {
  const theme = useTheme();
  const scale = useSharedValue(0.85);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 190 });
      opacity.value = withTiming(1, { duration: 160 });
    } else {
      scale.value = 0.85;
      opacity.value = 0;
    }
  }, [visible, scale, opacity]);

  const cardAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const isSuccess = kind === 'success';
  const tint = isSuccess ? theme.primary : theme.accentRed;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.toastBackdrop}>
        <Animated.View style={[styles.toastCard, { backgroundColor: theme.backgroundElement }, cardAnimatedStyle]}>
          <View style={[styles.toastIconOuter, { backgroundColor: `${tint}26` }]}>
            <View style={[styles.toastIconInner, { backgroundColor: tint }]}>
              <Ionicons name={isSuccess ? 'checkmark' : 'close'} size={20} color={theme.onPrimary} />
            </View>
          </View>
          <ThemedText type="smallBold" style={styles.toastText}>
            {message}
          </ThemedText>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function HelpCenterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;

  const { articles, isLoading, error, refetch } = useFaqArticles(barangayId);
  const [category, setCategory] = useState<CategoryFilter>('all');

  const [isRetrying, setIsRetrying] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastContent, setToastContent] = useState<{ kind: 'success' | 'error'; message: string }>({
    kind: 'success',
    message: '',
  });

  const filtered = useMemo(() => {
    if (category === 'all') return articles;
    return articles.filter((a) => a.category === category);
  }, [articles, category]);

  // Surfaces a centered confirmation once a manually-triggered retry settles — reacts to
  // useFaqArticles' own isLoading/error state, no new fetch logic added here.
  useEffect(() => {
    if (isRetrying && !isLoading) {
      setIsRetrying(false);
      setToastContent(
        error
          ? { kind: 'error', message: 'Still unable to load. Please try again.' }
          : { kind: 'success', message: 'Help articles refreshed.' },
      );
      setToastVisible(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  useEffect(() => {
    if (!toastVisible) return;
    const timer = setTimeout(() => setToastVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [toastVisible]);

  function handleRetry() {
    setIsRetrying(true);
    refetch();
  }

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

        {/* Section 1: filter — pinned outside the ScrollView so it stays fixed in place
            while section 2 (the article list) scrolls underneath it. */}
        <View style={[styles.filterSection, { borderBottomColor: theme.backgroundSelected }]}>
          <SegmentedControl
            segments={CATEGORY_TABS}
            activeKey={category}
            onChange={(key) => setCategory(key)}
            activeColor="primary"
          />
        </View>

        {/* Section 2: articles */}
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.listContainer}>
            {isLoading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : error ? (
              <StateCard
                icon="cloud-offline-outline"
                iconColor={theme.accentRed}
                title="Unable to load help articles"
                subtitle="Check your connection and try again.">
                <View style={styles.retryBtnWrap}>
                  <PrimaryButton label="Retry" onPress={handleRetry} loading={isRetrying} />
                </View>
              </StateCard>
            ) : filtered.length === 0 ? (
              <StateCard
                icon="help-circle-outline"
                title="Nothing here yet"
                subtitle={category === 'all' ? 'No articles available yet.' : 'No articles in this category.'}
              />
            ) : (
              filtered.map((article) => (
                <FaqCard key={article.id} article={article} onPress={() => handlePress(article.id)} />
              ))
            )}
          </View>
        </ScrollView>
      </View>

      <RetryToast visible={toastVisible} kind={toastContent.kind} message={toastContent.message} />
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
  filterSection: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: {
    padding: Spacing.three,
  },
  listContainer: {
    gap: Spacing.two,
  },

  // Article card
  articleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two + 4,
    gap: Spacing.two + 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  cardPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardContent: {
    flex: 1,
    gap: 3,
  },
  categoryLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    lineHeight: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  questionText: {
    fontSize: 14.5,
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  answerPreview: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  chevron: {
    flexShrink: 0,
  },

  // Skeleton
  skeletonBadge: {
    width: '28%',
    height: 9,
    borderRadius: 5,
  },
  skeletonTitle: {
    width: '68%',
    height: 13,
    borderRadius: 6,
  },
  skeletonLine: {
    width: '90%',
    height: 11,
    borderRadius: 5,
  },

  // Empty / error state
  stateContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
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
  retryBtnWrap: {
    width: 160,
    marginTop: Spacing.two,
  },

  // Centered retry feedback pop-up
  toastBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  toastCard: {
    minWidth: 220,
    maxWidth: 300,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  toastIconOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastIconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    textAlign: 'center',
  },
});
