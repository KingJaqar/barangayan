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
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
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
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { type MedicalDrive } from '@/hooks/use-medical-drives';
import { supabase } from '@/lib/supabase';

// ─── Design tokens ───────────────────────────────────────────────────────────

// Live-accent note: the module-level `s`/`ps`/`cbS` StyleSheets are built once at import
// time and can't read the per-account accent color (Settings > App Theme). Every component
// below declares `const PRIMARY_GREEN = theme.primary;` right after its useTheme() call,
// and moves any style that needs the live color out of the static StyleSheet into an
// inline override at the usage site.
const PROGRESS_GREEN = '#22C55E';

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

/** Themed card with shadow. */
function Card({ children, style }: { children: React.ReactNode; style?: object }) {
  const theme = useTheme();
  return <View style={[cardS.card, { backgroundColor: theme.backgroundElement }, style]}>{children}</View>;
}

const cardS = StyleSheet.create({
  card: {
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
  const theme = useTheme();
  // Shadows the module-level fallback — see the live-accent note at the top of this file.
  const PRIMARY_GREEN = theme.primary;

  return (
    <Pressable onPress={onToggle} style={cbS.row} hitSlop={6}>
      <View
        style={[
          cbS.box,
          { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
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
    alignItems: 'center',
    justifyContent: 'center',
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
  const theme = useTheme();
  return (
    <View style={[dhS.container, { backgroundColor: theme.backgroundSelected }]}>
      {DOSE_OPTIONS.map((opt) => {
        const isActive = active === opt;
        return (
          <Pressable
            key={opt}
            onPress={() => onSelect(opt)}
            style={[dhS.tab, isActive && [dhS.tabActive, { backgroundColor: theme.backgroundElement }]]}>
            <ThemedText
              style={[
                dhS.tabLabel,
                isActive ? { fontWeight: '700', color: theme.text } : { color: theme.textSecondary },
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
});

// ─── Household member type (mirrors the shape stored in profiles.household_members) ──

interface HouseholdMember {
  id: string;
  name: string;
  relation: string;
  role: string;
}

// Either the resident themselves or one of their household members.
type ApplicantSelection =
  | { type: 'self' }
  | { type: 'member'; member: HouseholdMember };

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ApplicantRegistrationScreen() {
  const theme = useTheme();
  // Shadows the module-level fallback — see the live-accent note at the top of this file.
  const PRIMARY_GREEN = theme.primary;
  const insets = useSafeAreaInsets();
  const { driveId } = useLocalSearchParams<{ driveId: string }>();
  const { session } = useAuth();
  const { profile } = useProfile();

  // ── Remote data ────────────────────────────────────────────────────────────
  const [drive, setDrive] = useState<MedicalDrive | null>(null);
  const [loadingDrive, setLoadingDrive] = useState(true);

  // ── Applicant selector ─────────────────────────────────────────────────────
  const [selection, setSelection] = useState<ApplicantSelection>({ type: 'self' });
  const [pickerVisible, setPickerVisible] = useState(false);

  // Household members parsed from the profile JSONB column.
  const householdMembers = useMemo<HouseholdMember[]>(() => {
    const raw = (profile as any)?.household_members;
    return Array.isArray(raw) ? (raw as HouseholdMember[]) : [];
  }, [profile]);

  // Derived display values for the currently selected applicant.
  const selectedName =
    selection.type === 'self'
      ? (profile?.full_name ?? 'My Profile')
      : selection.member.name;

  const selectedAvatarUrl: string | null =
    selection.type === 'self' ? ((profile as any)?.avatar_url ?? null) : null;

  const selectedInitials = getInitials(selectedName);

  // ── Form state ─────────────────────────────────────────────────────────────
  const [isPwd, setIsPwd] = useState(false);
  const [selectedComorbidities, setSelectedComorbidities] = useState<Set<Comorbidity>>(
    new Set(),
  );
  const [doseHistory, setDoseHistory] = useState<DoseOption>('1st Dose');
  // Age override: always needed for household members (they have no birth_date);
  // also used for the resident when their profile has no birth_date.
  const [ageOverride, setAgeOverride] = useState('');
  const [consented, setConsented] = useState(false);

  // Reset age override whenever the selection changes so stale numbers don't carry over.
  useEffect(() => { setAgeOverride(''); }, [selection]);

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

  // Age logic:
  //   • Resident selected + has birth_date  → computed automatically
  //   • Resident selected + no birth_date   → ageOverride input shown
  //   • Household member selected           → ageOverride input always shown
  const profileAge = selection.type === 'self' ? computeAge(profile?.birth_date) : null;
  const effectiveAge: number | null =
    profileAge ?? (ageOverride ? parseInt(ageOverride, 10) : null);

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
        p_prior_dose_date: priorDoseDate() ?? undefined,
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
      <View style={[s.root, { backgroundColor: theme.background }]}>
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
      <View style={[s.root, { backgroundColor: theme.background }]}>
        <ScreenHeader onBack={() => router.back()} />
        <Animated.ScrollView
          contentContainerStyle={[s.successBox, { paddingBottom: insets.bottom + 40 }]}
          style={{ opacity: fadeAnim }}>
          {/* ✓ circle */}
          <View style={s.successIconRing}>
            <Ionicons name="checkmark-circle" size={72} color={PRIMARY_GREEN} />
          </View>

          <ThemedText style={[s.successTitle, { color: PRIMARY_GREEN }]}>Registration Confirmed!</ThemedText>
          <ThemedText themeColor="textSecondary" style={s.successSub}>
            You're all set for the {drive.title}.
          </ThemedText>

          {/* Applicant number card */}
          <View style={[s.successNumCard, { backgroundColor: `${PRIMARY_GREEN}14`, borderColor: `${PRIMARY_GREEN}40` }]}>
            <ThemedText style={[s.successNumLabel, { color: PRIMARY_GREEN }]}>Your Applicant Number</ThemedText>
            <ThemedText style={[s.successNum, { color: PRIMARY_GREEN }]}>
              {fmtConfirmedNumber(result.applicant_number)}
            </ThemedText>
          </View>

          {/* Priority score */}
          <View style={s.successMeta}>
            <Ionicons name="star" size={16} color={PRIMARY_GREEN} />
            <ThemedText themeColor="textSecondary" style={s.successMetaText}>
              Priority score: <ThemedText style={{ fontWeight: '700' }}>{result.priority_score} pts</ThemedText>
            </ThemedText>
          </View>

          <ThemedText themeColor="textSecondary" style={s.successNote}>
            Please arrive on time at {drive.location} on {fmtShortDate(drive.drive_date)} between{' '}
            {fmt12h(drive.time_start)} – {fmt12h(drive.time_end)}.
          </ThemedText>

          <Pressable
            onPress={() => router.back()}
            style={[s.doneBtn, { backgroundColor: PRIMARY_GREEN }]}>
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
    <View style={[s.root, { backgroundColor: theme.background }]}>
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
          <ThemedText themeColor="textSecondary" style={s.metaText}>
            {fmtShortDate(drive.drive_date)}
            {' · '}
            {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
            {' · '}
            {drive.location}
          </ThemedText>

          {/* Stock row + progress bar */}
          <View style={s.stockRow}>
            <ThemedText style={s.stockLabel}>{drive.stock_label}</ThemedText>
            <ThemedText themeColor="textSecondary" style={s.stockValue}>
              {drive.stock_remaining} / {drive.stock_total} {drive.stock_unit}
            </ThemedText>
          </View>
          <ProgressBar fraction={fraction} color={PROGRESS_GREEN} />
        </Card>

        {/* ── 2. Applicant number preview ───────────────────────────────────── */}
        <View style={[s.appNumCard, s.sectionGap, { backgroundColor: `${PRIMARY_GREEN}14`, borderColor: `${PRIMARY_GREEN}40` }]}>
          <ThemedText style={[s.appNumLabel, { color: PRIMARY_GREEN }]}>Your Applicant Number</ThemedText>
          <ThemedText style={[s.appNumValue, { color: PRIMARY_GREEN }]}>{previewApplicantNumber(drive)}</ThemedText>
        </View>

        {/* ── 3. Registering for ───────────────────────────────────────────── */}
        <View style={s.sectionGap}>
          <ThemedText themeColor="textSecondary" style={s.sectionCaption}>REGISTERING FOR</ThemedText>

          {/* Profile selector — tap to open household picker */}
          <Pressable onPress={() => setPickerVisible(true)}>
            <Card>
              <View style={s.profileSelectorRow}>
                <View style={s.avatarCircle}>
                  {selectedAvatarUrl ? (
                    <Image
                      source={{ uri: selectedAvatarUrl }}
                      style={s.avatarImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : (
                    <ThemedText style={s.avatarInitials}>{selectedInitials}</ThemedText>
                  )}
                </View>
                <ThemedText style={s.profileName}>{selectedName}</ThemedText>
                {selection.type === 'member' && (
                  <ThemedText style={[s.selectionTag, { color: PRIMARY_GREEN, backgroundColor: PRIMARY_GREEN + '1A' }]}>{selection.member.relation}</ThemedText>
                )}
                <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
              </View>
            </Card>
          </Pressable>

          {/* Profile details for the selected applicant */}
          <Card style={{ marginTop: 8 }}>
            {/* Name */}
            <ProfileRow label="Name" value={selectedName} />
            <View style={[s.divider, { backgroundColor: theme.backgroundSelected }]} />

            {selection.type === 'member' && (
              <>
                <ProfileRow label="Relation" value={selection.member.relation} />
                <View style={[s.divider, { backgroundColor: theme.backgroundSelected }]} />
                <ProfileRow label="Role" value={selection.member.role} />
                <View style={[s.divider, { backgroundColor: theme.backgroundSelected }]} />
              </>
            )}

            {/* Age — computed for resident with birth_date; manual input for members or
                 resident without birth_date */}
            {profileAge !== null ? (
              <ProfileRow label="Age" value={String(profileAge)} />
            ) : (
              <View style={s.profileRow}>
                <ThemedText themeColor="textSecondary" style={s.profileRowLabel}>Age</ThemedText>
                <TextInput
                  style={[s.ageInput, { color: theme.text }]}
                  placeholder="Enter age"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={ageOverride}
                  onChangeText={setAgeOverride}
                  maxLength={3}
                  returnKeyType="done"
                />
              </View>
            )}

            {/* Address — only shown for the resident (members share the household address) */}
            {selection.type === 'self' && (
              <>
                <View style={[s.divider, { backgroundColor: theme.backgroundSelected }]} />
                <ProfileRow label="Address" value={profile?.home_address ?? '—'} />
              </>
            )}

            {/* Edit in Profile link */}
            <Pressable
              onPress={() => router.push('/(app)/settings/profile')}
              style={s.editLink}>
              <ThemedText style={[s.editLinkText, { color: PRIMARY_GREEN }]}>Edit in Profile</ThemedText>
            </Pressable>
          </Card>
        </View>

        {/* ── Applicant picker sheet ─────────────────────────────────────────── */}
        <ApplicantPickerSheet
          visible={pickerVisible}
          residentName={profile?.full_name ?? 'My Profile'}
          residentAvatarUrl={(profile as any)?.avatar_url ?? null}
          householdMembers={householdMembers}
          selection={selection}
          onSelect={(sel) => { setSelection(sel); setPickerVisible(false); }}
          onClose={() => setPickerVisible(false)}
        />

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
                trackColor={{ false: theme.backgroundSelected, true: PRIMARY_GREEN + '60' }}
                thumbColor={isPwd ? PRIMARY_GREEN : theme.textSecondary}
                ios_backgroundColor={theme.backgroundSelected}
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
        <Card style={[s.sectionGap, s.privacyCard, { borderColor: theme.backgroundSelected }]}>
          {/* Shield + notice text */}
          <View style={s.privacyNoticeRow}>
            <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} style={{ marginTop: 1 }} />
            <ThemedText themeColor="textSecondary" style={s.privacyNoticeText}>
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
          <View style={[s.sectionGap, s.errorBox, { backgroundColor: `${theme.accentRed}1A`, borderColor: `${theme.accentRed}40` }]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.accentRed} />
            <ThemedText style={[s.errorText, { color: theme.accentRed }]}>{submitError}</ThemedText>
          </View>
        )}
      </ScrollView>

      {/* ── Fixed submit button ──────────────────────────────────────────────── */}
      <View
        style={[
          s.submitWrap,
          { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected },
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

// ─── ApplicantPickerSheet ─────────────────────────────────────────────────────
// Bottom-sheet modal that lists the resident themselves + their household members
// so the user can choose who they are registering for.
//
// Animation design:
//   Open  — spring (damping 22, stiffness 220) for the sheet + 180 ms fade-in for
//            the backdrop.  Gives a natural, elastic snap-into-place feel.
//   Close — 260 ms ease-in-cubic slide-down + 200 ms backdrop fade, then the Modal
//            is unmounted so there are no phantom touch targets left behind.

function ApplicantPickerSheet({
  visible,
  residentName,
  residentAvatarUrl,
  householdMembers,
  selection,
  onSelect,
  onClose,
}: {
  visible: boolean;
  residentName: string;
  residentAvatarUrl: string | null;
  householdMembers: HouseholdMember[];
  selection: ApplicantSelection;
  onSelect: (sel: ApplicantSelection) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the live-accent note at the top of this file.
  const PRIMARY_GREEN = theme.primary;
  const isResidentSelected = selection.type === 'self';

  // `modalVisible` lags behind the `visible` prop so the exit animation can
  // finish before the Modal actually unmounts.
  const [modalVisible, setModalVisible] = useState(false);

  // Sheet slides from off-screen (large positive Y) up to 0.
  // 700 is safely below any device viewport.
  const translateY = useRef(new Animated.Value(700)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Reset position before mounting so we always slide in from below.
      translateY.setValue(700);
      backdropOpacity.setValue(0);
      setModalVisible(true);

      Animated.parallel([
        // Spring gives the sheet a natural, slightly elastic feel on the way up.
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 22,
          stiffness: 220,
          mass: 0.9,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out, then unmount the Modal.
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 700,
          duration: 260,
          easing: Easing.bezier(0.4, 0, 1, 1), // ease-in cubic — feels intentional, not sluggish
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setModalVisible(false);
      });
    }
  }, [visible, translateY, backdropOpacity]);

  // Trigger the exit animation; the useEffect above handles the actual close.
  function handleClose() {
    onClose();
  }

  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent>

      {/* ── Animated backdrop ─────────────────────────────────────────────── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, ps.backdrop, { opacity: backdropOpacity }]}
        pointerEvents="box-none">
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      </Animated.View>

      {/* ── Animated sheet ────────────────────────────────────────────────── */}
      <Animated.View
        style={[
          ps.sheet,
          { backgroundColor: theme.backgroundElement },
          { transform: [{ translateY }] },
        ]}>
        {/* Handle */}
        <View style={[ps.handle, { backgroundColor: theme.backgroundSelected }]} />
        <ThemedText style={ps.title}>Registering for</ThemedText>

        {/* ── Resident (self) row ────────────────────────────────────────── */}
        <Pressable
          style={[ps.row, isResidentSelected && { backgroundColor: PRIMARY_GREEN + '14' }]}
          onPress={() => onSelect({ type: 'self' })}>
          <View style={[ps.avatarCircle, { backgroundColor: PRIMARY_GREEN }]}>
            {residentAvatarUrl ? (
              <Image
                source={{ uri: residentAvatarUrl }}
                style={ps.avatarImage}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
            ) : (
              <ThemedText style={ps.avatarInitials}>
                {getInitials(residentName)}
              </ThemedText>
            )}
          </View>
          <View style={ps.rowInfo}>
            <ThemedText style={ps.rowName}>{residentName}</ThemedText>
            <ThemedText themeColor="textSecondary" style={ps.rowSub}>Myself (Resident)</ThemedText>
          </View>
          {isResidentSelected && (
            <Ionicons name="checkmark-circle" size={22} color={PRIMARY_GREEN} />
          )}
        </Pressable>

        {/* ── Household members ──────────────────────────────────────────── */}
        {householdMembers.length === 0 ? (
          <View style={ps.emptyBox}>
            <Ionicons name="people-outline" size={28} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={ps.emptyText}>
              No household members added yet.{'\n'}Go to Profile → Household Information to add them.
            </ThemedText>
            <Pressable
              style={[ps.goToProfileBtn, { backgroundColor: PRIMARY_GREEN }]}
              onPress={() => {
                handleClose();
                router.push('/(app)/settings/profile');
              }}>
              <ThemedText style={ps.goToProfileText}>Go to Profile</ThemedText>
            </Pressable>
          </View>
        ) : (
          <ScrollView
            style={ps.memberList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {householdMembers.map((m) => {
              const isSel = selection.type === 'member' && selection.member.id === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[ps.row, isSel && { backgroundColor: PRIMARY_GREEN + '14' }]}
                  onPress={() => onSelect({ type: 'member', member: m })}>
                  <View style={[ps.avatarCircle, ps.memberAvatarBg]}>
                    <ThemedText style={ps.avatarInitials}>{getInitials(m.name)}</ThemedText>
                  </View>
                  <View style={ps.rowInfo}>
                    <ThemedText style={ps.rowName}>{m.name}</ThemedText>
                    <ThemedText themeColor="textSecondary" style={ps.rowSub}>
                      {m.relation} · {m.role}
                    </ThemedText>
                  </View>
                  {isSel && (
                    <Ionicons name="checkmark-circle" size={22} color={PRIMARY_GREEN} />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </Animated.View>
    </Modal>
  );
}

const ps = StyleSheet.create({
  // Layout-only; the rgba background color is set inline so it can be driven by
  // the Animated opacity value without conflicting with useNativeDriver.
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.three,
    paddingBottom: 40,
    paddingTop: Spacing.two,
    maxHeight: '75%',
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: Spacing.two + 4,
  },
  memberList: {
    flexGrow: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 4,
    paddingVertical: Spacing.two + 2,
    paddingHorizontal: Spacing.two,
    borderRadius: 12,
    marginBottom: 4,
  },
  // rowSelected/avatarCircle background applied inline at each usage site with the live
  // accent — see the live-accent note at the top of this file.
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  memberAvatarBg: {
    backgroundColor: '#D1D5DB',
  },
  avatarImage: {
    width: 44,
    height: 44,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  rowInfo: {
    flex: 1,
    gap: 2,
  },
  rowName: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.four,
    gap: Spacing.two,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  goToProfileBtn: {
    marginTop: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    // backgroundColor applied inline at the usage site with the live accent.
    borderRadius: 20,
  },
  goToProfileText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
});

// ─── ScreenHeader ─────────────────────────────────────────────────────────────

function ScreenHeader({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the live-accent note at the top of this file.
  const PRIMARY_GREEN = theme.primary;
  const insets = useSafeAreaInsets();

  return (
    <View style={[s.header, { backgroundColor: PRIMARY_GREEN, paddingTop: insets.top + Spacing.two }]}>
      <Pressable
        onPress={onBack}
        style={s.backBtn}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={Spacing.two}>
        <Ionicons name="chevron-back" size={26} color="#fff" />
      </Pressable>
      <View style={s.headerContent}>
        <ThemedText style={[s.headerTitle, { color: theme.onPrimary }]}>
          Applicant Registration
        </ThemedText>
      </View>
    </View>
  );
}

// ─── ProfileRow ──────────────────────────────────────────────────────────────

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.profileRow}>
      <ThemedText themeColor="textSecondary" style={s.profileRowLabel}>{label}</ThemedText>
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
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  // backgroundColor applied inline in ScreenHeader with the live accent — mirrors
  // the Profile screen header (same green bar overlapping the status bar).
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
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
  },

  // ── Applicant number card ──────────────────────────────────────────────────
  appNumCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  // appNumLabel/appNumValue color applied inline with the live accent — see the shadow
  // note at the top of this file.
  appNumLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  appNumValue: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 38,
  },

  // ── Registering for ────────────────────────────────────────────────────────
  sectionCaption: {
    fontSize: 11,
    fontWeight: '600',
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
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
  // color/backgroundColor applied inline with the live accent.
  selectionTag: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 4,
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
    textAlign: 'right',
    minWidth: 60,
    padding: 0,
  },
  divider: {
    height: 1,
  },
  editLink: {
    alignSelf: 'flex-end',
    paddingTop: 10,
  },
  editLinkText: {
    fontSize: 14,
    // color applied inline with the live accent.
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
    borderWidth: 1,
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
    borderRadius: 10,
    padding: Spacing.two + 4,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 13,
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
    borderTopWidth: 1,
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
    // color applied inline with the live accent.
    textAlign: 'center',
    lineHeight: 28,
  },
  successSub: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  successNumCard: {
    borderWidth: 1,
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
    // color applied inline with the live accent.
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  successNum: {
    fontSize: 28,
    fontWeight: '800',
    // color applied inline with the live accent.
    letterSpacing: 0.5,
  },
  successMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successMetaText: {
    fontSize: 14,
    lineHeight: 20,
  },
  successNote: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  doneBtn: {
    // backgroundColor applied inline with the live accent.
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
