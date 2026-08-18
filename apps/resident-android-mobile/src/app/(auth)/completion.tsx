// This screen is no longer used in the primary registration flow — signup OTP
// was removed when Confirm Email was disabled (migration 0012). The file is kept
// to avoid breaking any deep-link or back-stack reference while the codebase
// transitions; it can be deleted once all entry points have been audited.
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export default function CompletionScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          You're all set.
        </ThemedText>
        <ThemedText themeColor="textSecondary">Explore the services of Barangayan.</ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  title: {
    fontSize: 28,
  },
});
