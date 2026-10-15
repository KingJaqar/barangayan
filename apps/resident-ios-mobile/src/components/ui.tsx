import { Host, Icon, Switch as NativeSwitch, type IconName } from '@expo/ui';
import { Link, useNavigation, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { layout, radius, space, typeScale, useColors, type Colors, type TypeRole } from '../lib/theme';

type Tone = 'primary' | 'secondary' | 'danger';
const toneColor = (colors: Colors, tone: Tone) => tone === 'secondary' ? colors.textSecondary : tone === 'danger' ? colors.danger : colors.textPrimary;

export function Body({ children, heading = false, role = heading ? 'title2' : 'body', tone = 'primary' }: { children: ReactNode; heading?: boolean; role?: TypeRole; tone?: Tone }) {
  const colors = useColors();
  return <Text selectable accessibilityRole={heading ? 'header' : undefined} style={[typeScale[role], { color: toneColor(colors, tone) }]}>{children}</Text>;
}
export function Screen({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: colors.canvas }}>
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ padding: layout.margin, paddingBottom: space[7], gap: space[5] }}>{children}</ScrollView>
  </KeyboardAvoidingView>;
}
export function Card({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <View style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, borderCurve: 'continuous', padding: space[4], gap: space[3] }}>{children}</View>;
}
/** Primary, secondary or destructive button. Callers keep it disabled while their request is active. */
export function Action({ label, onPress, disabled = false, secondary = false, destructive = false, hint }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean; destructive?: boolean; hint?: string }) {
  const colors = useColors();
  const fill = destructive ? colors.danger : colors.primary;
  const foreground = secondary ? fill : destructive ? colors.surface : colors.onPrimary;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: layout.buttonMinHeight, borderRadius: radius.md, borderCurve: 'continuous', borderWidth: secondary ? 1 : 0, borderColor: fill, backgroundColor: secondary ? 'transparent' : fill, opacity: disabled ? 0.5 : pressed ? 0.7 : 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space[4], paddingVertical: space[3] })}>
    <Text style={[typeScale.headline, { color: foreground, textAlign: 'center' }]}>{label}</Text>
  </Pressable>;
}
export function Toggle({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  const colors = useColors();
  return <Host matchContents={{ vertical: true }} seedColor={colors.primary} style={{ minHeight: layout.controlMin, width: '100%' }}><NativeSwitch label={label} value={value} onValueChange={onChange} disabled={disabled} /></Host>;
}
function SymbolIcon({ name, color, size = 17 }: { name: IconName; color: string; size?: number }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Host matchContents><Icon name={name} size={size} color={color} /></Host></View>;
}
function FieldLabel({ label, required }: { label: string; required: boolean }) {
  const colors = useColors();
  // The control itself carries the label (and "required") for VoiceOver, so the visual label is not read twice.
  return <Text accessibilityElementsHidden importantForAccessibility="no" style={[typeScale.subheadline, { color: colors.textPrimary, fontWeight: '600' }]}>{label}{required && <Text style={{ color: colors.danger }}> *</Text>}</Text>;
}
function FieldError({ message }: { message?: string }) {
  const colors = useColors();
  useEffect(() => { if (message) AccessibilityInfo.announceForAccessibility(message); }, [message]);
  if (!message) return null;
  return <View style={{ flexDirection: 'row', gap: space[2], alignItems: 'center' }}><SymbolIcon name="exclamationmark.circle" color={colors.danger} size={15} /><Text style={[typeScale.footnote, { color: colors.danger, flex: 1 }]}>{message}</Text></View>;
}
/** Labeled input with required marker, adjacent announced error, password visibility and a numeric-pad Done action. */
export function Field({ label, required = false, error, ...props }: TextInputProps & { label: string; required?: boolean; error?: string }) {
  const colors = useColors();
  const [revealed, setRevealed] = useState(false);
  const secret = props.secureTextEntry === true;
  const numeric = props.keyboardType === 'number-pad' || props.keyboardType === 'decimal-pad' || props.keyboardType === 'phone-pad';
  return <View style={{ gap: space[2] }}>
    <FieldLabel label={label} required={required} />
    <View style={{ flexDirection: 'row', alignItems: 'center', borderColor: error ? colors.danger : colors.border, borderWidth: 1, backgroundColor: colors.surface, borderRadius: radius.sm, borderCurve: 'continuous' }}>
      <TextInput accessibilityLabel={required ? `${label}, required` : label} accessibilityHint={error} placeholderTextColor={colors.textTertiary} autoCorrect={false} returnKeyType="done" onSubmitEditing={Keyboard.dismiss} {...props} secureTextEntry={secret && !revealed}
        style={[typeScale.body, { flex: 1, color: colors.textPrimary, minHeight: props.multiline ? 120 : layout.buttonMinHeight, padding: space[3], textAlignVertical: props.multiline ? 'top' : 'center' }, props.style]} />
      {secret && <Pressable accessibilityRole="button" accessibilityLabel={revealed ? `Hide ${label}` : `Show ${label}`} onPress={() => setRevealed((value) => !value)} style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, paddingHorizontal: space[3], justifyContent: 'center' }}><Text style={[typeScale.callout, { color: colors.primary }]}>{revealed ? 'Hide' : 'Show'}</Text></Pressable>}
    </View>
    <FieldError message={error} />
    {numeric && <Pressable accessibilityRole="button" accessibilityLabel={`Done editing ${label}`} onPress={Keyboard.dismiss} style={{ minHeight: layout.controlMin, justifyContent: 'center', alignSelf: 'flex-end' }}><Text style={[typeScale.body, { color: colors.primary }]}>Done</Text></Pressable>}
  </View>;
}
/** Native page sheet with a labeled close action. Swipe dismissal is allowed only when closing loses nothing. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const colors = useColors();
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: colors.surfaceRaised }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: layout.margin, paddingTop: space[4], gap: space[3] }}>
        <Text accessibilityRole="header" style={[typeScale.headline, { color: colors.textPrimary, flex: 1 }]}>{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${title}`} onPress={onClose} style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, justifyContent: 'center', alignItems: 'flex-end' }}><Text style={[typeScale.body, { color: colors.primary }]}>Close</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: layout.margin, gap: space[2] }}>{children}</ScrollView>
    </View>
  </Modal>;
}
/** Label + chosen value + chevron; opens a sheet of every option with a checkmark on the selected one. */
export function Selector<T extends string>({ label, options, selected, onChange, required = false, error, disabled = false }: { label: string; options: readonly { value: T; label: string }[]; selected: T | ''; onChange: (value: T) => void; required?: boolean; error?: string; disabled?: boolean }) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const chosen = options.find((option) => option.value === selected)?.label;
  return <View style={{ gap: space[2] }}>
    <FieldLabel label={label} required={required} />
    <Pressable accessibilityRole="button" accessibilityLabel={required ? `${label}, required` : label} accessibilityValue={{ text: chosen ?? 'Not selected' }} accessibilityHint="Opens the list of choices" accessibilityState={{ disabled }} disabled={disabled} onPress={() => setOpen(true)}
      style={({ pressed }) => ({ minHeight: layout.buttonMinHeight, flexDirection: 'row', alignItems: 'center', gap: space[2], paddingHorizontal: space[3], borderColor: error ? colors.danger : colors.border, borderWidth: 1, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.surface, opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
      <Text style={[typeScale.body, { flex: 1, color: chosen ? colors.textPrimary : colors.textTertiary }]}>{chosen ?? 'Select'}</Text>
      <SymbolIcon name="chevron.up.chevron.down" color={colors.textSecondary} size={14} />
    </Pressable>
    <FieldError message={error} />
    <Sheet visible={open} title={label} onClose={() => setOpen(false)}>
      {options.map((option) => {
        const active = option.value === selected;
        return <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={option.label} accessibilityState={{ selected: active }} onPress={() => { onChange(option.value); setOpen(false); }}
          style={({ pressed }) => ({ minHeight: layout.listRowMin, flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[3], borderRadius: radius.sm, backgroundColor: active ? colors.surfaceSelected : pressed ? colors.canvas : 'transparent' })}>
          <Text style={[typeScale.body, { flex: 1, color: colors.textPrimary }]}>{option.label}</Text>
          {active && <SymbolIcon name="checkmark" color={colors.primary} />}
        </Pressable>;
      })}
    </Sheet>
  </View>;
}
export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
/** Icon + label so status never depends on color alone. */
export function StatusBadge({ label, icon, tone }: { label: string; icon: IconName; tone: StatusTone }) {
  const colors = useColors();
  const color = tone === 'neutral' ? colors.textSecondary : colors[tone];
  return <View accessible accessibilityLabel={`Status: ${label}`} style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[1], borderColor: color, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: space[2], paddingVertical: space[1] }}>
    <SymbolIcon name={icon} color={color} size={13} /><Text style={[typeScale.caption, { color }]}>{label}</Text>
  </View>;
}
export function Destination({ title, detail, href }: { title: string; detail?: string; href: Href }) {
  const colors = useColors();
  return <Link href={href} asChild><Pressable accessibilityRole="link" accessibilityLabel={detail ? `${title}, ${detail}` : title}
    style={({ pressed }) => ({ minHeight: layout.listRowMin, paddingVertical: space[2], flexDirection: 'row', alignItems: 'center', gap: space[3], opacity: pressed ? 0.6 : 1 })}>
    <View style={{ flex: 1, gap: space[1] }}><Text style={[typeScale.headline, { color: colors.primary }]}>{title}</Text>{detail && <Text style={[typeScale.subheadline, { color: colors.textSecondary }]}>{detail}</Text>}</View>
    <SymbolIcon name="chevron.right" color={colors.textTertiary} size={14} />
  </Pressable></Link>;
}
/** Persistent message beside the affected action, announced to VoiceOver when it changes. */
export function Notice({ message, tone = 'primary' }: { message: string; tone?: Tone }) {
  useEffect(() => { if (message) AccessibilityInfo.announceForAccessibility(message); }, [message]);
  return <View accessibilityLiveRegion="polite"><Body tone={tone}>{message}</Body></View>;
}
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <View accessible accessibilityLabel={label} style={{ padding: space[5], gap: space[2], alignItems: 'center' }}><ActivityIndicator /><Body tone="secondary">{label}</Body></View>;
}
/** Row geometry placeholder; appears only after 250 ms and is hidden from VoiceOver. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const colors = useColors();
  const [shown, setShown] = useState(false);
  useEffect(() => { const timer = setTimeout(() => setShown(true), 250); return () => clearTimeout(timer); }, []);
  if (!shown) return null;
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ gap: space[3] }}>
    {Array.from({ length: rows }, (_, index) => <View key={index} style={{ height: layout.listRowMin + space[4], borderRadius: radius.md, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, padding: space[4], gap: space[2] }}>
      <View style={{ height: 14, width: '60%', borderRadius: radius.sm, backgroundColor: colors.border }} /><View style={{ height: 12, width: '40%', borderRadius: radius.sm, backgroundColor: colors.border }} />
    </View>)}
  </View>;
}
export function EmptyState({ title, message, children }: { title: string; message: string; children?: ReactNode }) {
  return <Card><Body heading role="headline">{title}</Body><Body tone="secondary">{message}</Body>{children}</Card>;
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <Card><Body heading role="headline">Something went wrong</Body><Notice message={message} /><Action label="Try again" onPress={retry} secondary /></Card>;
}
export function ResourceState({ loading, error, retry, skeleton = false }: { loading: boolean; error?: string; retry: () => void; skeleton?: boolean }) {
  return <>{loading && (skeleton ? <Skeleton /> : <Loading />)}{error && <ErrorState message={error} retry={retry} />}</>;
}
export function Unavailable({ service }: { service: string }) {
  return <EmptyState title={service} message="This service is not available in this version yet. Please contact your barangay for assistance." />;
}
/** Native alert whose final action names the consequence. Resolves true only when the resident confirms. */
export function confirmDestructive({ title, message, confirmLabel }: { title: string; message: string; confirmLabel: string }): Promise<boolean> {
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
  ], { cancelable: true, onDismiss: () => resolve(false) }));
}
/** Protects unsaved input from back, swipe-back and stack replacement until the resident chooses to discard it. */
export function useDiscardGuard(dirty: boolean) {
  const navigation = useNavigation();
  usePreventRemove(dirty, ({ data }) => {
    void confirmDestructive({ title: 'Discard changes?', message: 'Your changes have not been saved.', confirmLabel: 'Discard changes' }).then((discard) => {
      if (discard) navigation.dispatch(data.action);
    });
  });
}
