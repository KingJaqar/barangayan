import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Presentational pill search input — no search index/backend exists yet. A real,
 * typeable TextInput (not a fake disabled-looking element), just without any wiring. */
export function SearchBar(props: TextInputProps) {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement }]}>
      <Ionicons name="search" size={18} color={theme.textSecondary} />
      <TextInput
        placeholder="Search services, news, or requests..."
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: Spacing.three,
  },
  input: {
    flex: 1,
    fontSize: 16,
  },
});
