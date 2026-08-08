/**
 * Applicant Registration — Module 10.
 *
 * Full-screen form that lets a signed-in resident register for a specific
 * medical drive.  Opened by navigating to  /health/register?driveId=<uuid>.
 *
 * Design tokens sampled from the reference screenshot:
 *   Primary green    #0F6E5B   (header, accents, submit button)
 *   Progress green   #22C55E   (stock bar fill)
 *   Light-green card #EAF4F0   (applicant-number preview card)
 *   Light-green bdr  #B2D8CC
 *   Page background  #F2F4F7   (off-white sheet)
 *   Card background  #FFFFFF
 *   Muted text       #60646C
 *
 * Layout hierarchy:
 *   ┌─────────────────────────────┐
 *   │  Green header + back arrow  │
 *   ├─────────────────────────────┤
 *   │  ScrollView                 │
 *   │   DriveInfoCard             │
 *   │   ApplicantNumberCard       │
 *   │   RegisteringForSection     │
 *   │   EligibilitySection        │
 *   │   PrivacyConsentCard        │
 *   ├─────────────────────────────┤
 *   │  SubmitButton (fixed)       │
 *   └─────────────────────────────┘
 */
import { Ionicons } from '@expo/vector-icons';
import { DRIVE_TYPE_CONFIG as SHARED_DRIVE_TYPE_CONFIG } from '@barangayan/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { type MedicalDrive } from '@/hooks/use-medical-drives';
import { supabase } from '@/lib/supabase';

// ─── Design tokens ───────────────────────────────────────────────────────────

const PRIMARY_GREEN  = Colors.light.primary; // #0F6E5B
const PROGRESS_GREEN = '#22C55E';
const PAGE_BG        = '#F2F4F7';
const CARD_BG        = '#FFFFFF';
const LIGHT_GREEN_BG = '#EAF4F0';
const LIGHT_GREEN_BD = '#B2D8CC';
const MUTED          = '#60646C';
const BORDER_COLOR   = '#E5E7EB';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pad3 = (n: number) => String(n).padStart(3, '0');

/** "HH:MM:SS" → "8:00 AM" */
function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

/** "2026-08-08" → "Aug 8" */
function fmtShortDate(iso: string): string {
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(y, mo - 1, d, 12);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** ISO birth_date → age in full years (null if no birth_date). */
function computeAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const born = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age--;
  return age;
}

/** "Juan Dela Cruz" → "JD" */
function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Preview applicant number (next-in-line, simplified display). */
function previewApplicantNumber(drive: MedicalDrive): string {
  const cfg = SHARED_DRIVE_TYPE_CONFIG[drive.type];
  const prefix = cfg?.prefix ?? 'DRV';
  const position = drive.stock_total - drive.stock_remaining + 1;
  return `#${prefix}-${pad3(position)}`;
}

// ─── Comorbidities ───────────────────────────────────────────────────────────

const COMORBIDITY_OPTIONS = [
  'Hypertension',
  'Diabetes',
  'Immunocompromised',
  'Pregnant',
  'Allergy',
  'None',
] as const;

type Comorbidity = (typeof COMORBIDITY_OPTIONS)[number];

// ─── Dose History ─────────────────────────────────────────────────────────────

const DOSE_OPTIONS = ['1st Dose', '2nd Dose', 'Booster'] as const;
type DoseOption = (typeof DOSE_OPTIONS)[number];

// ─── Subcomponents ───────────────────────────────────────────────────────────

/** White card with shadow. */
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  return <View style={[cardS.card, style]}>{children}</View>;
}

const cardS = StyleSheet.create({
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
});

// ─── CheckboxRow ─────────────────────────────────────────────────────────────

function CheckboxRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={cbS.row} hitSlop={6}>
      <View
        style={[
          cbS.box,
          checked && { backgroundColor: PRIMARY_GREEN, borderColor: PRIMARY_GREEN },
        ]}>
        {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
      </View>
      <ThemedText style={cbS.label}>{label}</ThemedText>
    </Pressable>
  );
}

const cbS = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 1,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: BORDER_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD_BG,
  },
  label: {
    fontSize: 14,
    lineHeight: 20,
  },
});

// ─── DoseHistoryTabs ─────────────────────────────────────────────────────────

function DoseHistoryTabs({
  active,
  onSelect,
}: {
  active: DoseOption;
  onSelect: (d: DoseOption) => void;
}) {
  return (
    <View style={dhS.container}>
      {DOSE_OPTIONS.map((opt) => {
        const isActive = active === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[dhS.tab, isActive && dhS.tabActive]}>
            <ThemedText
              style={[
                dhS.tabLabel,
                isActive ? dhS.tabLabelActive : { color: MUTED },
              ]}>
              {opt}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const dhS = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F0F0F3',
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: CARD_BG,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  tabLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  tabLabelActive: {
    fontWeight: '700',
    color: '#000',
  },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ApplicantRegistrationScreen() {
  const insets = useSafeAreaInsets();
  const { driveId } = useLocalSearchParams<{ driveId: string }>();
  const { session } = useAuth();
  const { profile } = useProfile();

  // ── Remote data ────────────────────────────────────────────────────────────
  const [drive, setDrive] = useState<MedicalDrive | null>(null);
  const [loadingDrive, setLoadingDrive] = useState(true);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [isPwd, setIsPwd] = useState(false);
  const [selectedComorbidities, setSelectedComorbidities] = useState<Set<Comorbidity>>(
    new Set(),
  );
  const [doseHistory, setDoseHistory] = useState<DoseOption>('1st Dose');
  const [ageOverride, setAgeOverride] = useState('');   // only shown when profile has no birth_date
  const [consented, setConsented] = useState(false);

  // ── Submission ─────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    applicant_number: string;
    priority_score: number;
  } | null>(null);

  // ── Success animation ──────────────────────────────────────────────────────
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (result) {
      Animated.spring(fadeAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 160,
      }).start();
    }
  }, [result, fadeAnim]);

  // ── Fetch drive ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!driveId) return;
    (async () => {
      setLoadingDrive(true);
      const { data, error } = await supabase
        .from('medical_drives')
        .select('*')
        .eq('id', driveId)
        .single();
      if (error || !data) {
        Alert.alert('Error', 'Could not load drive details.');
        router.back();
      } else {
        setDrive(data as MedicalDrive);
      }
      setLoadingDrive(false);
    })();
  }, [driveId]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const driveTypeCfg =
    drive ? (SHARED_DRIVE_TYPE_CONFIG[drive.type] ?? SHARED_DRIVE_TYPE_CONFIG.others) : null;
  const fraction = drive && drive.stock_total > 0
    ? drive.stock_remaining / drive.stock_total
    : 0;

  const profileAge = computeAge(profile?.birth_date);
  const effectiveAge: number | null = profileAge ?? (ageOverride ? parseInt(ageOverride, 10) : null);

  const initials = profile?.full_name ? getInitials(profile.full_name) : '?';

  // Map dose-history tab to prior_dose_date sentinel
  function priorDoseDate(): string | null {
    if (doseHistory === '1st Dose') return null;
    // For 2nd Dose / Booster we pass a non-null sentinel;
    // real implementations would show a date-picker.
    return '2025-01-01'; // placeholder — signals a prior dose exists
  }

  // ── Comorbidity toggle ─────────────────────────────────────────────────────
  function toggleComorbidity(c: Comorbidity) {
    setSelectedComorbidities((prev) => {
      const next = new Set(prev);
      if (c === 'None') {
        // "None" clears all others and toggles itself
        if (next.has('None')) {
          next.delete('None');
        } else {
          next.clear();
          next.add('None');
        }
      } else {
        // Selecting any real comorbidity deselects "None"
        next.delete('None');
        if (next.has(c)) {
          next.delete(c);
        } else {
          next.add(c);
        }
      }
      return next;
    });
  }

  const comorbidityList = Array.from(selectedComorbidities).filter((c) => c !== 'None');

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!session) {
      Alert.alert('Sign In Required', 'Please sign in to register.');
      return;
    }
    if (!drive) return;
    if (!consented) {
      Alert.alert('Consent Required', 'Please check the consent box before registering.');
      return;
    }
    if (effectiveAge === null || isNaN(effectiveAge) || effectiveAge < 0 || effectiveAge > 130) {
      Alert.alert('Age Required', 'Please enter a valid age to continue.');
      return;
    }

    setSubmitError(null);
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('register_for_drive', {
        p_drive_id: drive.id,
        p_age: effectiveAge,
        p_is_pwd: isPwd,
        p_comorbidities: comorbidityList,
        p_prior_dose_date: priorDoseDate(),
      });

      if (error) throw new Error(error.message);

      const res = data as {
        registration_id: string;
        applicant_number: string;
        priority_score: number;
        status: string;
      };
      setResult({
        applicant_number: res.applicant_number,
        priority_score: res.priority_score,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  /** Formats the confirmed applicant number from the server into the short display form.
   *  Server returns e.g. "VAC-20260808-0039" → we show "#VAC-039".
   */
  function fmtConfirmedNumber(raw: string): string {
    const parts = raw.split('-');
    if (parts.length < 3) return `#${raw}`;
    const prefix = parts[0];
    const seq = parts[parts.length - 1].replace(/^0+/, '') || '0';
    return `#${prefix}-${seq.padStart(3, '0')}`;
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Loading skeleton
  // ─────────────────────────────────────────────────────────────────────────

  if (loadingDrive) {
    return (
      <View style={[s.root, { backgroundColor: PAGE_BG, paddingTop: insets.top }]}>
        <ScreenHeader onBack={() => router.back()} />
        <View style={s.centerBox}>
          <ActivityIndicator size="large" color={PRIMARY_GREEN} />
        </View>
      </View>
    );
  }

  if (!drive) return null;

  // ─────────────────────────────────────────────────────────────────────────
  //  Success state
  // ─────────────────────────────────────────────────────────────────────────

  if (result) {
    return (
      <View style={[s.root, { backgroundColor: PAGE_BG, paddingTop: insets.top }]}>
        <ScreenHeader onBack={() => router.back()} />
        <Animated.ScrollView
          contentContainerStyle={[s.successBox, { paddingBottom: insets.bottom + 40 }]}
          style={{ opacity: fadeAnim }}>
          {/* ✓ circle */}
          <View style={s.successIconRing}>
            <Ionicons name="checkmark-circle" size={72} color={PRIMARY_GREEN} />
          </View>

          <ThemedText style={s.successTitle}>Registration Confirmed!</ThemedText>
          <ThemedText style={s.successSub}>
            You're all set for the {drive.title}.
          </ThemedText>

          {/* Applicant number card */}
          <View style={s.successNumCard}>
            <ThemedText style={s.successNumLabel}>Your Applicant Number</ThemedText>
            <ThemedText style={s.successNum}>
              {fmtConfirmedNumber(result.applicant_number)}
            </ThemedText>
          </View>

          {/* Priority score */}
          <View style={s.successMeta}>
            <Ionicons name="star" size={16} color={PRIMARY_GREEN} />
            <ThemedText style={s.successMetaText}>
              Priority score: <ThemedText style={{ fontWeight: '700' }}>{result.priority_score} pts</ThemedText>
            </ThemedText>
          </View>

          <ThemedText style={s.successNote}>
            Please arrive on time at {drive.location} on {fmtShortDate(drive.drive_date)} between{' '}
            {fmt12h(drive.time_start)} – {fmt12h(drive.time_end)}.
          </ThemedText>

          <Pressable
            onPress={() => router.back()}
            style={s.doneBtn}>
            <ThemedText style={s.doneBtnLabel}>Done</ThemedText>
          </Pressable>
        </Animated.ScrollView>
      </View>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Registration form
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={[s.root, { backgroundColor: PAGE_BG, paddingTop: insets.top }]}>
      {/* ── Fixed green header ──────────────────────────────────────────────── */}
      <ScreenHeader onBack={() => router.back()} />

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <ScrollView
        contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── 1. Drive info card ────────────────────────────────────────────── */}
        <Card style={s.sectionGap}>
          {/* Title + type badge */}
          <View style={s.titleRow}>
            <ThemedText style={s.driveTitle} numberOfLines={2}>
              {drive.title}
            </ThemedText>
            {driveTypeCfg && (
              <View style={[s.badge, { backgroundColor: driveTypeCfg.color + '22' }]}>
                <ThemedText style={[s.badgeText, { color: driveTypeCfg.color }]}>
                  {driveTypeCfg.label}
                </ThemedText>
              </View>
            )}
          </View>

          {/* Date · time · location */}
          <ThemedText style={s.metaText}>
            {fmtShortDate(drive.drive_date)}
            {' · '}
            {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
            {' · '}
            {drive.location}
          </ThemedText>

          {/* Stock row + progress bar */}
          <View style={s.stockRow}>
            <ThemedText style={s.stockLabel}>{drive.stock_label}</ThemedText>
            <ThemedText style={s.stockValue}>
              {drive.stock_remaining} / {drive.stock_total} {drive.stock_unit}
            </ThemedText>
          </View>
          <ProgressBar fraction={fraction} color={PROGRESS_GREEN} />
        </Card>

        {/* ── 2. Applicant number preview ───────────────────────────────────── */}
        <View style={[s.appNumCard, s.sectionGap]}>
          <ThemedText style={s.appNumLabel}>Your Applicant Number</ThemedText>
          <ThemedText style={s.appNumValue}>{previewApplicantNumber(drive)}</ThemedText>
        </View>

        {/* ── 3. Registering for ───────────────────────────────────────────── */}
        <View style={s.sectionGap}>
          <ThemedText style={s.sectionCaption}>REGISTERING FOR</ThemedText>

          {/* Profile selector (single user for now) */}
          <Card>
            <View style={s.profileSelectorRow}>
              <View style={s.avatarCircle}>
                <ThemedText style={s.avatarInitials}>{initials}</ThemedText>
              </View>
              <ThemedText style={s.profileName}>
                {profile?.full_name ?? 'My Profile'}
              </ThemedText>
              <Ionicons name="chevron-down" size={18} color={MUTED} />
            </View>
          </Card>

          {/* Profile details */}
          <Card style={{ marginTop: 8 }}>
            {/* Name */}
            <ProfileRow label="Name" value={profile?.full_name ?? '—'} />
            <View style={s.divider} />

            {/* Age */}
            {profileAge !== null ? (
              <ProfileRow label="Age" value={String(profileAge)} />
            ) : (
              /* No birth_date in profile → show inline age input */
              <View style={s.profileRow}>
                <ThemedText style={s.profileRowLabel}>Age</ThemedText>
                <TextInput
                  style={s.ageInput}
                  placeholder="Enter age"
                  placeholderTextColor={MUTED}
                  keyboardType="number-pad"
                  value={ageOverride}
                  onChangeText={setAgeOverride}
                  maxLength={3}
                  returnKeyType="done"
                />
              </View>
            )}
            <View style={s.divider} />

            {/* Address */}
            <ProfileRow label="Address" value={profile?.home_address ?? '—'} />

            {/* Edit in Profile link */}
            <Pressable
              onPress={() => router.push('/(app)/settings/profile')}
              style={s.editLink}>
              <ThemedText style={s.editLinkText}>Edit in Profile</ThemedText>
            </Pressable>
          </Card>
        </View>

        {/* ── 4. Eligibility Information ────────────────────────────────────── */}
        <View style={s.sectionGap}>
          <ThemedText style={s.eligibilityTitle}>Eligibility Information</ThemedText>

          {/* PWD toggle */}
          <Card>
            <View style={s.pwdRow}>
              <ThemedText style={s.pwdLabel}>Person with Disability (PWD)?</ThemedText>
              <Switch
                value={isPwd}
                onValueChange={setIsPwd}
                trackColor={{ false: '#E0E1E6', true: PRIMARY_GREEN + '60' }}
                thumbColor={isPwd ? PRIMARY_GREEN : '#9CA3AF'}
                ios_backgroundColor="#E0E1E6"
              />
            </View>
          </Card>

          {/* Comorbidities */}
          <Card style={{ marginTop: 8, gap: Spacing.three }}>
            <ThemedText style={s.comorbLabel}>
              Comorbidities (select all that apply)
            </ThemedText>
            {/* 2-column grid — 3 rows of 2 */}
            <View style={s.comorbGrid}>
              {COMORBIDITY_OPTIONS.map((c) => (
                <View key={c} style={s.comorbCell}>
                  <CheckboxRow
                    label={c}
                    checked={selectedComorbidities.has(c)}
                    onToggle={() => toggleComorbidity(c)}
                  />
                </View>
              ))}
            </View>

            {/* Dose History */}
            <ThemedText style={s.comorbLabel}>Dose History</ThemedText>
            <DoseHistoryTabs active={doseHistory} onSelect={setDoseHistory} />
          </Card>
        </View>

        {/* ── 5. Privacy consent ───────────────────────────────────────────── */}
        <Card style={[s.sectionGap, s.privacyCard]}>
          {/* Shield + notice text */}
          <View style={s.privacyNoticeRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={MUTED} style={{ marginTop: 1 }} />
            <ThemedText style={s.privacyNoticeText}>
              This information is used only to determine allocation priority for this drive and is handled under the Barangay's Data Privacy Policy.
            </ThemedText>
          </View>

          {/* Consent checkbox */}
          <Pressable onPress={() => setConsented((v) => !v)} style={s.consentRow} hitSlop={6}>
            <View
              style={[
                cbS.box,
                consented && { backgroundColor: PRIMARY_GREEN, borderColor: PRIMARY_GREEN },
              ]}>
              {consented && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <ThemedText style={s.consentLabel}>I understand and consent</ThemedText>
          </Pressable>
        </Card>

        {/* Inline error */}
        {submitError && (
          <View style={[s.sectionGap, s.errorBox]}>
            <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
            <ThemedText style={s.errorText}>{submitError}</ThemedText>
          </View>
        )}
      </ScrollView>

      {/* ── Fixed submit button ──────────────────────────────────────────────── */}
      <View
        style={[
          s.submitWrap,
          { paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.three },
        ]}>
        <Pressable
          onPress={handleSubmit}
          disabled={submitting || drive.stock_remaining === 0}
          style={[
            s.submitBtn,
            {
              backgroundColor:
                submitting || drive.stock_remaining === 0
                  ? PRIMARY_GREEN + '70'
                  : PRIMARY_GREEN,
            },
          ]}>
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={s.submitLabel}>
              {drive.stock_remaining === 0 ? 'No Slots Available' : 'Submit Registration'}
            </ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ─── ScreenHeader ─────────────────────────────────────────────────────────────

function ScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={12} style={s.backBtn}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </Pressable>
      <ThemedText style={s.headerTitle}>Applicant Registration</ThemedText>
      {/* Spacer keeps title perfectly centered */}
      <View style={s.headerSpacer} />
    </View>
  );
}

// ─── ProfileRow ──────────────────────────────────────────────────────────────

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.profileRow}>
      <ThemedText style={s.profileRowLabel}>{label}</ThemedText>
      <ThemedText style={s.profileRowValue} numberOfLines={2}>
        {value}
      </ThemedText>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PAGE_BG,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    backgroundColor: PRIMARY_GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two + 4,
    minHeight: 54,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
  },
  headerSpacer: {
    width: 40,
  },

  // ── Body scroll ────────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  sectionGap: {
    marginBottom: Spacing.two + 4,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Drive info card ────────────────────────────────────────────────────────
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginBottom: 6,
  },
  driveTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  badge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    marginBottom: 10,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  stockLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  stockValue: {
    fontSize: 14,
    lineHeight: 20,
    color: MUTED,
  },

  // ── Applicant number card ──────────────────────────────────────────────────
  appNumCard: {
    backgroundColor: LIGHT_GREEN_BG,
    borderWidth: 1,
    borderColor: LIGHT_GREEN_BD,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  appNumLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_GREEN,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  appNumValue: {
    fontSize: 30,
    fontWeight: '800',
    color: PRIMARY_GREEN,
    letterSpacing: 0.5,
    lineHeight: 38,
  },

  // ── Registering for ────────────────────────────────────────────────────────
  sectionCaption: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  profileSelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 18,
  },
  profileName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },

  // Profile detail rows
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  profileRowLabel: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  profileRowValue: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'right',
    flex: 1,
    marginLeft: Spacing.two,
  },
  ageInput: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    color: '#000',
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  divider: {
    height: 1,
    backgroundColor: BORDER_COLOR,
  },
  editLink: {
    alignSelf: 'flex-end',
    paddingTop: 10,
  },
  editLinkText: {
    fontSize: 14,
    color: PRIMARY_GREEN,
    fontWeight: '600',
    lineHeight: 20,
  },

  // ── Eligibility ────────────────────────────────────────────────────────────
  eligibilityTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: 10,
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pwdLabel: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
    marginRight: 8,
  },
  comorbLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  comorbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.two + 4,
  },
  comorbCell: {
    width: '50%',
  },

  // ── Privacy card ───────────────────────────────────────────────────────────
  privacyCard: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: BORDER_COLOR,
    gap: Spacing.two,
  },
  privacyNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  privacyNoticeText: {
    fontSize: 13,
    lineHeight: 19,
    color: MUTED,
    flex: 1,
  },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  consentLabel: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },

  // ── Error ──────────────────────────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: Spacing.two + 4,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
    flex: 1,
    lineHeight: 18,
  },

  // ── Submit ─────────────────────────────────────────────────────────────────
  submitWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    backgroundColor: PAGE_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER_COLOR,
  },
  submitBtn: {
    borderRadius: 30,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Success state ──────────────────────────────────────────────────────────
  successBox: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    gap: Spacing.two + 4,
  },
  successIconRing: {
    marginBottom: Spacing.two,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: PRIMARY_GREEN,
    textAlign: 'center',
    lineHeight: 28,
  },
  successSub: {
    fontSize: 15,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 22,
  },
  successNumCard: {
    backgroundColor: LIGHT_GREEN_BG,
    borderWidth: 1,
    borderColor: LIGHT_GREEN_BD,
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    width: '100%',
    marginVertical: Spacing.two,
  },
  successNumLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY_GREEN,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  successNum: {
    fontSize: 28,
    fontWeight: '800',
    color: PRIMARY_GREEN,
    letterSpacing: 0.5,
  },
  successMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successMetaText: {
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  successNote: {
    fontSize: 13,
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    backgroundColor: PRIMARY_GREEN,
    borderRadius: 30,
    height: 52,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.three,
  },
  doneBtnLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
