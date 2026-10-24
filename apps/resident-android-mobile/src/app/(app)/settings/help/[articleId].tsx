import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { helpCategory } from '@/components/settings/help-category';
import { ContentState } from '@/components/settings/managed-content';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';
import type { FaqArticle } from '@/hooks/use-faq-articles';

export default function HelpArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;
  const [article, setArticle] = useState<FaqArticle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!articleId) {
      setArticle(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    let request = supabase.from('faq_articles').select('*')
      .eq('id', articleId).eq('is_active', true).is('deleted_at', null);
    // Without a barangay (guests), RLS scopes the read, matching the Help Center list.
    if (barangayId) request = request.eq('barangay_id', barangayId);
    request.single()
      .then(({ data, error: qErr }) => {
        if (cancelled) return;
        if (qErr) setError(qErr.message);
        else setArticle(data as FaqArticle | null);
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [articleId, barangayId]);
  const meta = article ? helpCategory(article.category, resident) : null;
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: resident.card }}>
    <ServiceScreenHeader title={!isLoading && !error && meta ? meta.label : 'Help Article'} />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {isLoading ? <ContentState loading title="Loading article…" /> : error ?
        <ContentState title="Unable to load article" message="The article may no longer be available. Go back and try again." /> : !article || !meta ?
          <ContentState title="Article not found" message="This article is no longer available." /> : <View>
            <View style={[styles.badge, { backgroundColor: meta.soft }]}>
              <Ionicons name={meta.icon} size={14} color={meta.ink} accessible={false} />
              <ThemedText style={[styles.category, { color: meta.ink }]}>{meta.label}</ThemedText>
            </View>
            <ThemedText accessibilityRole="header" style={[styles.question, { color: resident.text }]}>{article.question}</ThemedText>
            <View style={[styles.divider, { backgroundColor: resident.border }]} />
            <ThemedText style={[styles.answer, { color: resident.text }]}>{article.answer}</ThemedText>
          </View>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { paddingHorizontal: 20, paddingTop: 24 },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  category: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  question: { fontSize: 23, lineHeight: 29, fontWeight: '800', marginTop: 12 },
  divider: { height: 1, marginVertical: 16 },
  answer: { fontSize: 16, lineHeight: 25 },
});
