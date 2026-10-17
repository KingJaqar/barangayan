import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { Destination, EmptyState, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { CentersSection } from '../centers/centers-section';
import { FamilySection } from '../qr/family-section';
import { QrSection } from '../qr/qr-section';
import { AlertsSection } from './alerts-section';
import { GuidelinesSection } from './guidelines-section';
import { HotlinesSection } from './hotlines-section';
import { EMERGENCY_SECTIONS, resolveSection, SECTION_LABEL, type EmergencySection } from './sections';

/**
 * Emergency information hub (A20): Guidelines, Hotlines, Centers, Family, QR and Alerts. The
 * `section` route parameter (or Android's `tab`) selects the section and is written back, so a
 * link, a return from a pushed screen and a re-selection agree. Family needs an account; the QR
 * guide and center code are public, and scanning asks for an account inside the QR section.
 */
export function EmergencyScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const section = resolveSection(params.section, params.tab);
  const strip = <SectionStrip selected={section} onChange={(next) => router.setParams({ section: next, tab: undefined, center: undefined })} />;
  if (section === 'alerts') return <AlertsSection header={strip} />;
  return <Screen>
    {strip}
    {section === 'guidelines' && <GuidelinesSection />}
    {section === 'hotlines' && <HotlinesSection />}
    {section === 'centers' && <CentersSection />}
    {section === 'family' && <SignedInOnly><FamilySection /></SignedInOnly>}
    {section === 'qr' && <QrSection />}
  </Screen>;
}

function SectionStrip({ selected, onChange }: { selected: EmergencySection; onChange: (section: EmergencySection) => void }) {
  const colors = useColors();
  const type = useType();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist" accessibilityLabel="Emergency information sections" contentContainerStyle={{ gap: space[2] }}>
    {EMERGENCY_SECTIONS.map((section) => {
      const active = section === selected;
      return <Pressable key={section} accessibilityRole="tab" accessibilityLabel={SECTION_LABEL[section]} accessibilityState={{ selected: active }} onPress={() => { if (!active) onChange(section); }}
        style={{ minHeight: layout.controlMin, paddingHorizontal: space[4], justifyContent: 'center', borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.primary : colors.surface }}>
        <Text style={[type.subheadline, { color: active ? colors.onPrimary : colors.textPrimary, fontWeight: active ? '600' : '400' }]}>{SECTION_LABEL[section]}</Text>
      </Pressable>;
    })}
  </ScrollView>;
}

/** The household needs an account: guests get an explained sign-in path and return here afterwards. */
function SignedInOnly({ children }: { children: ReactNode }) {
  const { session } = useResident();
  const { rememberDestination } = useAuthFlow();
  const pathname = usePathname();
  useEffect(() => { if (!session) rememberDestination(pathname); }, [session, pathname, rememberDestination]);
  if (!session) {
    return <EmptyState title="Log in required" message="Log in or create an account to see your household and its QR code. Public emergency information remains available without an account.">
      <Destination title="Log in or create an account" href="/auth/choice" />
    </EmptyState>;
  }
  return children;
}
