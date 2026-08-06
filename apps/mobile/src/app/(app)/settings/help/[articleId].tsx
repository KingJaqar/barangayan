import { useLocalSearchParams } from 'expo-router';

import { PlaceholderPanel } from '@/components/placeholder-panel';

// Individual Help article, e.g. "How to verify my account", "Resetting your password" —
// the real article list from the design file lands with the "Static shells" task.
export default function HelpArticleScreen() {
  const { articleId } = useLocalSearchParams<{ articleId: string }>();
  return <PlaceholderPanel label={`Help article "${articleId}" goes here.`} />;
}
