import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/use-auth';
import { ThemedText } from './themed-text';
import { PrimaryButton } from './primary-button';

export function ProfileCompletionBanner() {
  const { session, needsCompletion } = useAuth();
  const router = useRouter();
  if (!session || needsCompletion !== true) return null;
  return <View style={{ padding: 16, gap: 8 }}><ThemedText>You can browse information now. Complete your profile before requesting documents, joining health services, or submitting reports.</ThemedText><PrimaryButton label="Complete profile" variant="secondary" onPress={() => router.push('/complete-profile')} /></View>;
}
