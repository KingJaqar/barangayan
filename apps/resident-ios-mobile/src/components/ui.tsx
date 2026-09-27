import { Button as NativeButton, Host, Switch as NativeSwitch } from '@expo/ui';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, useColorScheme, type TextInputProps } from 'react-native';

export function usePalette() {
  const dark = useColorScheme() === 'dark';
  return { background: dark ? '#000000' : '#F2F2F7', surface: dark ? '#1C1C1E' : '#FFFFFF', text: dark ? '#FFFFFF' : '#171A19', secondary: dark ? '#BFC7C3' : '#505A55', line: dark ? '#454B48' : '#CED5D0', accent: dark ? '#71D9B9' : '#0F6E5B', danger: dark ? '#FFB4AB' : '#93000A' };
}
export function Body({ children, heading = false }: { children: ReactNode; heading?: boolean }) {
  const palette = usePalette();
  return <Text selectable accessibilityRole={heading ? 'header' : undefined} style={{ color: palette.text, fontSize: heading ? 22 : 17, fontWeight: heading ? '600' : '400' }}>{children}</Text>;
}
export function Screen({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: palette.background }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: 20, paddingBottom: 36, gap: 20 }}>{children}</ScrollView>
  </KeyboardAvoidingView>;
}
export function Card({ children }: { children: ReactNode }) {
  const palette = usePalette();
  return <View style={{ backgroundColor: palette.surface, borderRadius: 16, borderCurve: 'continuous', padding: 18, gap: 12 }}>{children}</View>;
}
export function Action({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  const palette = usePalette();
  return <Host matchContents={{ vertical: true }} seedColor={palette.accent} style={{ minHeight: 44, width: '100%' }}>
    <NativeButton label={label} onPress={onPress} disabled={disabled} variant={secondary ? 'outlined' : 'filled'} style={{ paddingVertical: 12 }} />
  </Host>;
}
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <Host matchContents={{ vertical: true }} style={{ minHeight: 44, width: '100%' }}><NativeSwitch label={label} value={value} onValueChange={onChange} disabled={disabled} /></Host>;
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const palette = usePalette();
  return <View style={{ gap: 8 }}><Body>{label}</Body><TextInput accessibilityLabel={label} placeholderTextColor={palette.secondary} autoCorrect={false} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} {...props} style={[{ color: palette.text, borderColor: palette.line, borderWidth: 1, backgroundColor: palette.surface, borderRadius: 10, minHeight: 48, padding: 12, fontSize: 17 }, props.style]} />
    {(props.keyboardType === 'number-pad' || props.keyboardType === 'decimal-pad' || props.keyboardType === 'phone-pad') && <Pressable accessibilityRole="button" accessibilityLabel={`Done editing ${label}`} onPress={Keyboard.dismiss} style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-end' }}><Text style={{ color: palette.accent, fontSize: 17 }}>Done</Text></Pressable>}
  </View>;
}
export function Destination({ title, detail, href }: { title: string; detail?: string; href: Href }) {
  const palette = usePalette();
  return <Link href={href} asChild><Pressable accessibilityRole="link" accessibilityLabel={title} style={{ minHeight: 52, paddingVertical: 10, gap: 6 }}><Text style={{ color: palette.accent, fontSize: 18, fontWeight: '600' }}>{title}</Text>{detail && <Body>{detail}</Body>}</Pressable></Link>;
}
export function Notice({ message }: { message: string }) {
  return <View accessibilityLiveRegion="polite"><Body>{message}</Body></View>;
}
export function Loading() { return <View accessibilityLabel="Loading" style={{ padding: 20 }}><ActivityIndicator /><Body>Loading…</Body></View>; }
export function ResourceState({ loading, error, retry }: { loading: boolean; error?: string; retry: () => void }) {
  return <>{loading && <Loading />}{error && <Card><Notice message={error} /><Action label="Try again" onPress={retry} secondary /></Card>}</>;
}
export function Unavailable({ service }: { service: string }) {
  return <Card><Body heading>{service}</Body><Body>This service is not available in this version yet. Please contact your barangay for assistance.</Body></Card>;
}
