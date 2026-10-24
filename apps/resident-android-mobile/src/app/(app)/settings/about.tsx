import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { SegmentedControl } from '@/components/segmented-control';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ContentState, ManagedMarkdown, SettingsContentTransition } from '@/components/settings/managed-content';
import { ThemedText } from '@/components/themed-text';
import { useAboutUs } from '@/hooks/use-about-us';
import { useProfile } from '@/hooks/use-profile';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

type Purpose = 'mission' | 'vision';
const ease = Easing.bezier(0.23, 1, 0.32, 1);

function PurposePanel({ mission, vision }: { mission: string | null; vision: string | null }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const choices: { key: Purpose; label: string; text: string }[] = [];
  if (mission) choices.push({ key: 'mission', label: 'Mission', text: mission });
  if (vision) choices.push({ key: 'vision', label: 'Vision', text: vision });
  const [selected, setSelected] = useState<Purpose>(mission ? 'mission' : 'vision');
  const active = choices.find(choice => choice.key === selected) ?? choices[0];
  const activeKey = active?.key;
  const [displayed, setDisplayed] = useState(activeKey);
  const displayedRef = useRef(activeKey);
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    const settle = () => { opacity.setValue(1); translateY.setValue(0); };
    if (reducedMotion || activeKey === displayedRef.current) {
      displayedRef.current = activeKey;
      setDisplayed(activeKey);
      settle();
      return;
    }
    const exit = Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 100, easing: ease, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: -4, duration: 100, easing: ease, useNativeDriver: true }),
    ]);
    let entrance: Animated.CompositeAnimation | undefined;
    exit.start(({ finished }) => {
      if (!finished || cancelled) return;
      displayedRef.current = activeKey;
      setDisplayed(activeKey);
      translateY.setValue(4);
      entrance = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 160, easing: ease, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 160, easing: ease, useNativeDriver: true }),
      ]);
      entrance.start();
    });
    return () => { cancelled = true; exit.stop(); entrance?.stop(); };
  }, [activeKey, reducedMotion, opacity, translateY]);
  const current = choices.find(choice => choice.key === displayed) ?? active;
  if (!active || !current) return null;
  return <View style={[styles.purpose, { backgroundColor: resident.accentSoft }]}>
    <SegmentedControl presentation="resident" appearance="purpose" variant="outline" segments={choices} activeKey={active.key} onChange={setSelected} />
    <Animated.View style={[styles.purposeBody, { opacity, transform: [{ translateY }] }]} accessibilityLiveRegion="polite">
      <ManagedMarkdown compact>{current.text}</ManagedMarkdown>
    </Animated.View>
  </View>;
}

function History({ text }: { text: string }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [open, setOpen] = useState(false);
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) { rotation.setValue(open ? 1 : 0); return; }
    const animation = Animated.timing(rotation, { toValue: open ? 1 : 0, duration: 200, easing: ease, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [open, reducedMotion, rotation]);
  return <View style={styles.section}>
    <View style={styles.historyHeading}>
      <ThemedText accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>History</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Show less history' : 'Read full story'} accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)} style={({ pressed }) => [styles.historyButton, pressed && { backgroundColor: resident.pressed }]}>
        <ThemedText style={[styles.historyAction, { color: resident.accentText }]}>{open ? 'Show less' : 'Read full story'}</ThemedText>
        <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
          <Ionicons name="chevron-down" size={16} color={resident.accentText} accessible={false} />
        </Animated.View>
      </Pressable>
    </View>
    <SettingsContentTransition contentKey={open ? 'full' : 'preview'}>
      {open ? <ManagedMarkdown compact>{text}</ManagedMarkdown> : <ThemedText numberOfLines={3} style={[styles.historyPreview, { color: resident.muted }]}>{text}</ThemedText>}
    </SettingsContentTransition>
  </View>;
}

export default function AboutScreen() {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile } = useProfile();
  const { about, developers, isLoading, error, refetch } = useAboutUs(profile?.barangay_id ?? null);
  const version = Constants.expoConfig?.version;
  const contacts = about ? [
    { icon: 'mail-outline' as const, value: about.contact_email },
    { icon: 'call-outline' as const, value: about.contact_phone },
    { icon: 'location-outline' as const, value: about.address },
  ].filter(contact => contact.value) : [];
  return <SafeAreaView edges={['left', 'right']} style={{ flex: 1, backgroundColor: resident.card }}>
    <ServiceScreenHeader title="About Us" />
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
      {isLoading && !about ? <ContentState loading title="Loading About Us…" /> : <>
        {isLoading ? <ContentState loading title="Refreshing About Us…" /> : null}
        {error ? <ContentState title="Unable to load all About Us content" message="Check your connection and try again." onRetry={refetch} /> : null}
        {!about ? (!error ? <ContentState title="About Us" message="About Us content is not yet available." /> : null) : <>
          {(about.logo_url || about.title || version) ? <View style={styles.identity}>
            {about.logo_url ? <Image source={{ uri: about.logo_url }} style={styles.logo} contentFit="cover" accessibilityLabel={about.title || 'Barangay logo'} /> : null}
            <ThemedText accessibilityRole="header" style={[styles.identityTitle, { color: resident.text }]}>{about.title}</ThemedText>
            {version ? <View style={[styles.version, { backgroundColor: resident.surface }]}><ThemedText style={[styles.versionText, { color: resident.muted }]}>v{version}</ThemedText></View> : null}
          </View> : null}
          <PurposePanel key={`purpose:${about.id}`} mission={about.mission} vision={about.vision} />
          {about.history ? <History key={`history:${about.id}`} text={about.history} /> : null}
          {contacts.length ? <View style={styles.section}>
            <ThemedText accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>Contact</ThemedText>
            <View style={[styles.panel, { borderColor: resident.border }]}>{contacts.map((contact, index) => <View key={contact.icon}
              style={[styles.contact, { borderTopColor: resident.border, borderTopWidth: index ? 1 : 0 }]}>
              <Ionicons name={contact.icon} size={18} color={resident.accentText} accessible={false} />
              <ThemedText selectable style={[styles.contactText, { color: resident.text }]}>{contact.value}</ThemedText>
            </View>)}</View>
          </View> : null}
          {developers.length ? <View style={styles.section}>
            <ThemedText accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>Development Team</ThemedText>
            <View style={[styles.panel, styles.team, { borderColor: resident.border }]}>{developers.map((developer, index) => <View key={developer.id}
              style={[styles.developer, { borderColor: resident.border, borderRightWidth: index % 2 === 0 ? 1 : 0, borderTopWidth: index >= 2 ? 1 : 0 }]}>
              {developer.photo_url ? <Image source={{ uri: developer.photo_url }} style={styles.avatar} contentFit="cover" accessibilityLabel={developer.name} /> :
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: resident.surface }]}><Ionicons name="person-outline" size={20} color={resident.muted} accessible={false} /></View>}
              <ThemedText style={[styles.developerName, { color: resident.text }]}>{developer.name}</ThemedText>
              {developer.role ? <ThemedText style={[styles.developerRole, { color: resident.accentText }]}>{developer.role}</ThemedText> : null}
              {developer.bio ? <ThemedText style={[styles.developerBio, { color: resident.muted }]}>{developer.bio}</ThemedText> : null}
            </View>)}</View>
          </View> : null}
        </>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  content: { paddingTop: 12, paddingHorizontal: 16, gap: 12 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: { width: 44, height: 44, borderRadius: 22 },
  identityTitle: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 26, fontWeight: '800' },
  version: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  versionText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  purpose: { borderRadius: 16, padding: 6 },
  purposeBody: { paddingHorizontal: 8, paddingTop: 4, paddingBottom: 2 },
  section: { gap: 6 }, sectionTitle: { fontSize: 15, lineHeight: 22, fontWeight: '700', paddingHorizontal: 4 },
  historyHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' },
  historyButton: { flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 8, gap: 4, borderRadius: 20 },
  historyAction: { fontSize: 13.5, lineHeight: 20, fontWeight: '700' },
  historyPreview: { fontSize: 13.5, lineHeight: 20 },
  panel: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingVertical: 8 },
  contactText: { flex: 1, minWidth: 0, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  team: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  developer: { width: '50%', padding: 10, gap: 3 },
  avatar: { width: 32, height: 32, borderRadius: 16, marginBottom: 2 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  developerName: { fontSize: 13.5, lineHeight: 18, fontWeight: '700' },
  developerRole: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  developerBio: { fontSize: 12, lineHeight: 18 },
});
