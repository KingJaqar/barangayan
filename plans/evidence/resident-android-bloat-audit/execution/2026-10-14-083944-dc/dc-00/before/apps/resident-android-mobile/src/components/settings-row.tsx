import { Href, Link } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function SettingsRow({
  label,
  href,
  subtitle,
}: {
  label: string;
  href: Href;
  subtitle?: string;
}) {
  return (
    <Link href={href} asChild>
      <Pressable>
        <ThemedView type="backgroundElement" style={styles.row}>
          <View>
            <ThemedText>{label}</ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText themeColor="textSecondary">{'›'}</ThemedText>
        </ThemedView>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
});
