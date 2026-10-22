import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Body, Card, confirmDestructive, Notice, Screen, SymbolIcon } from '../../components/ui';
import { readableForeground, sameColor } from '../../lib/color-math';
import { DEFAULT_ACCENT } from '../../lib/palette';
import { layout, radius, space, typeScale, useColors, useType } from '../../lib/theme';
import { CustomColorSheet } from './color-picker';
import { FONT_CHOICES, MAX_CUSTOM_COLORS, PRESET_COLORS, THEME_CHOICES } from './preferences';
import { useAppearance } from './provider';

function Swatch({ color, name, selected, onPress }: { color: string; name: string; selected: boolean; onPress: () => void }) {
  const colors = useColors();
  return <Pressable accessibilityRole="radio" accessibilityLabel={name} accessibilityValue={{ text: color }} accessibilityState={{ checked: selected }} onPress={onPress}
    style={({ pressed }) => ({ width: layout.controlMin, height: layout.controlMin, borderRadius: layout.controlMin / 2, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: selected ? colors.textPrimary : 'transparent', opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
      {selected && <SymbolIcon name="checkmark" color={readableForeground(color)} size={16} />}
    </View>
  </Pressable>;
}

function ChoiceRow({ label, detail, selected, onPress, labelStyle }: { label: string; detail?: string; selected: boolean; onPress: () => void; labelStyle?: object }) {
  const colors = useColors();
  const type = useType();
  return <Pressable accessibilityRole="radio" accessibilityLabel={detail ? `${label}, ${detail}` : label} accessibilityState={{ checked: selected }} onPress={onPress}
    style={({ pressed }) => ({ minHeight: layout.listRowMin, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3], borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: selected ? colors.surfaceSelected : pressed ? colors.canvas : 'transparent' })}>
    <View style={{ flex: 1, gap: space[1] }}>
      <Text style={[type.body, labelStyle, { color: colors.textPrimary }]}>{label}</Text>
      {!!detail && <Text style={[type.footnote, { color: colors.textSecondary }]}>{detail}</Text>}
    </View>
    {selected && <SymbolIcon name="checkmark" color={colors.primary} />}
  </Pressable>;
}

/** Settings > Appearance: theme, accent colors (presets and up to ten custom) and font style. */
export function AppearanceScreen() {
  const { preferences, save, persistent, setTheme, setAccent, setFont, addCustomColor, removeCustomColor, dismissError } = useAppearance();
  const colors = useColors();
  const type = useType();
  const [picking, setPicking] = useState(false);
  const { accent, customColors, font, theme } = preferences;
  const accentName = PRESET_COLORS.find((preset) => sameColor(preset.color, accent))?.name ?? accent;

  async function confirmRemove(color: string) {
    const inUse = sameColor(color, accent);
    const confirmed = await confirmDestructive({
      title: 'Remove this custom color?',
      message: inUse ? `${color} is your current accent color. Removing it returns to the default green.` : `${color} will be removed from your saved colors.`,
      confirmLabel: 'Remove color',
    });
    if (confirmed) removeCustomColor(color);
  }

  return <Screen>
    {save.status === 'failed' && save.message && <Card><Notice tone="danger" message={save.message} /><Action label="Dismiss" secondary onPress={dismissError} /></Card>}
    {!persistent && <Notice message="Your choices last until you close the app. Log in to keep them on your account." />}

    <Card>
      <Body heading>Theme</Body>
      <View accessibilityRole="radiogroup" style={{ gap: space[1] }}>
        {THEME_CHOICES.map((choice) => <ChoiceRow key={choice.value} label={choice.label} detail={choice.detail} selected={theme === choice.value} onPress={() => setTheme(choice.value)} />)}
      </View>
    </Card>

    <Card>
      <Body heading>Accent color</Body>
      <Body tone="secondary">A touch of color for buttons and highlights. Now using {accentName}.</Body>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {PRESET_COLORS.map((preset) => <Swatch key={preset.color} color={preset.color} name={preset.name} selected={sameColor(preset.color, accent)} onPress={() => setAccent(preset.color)} />)}
      </View>
      <Body heading role="headline">Your colors</Body>
      <Body tone="secondary" role="footnote">{customColors.length} of {MAX_CUSTOM_COLORS} custom colors saved.</Body>
      {customColors.length === 0 && <Body tone="secondary" role="subheadline">You have not saved a custom color yet.</Body>}
      {customColors.map((color) => {
        const selected = sameColor(color, accent);
        return <View key={color} style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: layout.listRowMin }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: color, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
              {selected && <SymbolIcon name="checkmark" color={readableForeground(color)} size={16} />}
            </View>
            <Text style={[type.body, { flex: 1, color: colors.textPrimary }]}>{color}{selected ? ' (in use)' : ''}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: space[2] }}>
            <View style={{ flex: 1 }}><Action label={`Use ${color}`} secondary disabled={selected} onPress={() => setAccent(color)} /></View>
            <View style={{ flex: 1 }}><Action label={`Remove ${color}`} secondary destructive onPress={() => void confirmRemove(color)} /></View>
          </View>
        </View>;
      })}
      <Action label="Add custom color" hint="Opens a color picker" disabled={customColors.length >= MAX_CUSTOM_COLORS} onPress={() => setPicking(true)} />
      {customColors.length >= MAX_CUSTOM_COLORS && <Body tone="secondary" role="footnote">Remove a custom color to add another.</Body>}
    </Card>

    <Card>
      <Body heading>Font style</Body>
      <Body tone="secondary">Changes the typeface only. Text still follows your iPhone text size setting.</Body>
      <View accessibilityRole="radiogroup" style={{ gap: space[1] }}>
        {FONT_CHOICES.map((choice) => <ChoiceRow key={choice.id} label={choice.label} selected={font === choice.id}
          detail={choice.fallback ? 'Not available on iPhone; the system font is used' : choice.id === 'inter' ? 'Not bundled; the system font is used' : undefined}
          labelStyle={{ fontFamily: choice.family, fontSize: typeScale.body.fontSize }} onPress={() => setFont(choice.id)} />)}
      </View>
      {!FONT_CHOICES.some((choice) => choice.id === font) && <Notice message="Your saved font is not offered on iPhone, so the system font is used. Choose one above to change it." />}
    </Card>

    <Card>
      <Body heading>Preview</Body>
      <Body>Your barangay, closer to you.</Body>
      <Body tone="secondary">Buttons, links and selections use your accent color. Status colors keep their meaning.</Body>
      <Action label="Sample button" hint="Preview only" onPress={() => undefined} />
      <View style={{ flexDirection: 'row', gap: space[2], flexWrap: 'wrap' }}>
        {([['Success', colors.success], ['Warning', colors.warning], ['Danger', colors.danger], ['Info', colors.info]] as const).map(([name, color]) =>
          <Text key={name} style={[type.caption, { color, borderColor: color, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: space[2], paddingVertical: space[1] }]}>{name}</Text>)}
      </View>
    </Card>

    <CustomColorSheet visible={picking} initial={accent || DEFAULT_ACCENT} savedCount={customColors.length} onClose={() => setPicking(false)} onSave={addCustomColor} />
  </Screen>;
}
