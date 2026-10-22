import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Action, Body, Card, SymbolIcon, Notice } from '../../components/ui';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { readableForeground, sameColor } from '../../lib/color-math';
import { useAppearance } from '../appearance/provider';
import { FONT_CHOICES, PRESET_COLORS, THEME_CHOICES } from '../appearance/preferences';
import { OnboardingFrame, useLeaveIntroduction } from './frame';

const LOGO = require('../../../assets/barangayan-logo-1024.png') as number;

const FEATURES = [
  { title: 'Report incidents', body: 'Let your barangay know about non-emergency issues.', icon: 'megaphone' },
  { title: 'Request documents', body: 'Apply for clearances and certificates from your phone.', icon: 'doc.text' },
  { title: 'Stay informed', body: 'Keep up with trusted updates from your barangay.', icon: 'bell' },
] as const;

export function WelcomeScreen() {
  const router = useRouter();
  return <OnboardingFrame step={1} depth={1} centered eyebrow="Welcome to Barangayan" title="Your barangay, closer to you." description="Everyday services, local updates, and your community. All in one place."
    primaryLabel="Continue" onNext={() => router.push('/onboarding/value-prop')}>
    <Image source={LOGO} accessibilityLabel="Barangayan logo" style={{ width: 88, height: 88 }} resizeMode="contain" />
  </OnboardingFrame>;
}

export function ValuePropScreen() {
  const router = useRouter();
  const colors = useColors();
  const type = useType();
  return <OnboardingFrame step={2} depth={2} eyebrow="Your community, connected" title="A little less effort. A lot more connection." description="Take care of everyday barangay needs, wherever you are."
    primaryLabel="Continue" onNext={() => router.push('/onboarding/personalization')}>
    <View style={{ gap: space[3] }}>
      {FEATURES.map((feature) => <View key={feature.title} accessible accessibilityLabel={`${feature.title}. ${feature.body}`}
        style={{ flexDirection: 'row', gap: space[4], alignItems: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, borderCurve: 'continuous', padding: space[4] }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center' }}>
          <SymbolIcon name={feature.icon} color={colors.primary} size={22} />
        </View>
        <View style={{ flex: 1, gap: space[1] }}>
          <Text style={[type.headline, { color: colors.textPrimary }]}>{feature.title}</Text>
          <Text style={[type.subheadline, { color: colors.textSecondary }]}>{feature.body}</Text>
        </View>
      </View>)}
    </View>
  </OnboardingFrame>;
}

export function PersonalizationScreen() {
  const router = useRouter();
  const colors = useColors();
  const type = useType();
  const { preferences, setTheme, setAccent, persistent } = useAppearance();
  const [message, setMessage] = useState('');
  return <OnboardingFrame step={3} depth={3} eyebrow="A personal touch" title="Make it yours." description="Choose the look that feels right for you. Changes show right away."
    primaryLabel="Get started" onNext={() => router.push('/onboarding/completion')}>
    <View style={{ gap: space[3] }}>
      <Text accessibilityRole="header" style={[type.title2, { color: colors.textPrimary }]}>Appearance</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {THEME_CHOICES.map((choice) => {
          const selected = preferences.theme === choice.value;
          return <Pressable key={choice.value} accessibilityRole="radio" accessibilityLabel={`${choice.label} appearance`} accessibilityHint={choice.detail} accessibilityState={{ checked: selected }}
            onPress={() => { setTheme(choice.value); setMessage(choice.value === 'system' ? 'Following your iPhone appearance' : `${choice.label} mode enabled`); }}
            style={({ pressed }) => ({ flexGrow: 1, minWidth: 96, minHeight: layout.listRowMin, padding: space[3], gap: space[2], borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 2, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceSelected : colors.surface, opacity: pressed ? 0.7 : 1 })}>
            <SymbolIcon name={choice.value === 'light' ? 'sun.max' : choice.value === 'dark' ? 'moon' : 'circle.lefthalf.filled'} color={colors.textPrimary} size={22} />
            <Text style={[type.callout, { color: colors.textPrimary, fontWeight: '600' }]}>{choice.label}</Text>
          </Pressable>;
        })}
      </View>
    </View>
    <View style={{ gap: space[3] }}>
      <Text accessibilityRole="header" style={[type.title2, { color: colors.textPrimary }]}>Accent color</Text>
      <Text style={[type.subheadline, { color: colors.textSecondary }]}>A touch of color for buttons and highlights.</Text>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
        {PRESET_COLORS.map((preset) => {
          const selected = sameColor(preset.color, preferences.accent);
          return <Pressable key={preset.color} accessibilityRole="radio" accessibilityLabel={preset.name} accessibilityState={{ checked: selected }}
            onPress={() => { setAccent(preset.color); setMessage('Accent color updated'); }}
            style={({ pressed }) => ({ width: layout.controlMin, height: layout.controlMin, borderRadius: layout.controlMin / 2, borderWidth: 2, borderColor: selected ? colors.textPrimary : 'transparent', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: preset.color, alignItems: 'center', justifyContent: 'center' }}>
              {selected && <SymbolIcon name="checkmark" color={readableForeground(preset.color)} size={16} />}
            </View>
          </Pressable>;
        })}
      </View>
    </View>
    <Card>
      <Body heading role="headline">Preview</Body>
      <Body tone="secondary" role="subheadline">Buttons, links and selections use your accent color.</Body>
      <Action label="Sample button" hint="Preview only" onPress={() => undefined} />
    </Card>
    {!!message && <Notice message={message} />}
    <Body tone="secondary" role="footnote">{persistent ? 'These choices are saved to your account.' : 'These choices last until you close the app.'} You can change them anytime in Settings.</Body>
  </OnboardingFrame>;
}

export function CompletionScreen() {
  const colors = useColors();
  const leave = useLeaveIntroduction(4);
  const { preferences } = useAppearance();
  const theme = THEME_CHOICES.find((choice) => choice.value === preferences.theme)?.label ?? 'System';
  const accent = PRESET_COLORS.find((preset) => sameColor(preset.color, preferences.accent))?.name ?? preferences.accent;
  const font = FONT_CHOICES.find((choice) => choice.id === preferences.font)?.label ?? 'System Default';
  return <View style={{ flex: 1, backgroundColor: colors.canvas, padding: layout.margin, gap: space[5], justifyContent: 'center' }}>
    <Body heading role="title1">You&apos;re all set.</Body>
    <Body tone="secondary">Explore the services of Barangayan. Your appearance: {theme} theme, {accent} accent, {font} font.</Body>
    <Action label="Continue" onPress={() => void leave()} />
  </View>;
}
