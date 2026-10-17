import { Pressable, ScrollView, Text, View } from 'react-native';
import { layout, radius, space, useColors, useType } from '../../lib/theme';

/**
 * One row of peer filters that scrolls sideways, so every option stays reachable at any text size. Each chip says what it
 * is and whether it is selected; the row's label names the filter for VoiceOver.
 */
export function FilterChips<T extends string>({ label, options, selected, onChange }: { label: string; options: readonly { value: T; label: string; detail?: string }[]; selected: T; onChange: (value: T) => void }) {
  const colors = useColors();
  const type = useType();
  return <View accessibilityRole="tablist" accessibilityLabel={label}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space[2], paddingVertical: space[1] }}>
      {options.map((option) => {
        const active = option.value === selected;
        const name = option.detail ? `${option.label}, ${option.detail}` : option.label;
        return <Pressable key={option.value} accessibilityRole="tab" accessibilityLabel={name} accessibilityState={{ selected: active }} onPress={() => { if (!active) onChange(option.value); }}
          style={({ pressed }) => ({ minHeight: layout.controlMin, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceSelected : colors.surface, opacity: pressed ? 0.7 : 1 })}>
          <Text style={[type.subheadline, { color: colors.textPrimary, fontWeight: active ? '700' : '400' }]}>{option.detail ? `${option.label} (${option.detail})` : option.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}
