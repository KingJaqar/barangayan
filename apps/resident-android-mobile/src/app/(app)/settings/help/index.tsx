import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { FAQ_CATEGORIES, FAQ_CATEGORY_META, type FaqCategory } from '@barangayan/shared';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { helpCategory } from '@/components/settings/help-category';
import { ContentState } from '@/components/settings/managed-content';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useFaqArticles } from '@/hooks/use-faq-articles';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

type CategoryFilter = 'all' | FaqCategory;
const categories: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All' }, ...FAQ_CATEGORIES.map(key => ({ key, label: FAQ_CATEGORY_META[key].label })),
];

function CategoryChip({ category, selected, onPress }: { category: (typeof categories)[number]; selected: boolean; onPress: () => void }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [pressed, setPressed] = useState(false);
  const color = selected ? (pressed ? resident.accentPressed : resident.accent) : pressed ? resident.pressed : resident.card;
  const fill = useSharedValue(color);
  useEffect(() => {
    fill.value = reducedMotion ? color : withTiming(color, { duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    return () => cancelAnimation(fill);
  }, [color, fill, reducedMotion]);
  const feedback = useAnimatedStyle(() => ({ backgroundColor: fill.value }));
  const foreground = selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : resident.text;
  return <Pressable accessibilityRole="tab" accessibilityLabel={category.label} accessibilityState={{ selected }} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}>
    <Animated.View style={[styles.chip, { borderColor: selected ? resident.accentText : resident.border }, feedback]}>
      <Ionicons name={category.key === 'all' ? 'grid-outline' : helpCategory(category.key, resident).icon} size={16} color={foreground} accessible={false} />
      <ThemedText type="smallBold" style={{ color: foreground }}>{category.label}</ThemedText>
    </Animated.View>
  </Pressable>;
}
export default function HelpCenterScreen() {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useProfile();
  const { articles, isLoading, error, refetch } = useFaqArticles(profile?.barangay_id ?? null);
  const [category, setCategory] = useState<CategoryFilter>('all');
  const filtered = category === 'all' ? articles : articles.filter(article => article.category === category);
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: resident.card }}>
    <ServiceScreenHeader title="Help Center" />
    <View style={[styles.filters, { borderBottomColor: resident.border }]}>
      <ScrollableChevronRow label="help categories" contentContainerStyle={styles.chips}>
        {categories.map(tab => <CategoryChip key={tab.key} category={tab} selected={category === tab.key} onPress={() => setCategory(tab.key)} />)}
      </ScrollableChevronRow>
    </View>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {isLoading ? <ContentState loading title="Loading help articles…" /> : error ?
        <ContentState title="Unable to load help articles" message="Check your connection and try again." onRetry={refetch} /> : <>
          <ThemedText accessibilityLiveRegion="polite" style={[styles.count, { color: resident.muted }]}>{filtered.length} {filtered.length === 1 ? 'article' : 'articles'}</ThemedText>
          {filtered.length ? <View style={[styles.panel, { borderColor: resident.border }]}>
            {filtered.map((article, index) => {
              const meta = helpCategory(article.category, resident);
              return <Pressable key={article.id} accessibilityRole="button" accessibilityLabel={`Read article: ${article.question}`}
                onPress={() => router.push({ pathname: '/settings/help/[articleId]', params: { articleId: article.id } })}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? resident.pressed : resident.card, borderTopColor: resident.border, borderTopWidth: index ? 1 : 0 }]}>
                <View style={[styles.icon, { backgroundColor: meta.soft }]}><Ionicons name={meta.icon} size={20} color={meta.ink} accessible={false} /></View>
                <View style={styles.text}>
                  <ThemedText style={[styles.category, { color: meta.ink }]}>{meta.label}</ThemedText>
                  <ThemedText numberOfLines={2} style={[styles.question, { color: resident.text }]}>{article.question}</ThemedText>
                  <ThemedText numberOfLines={2} style={[styles.answer, { color: resident.muted }]}>{article.answer}</ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={20} color={resident.muted} style={{ marginTop: 10 }} accessible={false} />
              </Pressable>;
            })}
          </View> : <ContentState title="Nothing here yet" message={category === 'all' ? 'No articles available yet.' : 'No articles in this category.'} />}
        </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  filters: { paddingVertical: 8, borderBottomWidth: 1 },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: 16 },
  chip: { minHeight: 44, borderRadius: 24, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 6 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  count: { fontSize: 13, lineHeight: 19, marginBottom: 8, paddingHorizontal: 4 },
  panel: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  row: { paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, minWidth: 0, gap: 2 },
  category: { fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
  question: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  answer: { fontSize: 13.5, lineHeight: 19 },
});
