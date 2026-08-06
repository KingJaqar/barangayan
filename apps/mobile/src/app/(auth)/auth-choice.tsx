import { useRouter } from 'expo-router';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function AuthChoiceScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          One barangay, one account.
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Join your community platform to stay connected, informed, and engaged.
        </ThemedText>

        <View style={styles.optionList}>
          <ChoiceRow
            title="I'm a Resident, Log In"
            subtitle="Access your existing community profile"
            onPress={() => router.push('/(auth)/login')}
          />
          <ChoiceRow
            title="I'm New Here, Create an Account"
            subtitle="Register with your local barangay"
            highlighted
            onPress={() => router.push('/(auth)/register')}
          />
          <ChoiceRow
            title="I'll Sign In Later"
            subtitle="Browse public community updates (coming soon)"
            disabled
            onPress={() => {}}
          />
        </View>
      </View>
    </SafeAreaView>
  );

  function ChoiceRow({
    title,
    subtitle,
    onPress,
    highlighted,
    disabled,
  }: {
    title: string;
    subtitle: string;
    onPress: () => void;
    highlighted?: boolean;
    disabled?: boolean;
  }) {
    return (
      <Pressable onPress={onPress} disabled={disabled}>
        <ThemedView
          type={highlighted ? undefined : 'backgroundElement'}
          style={[
            styles.choiceRow,
            highlighted && { backgroundColor: theme.primary },
            disabled && styles.disabledRow,
          ]}>
          <ThemedText
            type="smallBold"
            style={highlighted ? { color: theme.onPrimary } : undefined}>
            {title}
          </ThemedText>
          <ThemedText
            type="small"
            themeColor={highlighted ? undefined : 'textSecondary'}
            style={highlighted ? { color: theme.onPrimary, opacity: 0.85 } : undefined}>
            {subtitle}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
  },
  optionList: {
    gap: Spacing.two,
  },
  choiceRow: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  disabledRow: {
    opacity: 0.5,
  },
});
