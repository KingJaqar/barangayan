/**
 * Resident profile: compact photo summary and responsive editable details.
 * Narrow screens and larger text use stacked labels; wider screens use rows.
 * Photo uploads save immediately; profile and household edits use Save Changes.
 */

import {
  EMAIL_REGEX,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  MOBILE_NUMBER_REGEX,
  NAME_REGEX,
  SEXES,
  type EmploymentStatus,
  type Sex,
  type Json,
} from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { HouseholdError, householdRequest, readHouseholdMembers, saveHouseholdMembers } from '@/lib/household';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { GuestPrompt } from '@/components/guest-prompt';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { SettingsSheet } from '@/components/settings-sheet';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useFontPreference } from '@/hooks/use-font-preference';
import { getMobileFontFamily } from '@/constants/fonts';
import {
  imageExtension,
  pickImageAsset,
  readImageBytes
} from '@/lib/image-upload';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'] as const;

// ─── Live per-field validation ────────────────────────────────────────────────
// Same rules/shape as Register's fieldStatus/validate* helpers (register.tsx) —
// a red alert or green check appears below a field the moment its value becomes
// invalid/valid, as-you-type. Empty required fields stay silent until a Save
// Changes attempt populates fieldErrors below (the "required" message).
function validateName(value: string): string | null {
  return NAME_REGEX.test(value) ? null : 'Letters only — no numbers or symbols';
}
function validateMobileNumber(value: string): string | null {
  return MOBILE_NUMBER_REGEX.test(value) ? null : 'Enter an 11-digit mobile number (e.g. 09171234567)';
}
function validateEmail(value: string): string | null {
  return EMAIL_REGEX.test(value) ? null : 'Enter a valid email address';
}

function fieldStatus(
  value: string,
  submitError: string | undefined,
  validate?: (value: string) => string | null,
  successMessage = ' ',
): { error?: string; success?: string } {
  if (!value) return submitError ? { error: submitError } : {};
  const message = validate?.(value);
  if (message) return { error: message };
  return { success: successMessage };
}

const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};
const ROLES     = ['Head of Family', 'Student', 'Employed', 'Unemployed', 'Retired', 'Minor'] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface HouseholdMember {
  id: string;          // client uuid for React keys
  name: string;
  relation: string;
  role?: string | null;
}

function profileMember(value: Json): HouseholdMember | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || typeof value.id !== 'string' || typeof value.name !== 'string' || typeof value.relation !== 'string'
    || (value.role !== undefined && value.role !== null && typeof value.role !== 'string')) return null;
  // Retain optional draft fields; conditional saves compare the untouched raw snapshot.
  return { ...value, id: value.id, name: value.name, relation: value.relation };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * RFC-4122 v4 UUID. Household member ids are written into
 * profiles.household_members (jsonb) and then mirrored by a DB trigger into
 * the canonical household_members table, which has a real `uuid` primary
 * key — a non-UUID client id makes that trigger's `::uuid` cast fail with
 * "invalid input syntax for type uuid" and the whole profile save errors
 * out. `crypto.randomUUID` isn't guaranteed available in the Hermes RN
 * runtime, so build one from Math.random() instead — it only needs to be
 * unique and UUID-shaped, not cryptographically random.
 */
function genId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** YYYY-MM-DD → "August 8, 2000" */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}


// ─── Sub-components ───────────────────────────────────────────────────────────

// Keep long labels and larger accessibility text stacked on smaller displays.
function useCompactFields() {
  const { width, fontScale } = useWindowDimensions();
  return width >= 360 && fontScale <= 1.2;
}

/** Verified Resident pill badge */
function VerifiedBadge() {
  const theme = useTheme();
  return (
    <View style={[badgeStyles.pill, { backgroundColor: theme.resident.accentSoft }]}>
      <Ionicons name="checkmark-circle" size={14} color={theme.resident.accentText} />
      <ThemedText style={[badgeStyles.text, { color: theme.resident.accentText }]}>Verified Resident</ThemedText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
});

/** Red asterisk suffix for required-field labels — matches Register's RequiredMark. */
function RequiredMark() {
  const { resident } = useTheme();
  return (
    <ThemedText type="small" style={{ color: resident.danger }}>
      {' '}
      *
    </ThemedText>
  );
}

/** Error (red alert) or success (green check) row shown below a field — shared by
 * FieldRow and InlineFieldInput so both render the same treatment Register's
 * Confirm Password field pioneered (see fieldStatus above). */
function FieldStatusRow({ error, success }: { error?: string; success?: string }) {
  const theme = useTheme();
  if (error) {
    return (
      <View style={fieldStyles.statusRow}>
        <Ionicons name="alert-circle-outline" size={13} color={theme.resident.danger} />
        <ThemedText accessibilityRole="alert" type="small" style={[fieldStyles.statusText, { color: theme.resident.danger }]}>{error}</ThemedText>
      </View>
    );
  }
  if (success?.trim()) {
    return (
      <View style={fieldStyles.statusRow}>
        <Ionicons name="checkmark-circle-outline" size={13} color={theme.resident.success} />
        <ThemedText type="small" style={{ color: theme.resident.success }}>{success}</ThemedText>
      </View>
    );
  }
  return null;
}

/** A single field row: label / display value + edit pencil — used for Sex / Employment
 * Status / Date of Birth, which open a picker rather than edit inline. */
function FieldRow({
  label,
  value,
  placeholder,
  required,
  error,
  success,
  onEdit,
}: {
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  error?: string;
  success?: string;
  onEdit: () => void;
}) {
  const theme = useTheme();
  const compact = useCompactFields();
  return (
    <View style={fieldStyles.fieldWrapper}>
      <Pressable style={fieldStyles.row} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${label}`}>
        <View style={[fieldStyles.body, compact && fieldStyles.compactBody]}>
          <ThemedText themeColor="textSecondary" style={[fieldStyles.label, compact && fieldStyles.compactLabel]}>
            {label}
            {required ? <RequiredMark /> : null}
            {success && !success.trim() && !error ? (
              <>  <Ionicons name="checkmark-circle-outline" size={13} color={theme.resident.success} accessible={false} /></>
            ) : null}
          </ThemedText>
          <ThemedText style={[fieldStyles.value, compact && fieldStyles.compactValue, !value && { color: theme.textSecondary }]}>
            {value || placeholder}
          </ThemedText>
        </View>
        <Ionicons name="create-outline" size={18} color={theme.resident.accentText} />
      </Pressable>
      <FieldStatusRow error={error} success={success} />
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingVertical: Spacing.one,
    gap: Spacing.two,
  },
  body: { flex: 1, minWidth: 0, gap: 2 },
  compactBody: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  compactLabel: { width: 108, flexShrink: 0 },
  compactValue: { flex: 1, minWidth: 0 },
  label: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  value: { fontSize: 16, fontWeight: '600' },
  fieldWrapper: { gap: 2 },
  inlineRow: { paddingVertical: Spacing.one, gap: 2 },
  inputBody: { gap: 2 },
  inlineInput: {
    fontSize: 16,
    minHeight: 44,
    paddingVertical: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusText: { flex: 1 },
});

/**
 * A field edited directly in the display form — no tap-to-open bottom sheet.
 * Used for the fields residents are expected to correct most often (name parts,
 * address parts, mobile number); the value is written straight into screen state
 * on every keystroke and persisted by the batched "Save Changes" CTA like every
 * other field on this screen.
 */
function InlineFieldInput({
  label,
  value,
  placeholder,
  required,
  error,
  success,
  onChangeText,
  keyboardType,
  maxLength,
}: {
  label: string;
  value: string;
  placeholder: string;
  required?: boolean;
  error?: string;
  success?: string;
  onChangeText: (val: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
  maxLength?: number;
}) {
  const theme = useTheme();
  const { fontId } = useFontPreference();
  const compact = useCompactFields();
  return (
    <View style={fieldStyles.inlineRow}>
      <View style={[fieldStyles.inputBody, compact && fieldStyles.compactBody]}>
        <ThemedText themeColor="textSecondary" style={[fieldStyles.label, compact && fieldStyles.compactLabel]}>
          {label}
          {required ? <RequiredMark /> : null}
          {success && !success.trim() && !error ? (
            <>  <Ionicons name="checkmark-circle-outline" size={13} color={theme.resident.success} accessible={false} /></>
          ) : null}
        </ThemedText>
        <TextInput
          style={[fieldStyles.inlineInput, compact && fieldStyles.compactValue, { color: theme.text, fontFamily: getMobileFontFamily(fontId) }]}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textSecondary}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
          maxLength={maxLength}
          returnKeyType="done"
        />
      </View>
      <FieldStatusRow error={error} success={success} />
    </View>
  );
}

/** Household member list item */
function MemberRow({
  member,
  onPress,
}: {
  member: HouseholdMember;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={memberStyles.row} onPress={onPress} accessibilityRole="button">
      <View style={[memberStyles.avatar, { backgroundColor: theme.resident.border }]}>
        <ThemedText themeColor="textSecondary" style={memberStyles.initials}>{getInitials(member.name)}</ThemedText>
      </View>
      <View style={memberStyles.info}>
        <ThemedText style={memberStyles.name}>{member.name}</ThemedText>
        <ThemedText themeColor="textSecondary" style={memberStyles.sub}>
          {member.relation} · {member.role}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

const memberStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: Spacing.three,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 14, fontWeight: '700' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600' },
  sub: { fontSize: 12 },
});

/** Section card wrapper */
function SectionCard({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  const theme = useTheme();
  return <View>
    <View style={styles.sectionHeaderRow}><ThemedText accessibilityRole="header" style={styles.sectionTitle}>{title}</ThemedText>{action}</View>
    <View style={[cardStyles.card, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>{children}</View>
  </View>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';

function Toast({ message, type }: { message: string; type: ToastType }) {
  const theme = useTheme();
  const foreground = type === 'error' ? theme.resident.onDanger : theme.resident.onAccent;
  return (
    <View style={toastStyles.overlay} pointerEvents="none">
      <View accessibilityLiveRegion="polite" style={[toastStyles.pill, { backgroundColor: type === 'error' ? theme.resident.danger : theme.resident.accent, shadowColor: theme.text }]}>
        <Ionicons
          name={type === 'success' ? 'checkmark-circle' : 'alert-circle-outline'}
          size={16}
          color={foreground}
        />
        <ThemedText style={[toastStyles.text, { color: foreground }]}>{message}</ThemedText>
      </View>
    </View>
  );
}

const toastStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 32,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  text: { fontSize: 14, fontWeight: '600' },
});

const cardStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    gap: 0,
  },
});

function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.resident.border, marginLeft: 0 }} />;
}

// ─── Household Member Modal ───────────────────────────────────────────────────

function MemberModal({
  visible,
  initial,
  onClose,
  onSave,
  onDelete,
}: {
  visible: boolean;
  initial: HouseholdMember | null;
  onClose: () => void;
  onSave: (m: HouseholdMember) => void;
  onDelete?: (id: string) => void;
}) {
  const theme = useTheme();
  const { fontId } = useFontPreference();
  const [name, setName]         = useState('');
  const [relation, setRelation] = useState<string>(RELATIONS[0]);
  const [role, setRole]         = useState<string>(ROLES[0]);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setRelation(initial?.relation ?? RELATIONS[0]);
      setRole(initial?.role ?? ROLES[0]);
    }
  }, [visible, initial]);

  const isEdit = !!initial;

  return <SettingsSheet visible={visible} title={isEdit ? 'Edit Member' : 'Add Household Member'} onClose={onClose} footer={
    <View style={mModalStyles.actions}>
      {initial && onDelete ? <View style={{ flex: 1 }}><PrimaryButton presentation="resident" variant="destructive" label="Remove" onPress={() => { onDelete(initial.id); onClose(); }} /></View> : null}
      <View style={{ flex: 2 }}><PrimaryButton presentation="resident" label={isEdit ? 'Update' : 'Add Member'} disabled={!name.trim()} onPress={() => { onSave({ id: initial?.id ?? genId(), name: name.trim(), relation, role }); onClose(); }} /></View>
    </View>
  }>
    <ThemedText themeColor="textSecondary" style={mModalStyles.label}>Full Name</ThemedText>
    <TextInput accessibilityLabel="Household member full name" style={[mModalStyles.input, { borderColor: theme.resident.controlBorder, backgroundColor: theme.resident.surface, color: theme.resident.text, fontFamily: getMobileFontFamily(fontId) }]} value={name} onChangeText={setName} placeholder="e.g. Juan Santos" placeholderTextColor={theme.resident.muted} returnKeyType="done" />
    <ThemedText themeColor="textSecondary" style={mModalStyles.label}>Relation</ThemedText>
    <OptionRow options={RELATIONS} value={relation} onChange={setRelation} />
    <ThemedText themeColor="textSecondary" style={mModalStyles.label}>Role</ThemedText>
    <OptionRow options={ROLES} value={role} onChange={setRole} />
    <ThemedText type="small" themeColor="textSecondary">Member changes are saved with Save Changes on your profile.</ThemedText>
  </SettingsSheet>;
}

const mModalStyles = StyleSheet.create({
  label: { fontSize: 12.5, lineHeight: 18, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48, fontSize: 16 },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, borderWidth: 1 },
  chipText: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 12 },
});

function OptionRow({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 8, flexDirection: 'row', flexWrap: 'wrap' }}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          accessibilityRole="button" accessibilityState={{ selected: value === opt }}
          onPress={() => onChange(opt)}
          style={[
            mModalStyles.chip,
            { backgroundColor: theme.resident.border, borderColor: theme.resident.border },
            value === opt && { backgroundColor: theme.resident.accent, borderColor: theme.resident.accentText },
          ]}>
          <ThemedText style={[mModalStyles.chipText, { color: theme.textSecondary }, value === opt && { color: theme.resident.onAccent }]}>{opt}</ThemedText>
        </Pressable>
      ))}
    </View>
  );
}

const idModalStyles = StyleSheet.create({
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, paddingVertical: 14, borderBottomWidth: 1 },
  optionText: { fontSize: 16, flex: 1 },
});

// ─── Choice List Modal (Sex / Employment Status) ──────────────────────────────
// Same bottom-sheet single-select shape as IdTypeModal above, generalized over
// any string-literal option set so Sex (2 options) and Employment Status (5
// options) don't need near-duplicate modal components.

function ChoiceListModal<T extends string>({
  visible,
  title,
  options,
  labels,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  options: readonly T[];
  labels: Record<T, string>;
  current: T | null;
  onClose: () => void;
  onSelect: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <SettingsSheet visible={visible} title={title} onClose={onClose}>
        {options.map((opt) => (
          <Pressable
            key={opt}
            accessibilityRole="button" accessibilityState={{ selected: current === opt }}
            onPress={() => { onSelect(opt); onClose(); }}
            style={[idModalStyles.optionRow, { borderBottomColor: theme.resident.border }]}>
            <ThemedText style={[idModalStyles.optionText, current === opt && { color: theme.resident.accentText, fontWeight: '700' }]}>
              {labels[opt]}
            </ThemedText>
            {current === opt && <Ionicons name="checkmark" size={18} color={theme.resident.accentText} />}
          </Pressable>
        ))}
    </SettingsSheet>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

// Authentication-only: residents (e.g. Google sign-ups who skipped details) must be
// able to open Profile to complete it. The Settings stack's session guard and the
// guest prompt below cover signed-out access; submission screens keep the
// profile-completion ResidentActionGate.
export default function ProfileScreen() {
  return <ProfileScreenContent />;
}

function ProfileScreenContent() {
  const router   = useRouter();
  const { session, refreshCompletion } = useAuth();
  const { profile, isLoading, error: profileError, refetch } = useProfile();
  const insets   = useSafeAreaInsets();
  const theme    = useTheme();
  const compactFields = useCompactFields();

  // ── Personal info fields ──────────────────────────────────────────────────
  // Full Name split into structured parts (Register/Profile field-split) — the
  // DB's compose_profiles_display_fields trigger (0081) derives profile.full_name
  // from these on save; the app never builds that composed string itself.
  const [firstName, setFirstName]   = useState('');
  const [lastName, setLastName]     = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix]         = useState('');
  const [sex, setSex]               = useState<Sex | null>(null);
  const [email, setEmail]             = useState('');
  // Home Address split into structured parts — "Barangay" isn't one of these; it's
  // profile.barangays?.name below (profiles.barangay_id, assigned at registration).
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet]   = useState('');
  const [city, setCity]       = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(null);
  const [occupation, setOccupation] = useState('');
  const [mobileNumber, setMobile]     = useState('');
  const [birthDateIso, setBirthDateIso] = useState<string | null>(null); // YYYY-MM-DD, source of truth
  const [showBirthPicker, setShowBirthPicker] = useState(false);

  // Locally-composed display name — reflects in-progress edits immediately (avatar
  // initials, header) instead of waiting for a save + refetch round-trip to see the
  // DB-composed profile.full_name update.
  const liveFullName = [firstName, middleName, lastName, suffix].filter(Boolean).join(' ') || profile?.full_name || '';

  // ── Household ─────────────────────────────────────────────────────────────
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const householdSnapshot = useRef<Json>([]);
  const [householdMustReload, setHouseholdMustReload] = useState(false);
  const householdSave = useRef<AbortController | null>(null);
  const saveOwner = useRef(session?.user.id);
  saveOwner.current = session?.user.id;

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Tracks whether the user changed their email address this session so
  // handleSave knows to reset email_verification_status (an edited email
  // is no longer the one that was verified).
  const [emailVerificationStatus, setEmailVerifStatus] = useState<string | null>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: ToastType } | null>(null);
  // Populated by validateRequiredFields() on a Save Changes attempt — the "required"
  // messages shown under empty required fields (fieldStatus below handles the
  // as-you-type format errors on non-empty values on its own).
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedAccount = useRef<string | null>(null);
  const preserveDraft = useRef(false);
  const saveBusy = useRef(false);
  useEffect(() => {
    saveBusy.current = false;
    setSaving(false);
    return () => { householdSave.current?.abort(); householdSave.current = null; };
  }, [session?.user.id]);
  const photoBusy = useRef(false);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  function showToast(message: string, type: ToastType = 'success') {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  /** Drops a stale save-attempt error for one field once the resident corrects it —
   * used by the picker-driven fields (Sex / Employment Status / Date of Birth), which
   * don't get the as-you-type re-validation InlineFieldInput's fieldStatus() gives text
   * fields for free. */
  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // Household member modal
  const [memberModal, setMemberModal] = useState<{ member: HouseholdMember | null } | null>(null);

  // Sex / Employment Status modals
  const [sexModal, setSexModal] = useState(false);
  const [employmentModal, setEmploymentModal] = useState(false);

  // ── Sync from profile ────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    setAvatarUrl(profile.avatar_url);
    // An immediate photo save/refetch must not discard the separate form draft.
    if (hydratedAccount.current === profile.id && preserveDraft.current) return;
    hydratedAccount.current = profile.id;
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setMiddleName(profile.middle_name ?? '');
    setSuffix(profile.suffix ?? '');
    setSex((profile.sex as Sex | null) ?? null);
    setEmail(profile.email ?? '');
    setMobile(profile.mobile_number ?? '');
    setHouseNo(profile.house_no ?? '');
    setStreet(profile.street ?? '');
    setCity(profile.city ?? '');
    setEmploymentStatus((profile.employment_status as EmploymentStatus | null) ?? null);
    setOccupation(profile.occupation ?? '');
    setBirthDateIso(profile.birth_date ?? null);
    setEmailVerifStatus(profile.email_verification_status);
    setFieldErrors({}); // reset any stale save-attempt errors on a fresh profile sync
    // Parse JSONB members array
    const raw = profile.household_members;
    householdSnapshot.current = raw ?? [];
    setHouseholdMustReload(false);
    if (Array.isArray(raw)) {
      setMembers(raw.flatMap(value => { const member = profileMember(value); return member ? [member] : []; }));
    } else setMembers([]);
  }, [profile]);

  // ── Dirty-state detection ─────────────────────────────────────────────────
  // True as soon as any field differs from what was last loaded from the DB.
  // The Save button is disabled (greyed) when false.
  const isDirty = useMemo(() => {
    if (!profile) return false;
    if (firstName    !== (profile.first_name   ?? ''))  return true;
    if (lastName     !== (profile.last_name    ?? ''))  return true;
    if (middleName   !== (profile.middle_name  ?? ''))  return true;
    if (suffix       !== (profile.suffix       ?? ''))  return true;
    if (sex          !== (profile.sex as Sex | null ?? null)) return true;
    if (email        !== (profile.email ?? '')) return true;
    if (houseNo      !== (profile.house_no ?? '')) return true;
    if (street       !== (profile.street   ?? '')) return true;
    if (city         !== (profile.city     ?? '')) return true;
    if (employmentStatus !== (profile.employment_status as EmploymentStatus | null ?? null)) return true;
    if (occupation   !== (profile.occupation ?? '')) return true;
    if (mobileNumber !== (profile.mobile_number ?? '')) return true;
    if (birthDateIso !== (profile.birth_date ?? null))  return true;
    // Household comparison — stringify for deep equality
    const rawMembers = profile.household_members;
    const profileMembersJson = JSON.stringify(Array.isArray(rawMembers) ? rawMembers : []);
    if (JSON.stringify(members) !== profileMembersJson) return true;
    return false;
  }, [
    profile, firstName, lastName, middleName, suffix, sex, email, houseNo, street, city,
    employmentStatus, occupation, mobileNumber, birthDateIso, members,
  ]);
  useEffect(() => { preserveDraft.current = isDirty; }, [isDirty]);
  const householdUnavailable = profile?.household_members != null && (!Array.isArray(profile.household_members)
    || profile.household_members.some(value => profileMember(value) === null));

  // ── Required-field / format validation ───────────────────────────────────
  // Run on every Save Changes attempt (see handleSave) — populates fieldErrors so
  // empty required fields show a red "required" message, matching Register's
  // registerSchema-driven validation. Format checks (names/mobile/email) also run
  // live as-you-type via fieldStatus() above; this additionally catches empty
  // required fields and the ID-verification completeness rules.
  function validateRequiredFields(): Record<string, string> {
    const errors: Record<string, string> = {};

    if (!firstName.trim()) errors.firstName = 'First name is required';
    else if (!NAME_REGEX.test(firstName)) errors.firstName = 'Letters only — no numbers or symbols';

    if (!lastName.trim()) errors.lastName = 'Last name is required';
    else if (!NAME_REGEX.test(lastName)) errors.lastName = 'Letters only — no numbers or symbols';

    if (middleName.trim() && !NAME_REGEX.test(middleName)) errors.middleName = 'Letters only — no numbers or symbols';
    if (suffix.trim() && !NAME_REGEX.test(suffix)) errors.suffix = 'Letters only — no numbers or symbols';

    if (!sex) errors.sex = 'Select your sex';
    if (!birthDateIso) errors.birthDate = 'Date of birth is required';

    if (!mobileNumber.trim()) errors.mobileNumber = 'Mobile number is required';
    else if (!MOBILE_NUMBER_REGEX.test(mobileNumber)) errors.mobileNumber = 'Enter an 11-digit mobile number (e.g. 09171234567)';

    if (!email.trim()) errors.email = 'Email is required';
    else if (!EMAIL_REGEX.test(email)) errors.email = 'Enter a valid email address';

    if (!houseNo.trim()) errors.houseNo = 'House No. is required';
    if (!street.trim()) errors.street = 'Street is required';
    if (!city.trim()) errors.city = 'City is required';
    if (!employmentStatus) errors.employmentStatus = 'Select employment status';

    return errors;
  }

  // ── Avatar upload ─────────────────────────────────────────────────────────
  // Saves immediately — independent of the "Save Changes" batch — so the
  // resident sees their new photo reflected in the app right away without
  // having to scroll down and tap the CTA.
  async function handleAvatarUpload() {
    if (!session || photoBusy.current) return;
    photoBusy.current = true;
    setAvatarUploading(true);
    try {
      const picked = await pickImageAsset();
      if (!picked) return;
      const bytes = await readImageBytes(picked);
      const ext   = imageExtension(picked.mimeType);
      // Single canonical path per resident — upsert:true overwrites the old file.
      const path  = `${session.user.id}/avatar.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from('profile-photos')
        .upload(path, bytes, { contentType: picked.mimeType, upsert: true });
      if (uploadErr) throw uploadErr;

      // The bucket is public so getPublicUrl() works without auth tokens and
      // doesn't expire — safe to persist in the DB column.
      const { data: urlData } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      // Persist immediately; do NOT include this in handleSave() to avoid a
      // race condition where the user saves other fields before the upload
      // completes, which could overwrite avatar_url with null.
      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', session.user.id);
      if (dbErr) throw dbErr;

      // Bust the expo-image cache for this URL so the new photo appears instantly.
      await Image.clearDiskCache();
      setAvatarUrl(publicUrl);
      refetch();
    } catch (e: unknown) {
      Alert.alert(
        'Upload Failed',
        e instanceof Error ? e.message : 'Could not upload profile photo. Please try again.',
      );
    } finally {
      photoBusy.current = false;
      setAvatarUploading(false);
    }
  }

  // ── Save all changes ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!session || !isDirty || saveBusy.current) return;
    if (householdMustReload) { showToast('Reload Profile before saving again. Your family changes may already have been saved.', 'error'); return; }
    if (householdUnavailable) { showToast('Your saved household details are unavailable. Reopen Profile or contact barangay staff before saving.', 'error'); return; }

    const errors = validateRequiredFields();
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      showToast('Please fix the highlighted fields', 'error');
      return;
    }
    setFieldErrors({});

    saveBusy.current = true;
    setSaving(true);
    const owner = session.user.id;
    const controller = new AbortController();
    householdSave.current = controller;
    let familySaved = false;
    try {
      const payload = members.map(member => ({ id: member.id, name: member.name, relation: member.relation, ...(member.role ? { role: member.role } : {}) }));
      readHouseholdMembers(payload);
      if (JSON.stringify(payload) !== JSON.stringify(readHouseholdMembers(householdSnapshot.current))) {
        const saved = await saveHouseholdMembers(payload, householdSnapshot.current, controller.signal);
        if (controller.signal.aborted || saveOwner.current !== owner) return;
        householdSnapshot.current = saved.snapshot;
        familySaved = true;
      }
      if (controller.signal.aborted || saveOwner.current !== owner) return;
      // Editing the email address invalidates whatever verification was
      // previously recorded for the old address — clear it so the "Verified
      // Resident" badge doesn't keep showing for an address nobody confirmed.
      const emailChanged = email.trim() !== (profile?.email ?? '');
      const nextEmailStatus = emailChanged ? null : emailVerificationStatus;

      const { data: updatedProfile, error: updateErr } = await householdRequest(signal => supabase
        .from('profiles')
        .update({
          // full_name is derived by the DB from these (migration 0081's
          // compose_profiles_display_fields trigger) — always sent together so the
          // trigger never partially recomposes it from a stale subset.
          first_name:                firstName.trim() || null,
          last_name:                 lastName.trim() || null,
          middle_name:               middleName.trim() || null,
          suffix:                    suffix.trim() || null,
          sex,
          email:                    email.trim() || null,
          mobile_number:            mobileNumber.trim() || null,
          // home_address is likewise derived from these three.
          house_no:                 houseNo.trim() || null,
          street:                   street.trim() || null,
          ...(!profile?.barangays?.barangay_localities ? { city: city.trim() || null } : {}),
          employment_status:        employmentStatus,
          occupation:               occupation.trim() || null,
          birth_date:               birthDateIso,
        })
        .eq('id', owner).select('id').abortSignal(signal).single(), controller.signal);

      if (controller.signal.aborted || saveOwner.current !== owner) return;

      if (updateErr || updatedProfile?.id !== owner) {
        showToast(familySaved ? 'Family changes saved, but other profile details could not be saved. Retry Save Changes.' : 'Could not save your profile details. Reconnect and try again.', 'error');
        return;
      }
      void refreshCompletion();
      setEmailVerifStatus(nextEmailStatus);
      showToast('Profile saved successfully ✓');
      preserveDraft.current = false;
      refetch();
    } catch (error: unknown) {
      if (!controller.signal.aborted && saveOwner.current === owner) {
        setHouseholdMustReload(true);
        showToast(error instanceof HouseholdError ? error.message : 'Could not confirm your profile changes. Reload Profile before saving again.', 'error');
      }
    } finally {
      if (householdSave.current === controller) {
        householdSave.current = null;
        saveBusy.current = false;
        setSaving(false);
      }
    }
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!session) return <GuestPrompt label="Log in to see your profile." />;
  if (isLoading && !profile) return <PlaceholderPanel label="Loading profile…" />;
  if (!profile) return <View style={{ flex: 1, padding: 20, backgroundColor: theme.background }}><PlaceholderPanel label={profileError ?? 'Profile unavailable'} /><PrimaryButton presentation="resident" label="Retry profile" onPress={refetch} /></View>;

  const isVerified  = emailVerificationStatus === 'verified';

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.resident.accent }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>

      <ServiceScreenHeader title="Profile" onBack={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        {householdMustReload ? <View style={{ gap: 8 }}>
          <ThemedText accessibilityRole="alert" style={{ color: theme.resident.danger }}>Reload Profile to review the saved family list before trying again. Reloading discards unsaved form edits.</ThemedText>
          <PrimaryButton presentation="resident" label="Reload Profile" onPress={() => { preserveDraft.current = false; refetch(); }} />
        </View> : null}

        {profileError ? <View><ThemedText accessibilityRole="alert" style={{ color: theme.resident.danger }}>{profileError}</ThemedText><PrimaryButton presentation="resident" variant="secondary" label="Retry profile" onPress={refetch} /></View> : null}
        {/* ── ② Avatar ────────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          {/* Keep the camera badge outside the photo's clipping boundary. */}
          <Pressable
            onPress={handleAvatarUpload}
            disabled={avatarUploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            hitSlop={8}>

            <View style={styles.avatarOuter}>
              {/* Circle — photo or initials + upload spinner */}
              <View style={[styles.avatarCircle, { backgroundColor: theme.resident.accent, borderColor: theme.resident.card, shadowColor: theme.text }]}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <ThemedText style={[styles.avatarInitials, { color: theme.resident.onAccent }]}>
                    {getInitials((liveFullName || session.user.email?.split('@')[0]) ?? '?')}
                  </ThemedText>
                )}

                {avatarUploading && (
                  <View style={[styles.avatarSpinnerOverlay, { backgroundColor: theme.text + '73' }]}>
                    <ActivityIndicator size="large" color={theme.resident.onAccent} />
                  </View>
                )}
              </View>

              {/* Camera badge — sibling of circle, paints on top */}
              <View style={[styles.cameraBadge, { backgroundColor: theme.resident.accent, borderColor: theme.resident.card }]}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color={theme.resident.onAccent} />
                  : <Ionicons name="camera" size={13} color={theme.resident.onAccent} />}
              </View>
            </View>
          </Pressable>

          {/* ③ Name + badge */}
          <View style={styles.identityText}>
            <ThemedText style={styles.nameText}>{liveFullName || '—'}</ThemedText>
            <ThemedText style={{ fontSize: 13, lineHeight: 19, color: theme.resident.muted }}>Fields marked <RequiredMark /> are required.</ThemedText>
            {isVerified && <View style={styles.identityBadge}><VerifiedBadge /></View>}
          </View>
        </View>

        <SectionCard title="Personal Information">
          <InlineFieldInput
            label="First Name"
            required
            value={firstName}
            placeholder="Enter first name"
            onChangeText={setFirstName}
            {...fieldStatus(firstName, fieldErrors.firstName, validateName)}
          />
          <Divider />
          <InlineFieldInput
            label="Middle Name"
            value={middleName}
            placeholder="Optional"
            onChangeText={setMiddleName}
            {...fieldStatus(middleName, fieldErrors.middleName, validateName)}
          />
          <Divider />
          <InlineFieldInput
            label="Last Name"
            required
            value={lastName}
            placeholder="Enter last name"
            onChangeText={setLastName}
            {...fieldStatus(lastName, fieldErrors.lastName, validateName)}
          />
          <Divider />
          <InlineFieldInput
            label="Suffix"
            value={suffix}
            placeholder="Optional — e.g. Jr., III"
            onChangeText={setSuffix}
            {...fieldStatus(suffix, fieldErrors.suffix, validateName)}
          />
          <Divider />
          <FieldRow
            label="Sex"
            required
            value={sex ? SEX_LABELS[sex] : ''}
            placeholder="Select sex"
            error={fieldErrors.sex}
            success={sex ? ' ' : undefined}
            onEdit={() => setSexModal(true)}
          />
          <Divider />
          <FieldRow
            label="Date of Birth"
            required
            value={fmtDate(birthDateIso)}
            placeholder="Select your date of birth"
            error={fieldErrors.birthDate}
            success={birthDateIso ? ' ' : undefined}
            onEdit={() => setShowBirthPicker(true)}
          />
          <Divider />
          <FieldRow
            label="Employment Status"
            required
            value={employmentStatus ? EMPLOYMENT_STATUS_LABELS[employmentStatus] : ''}
            placeholder="Select employment status"
            error={fieldErrors.employmentStatus}
            success={employmentStatus ? ' ' : undefined}
            onEdit={() => setEmploymentModal(true)}
          />
          {employmentStatus && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus) ? (
            <>
              <Divider />
              <InlineFieldInput label="Occupation" value={occupation} placeholder="Optional" onChangeText={setOccupation} />
            </>
          ) : null}
        </SectionCard>
        <SectionCard title="Contact">
          <InlineFieldInput
            label="Email"
            required
            value={email}
            placeholder="Enter email address"
            onChangeText={setEmail}
            keyboardType="email-address"
            {...fieldStatus(email, fieldErrors.email, validateEmail)}
          />
          <Divider />
          <InlineFieldInput
            label="Mobile Number"
            required
            value={mobileNumber}
            placeholder="09171234567"
            onChangeText={setMobile}
            keyboardType="phone-pad"
            maxLength={11}
            {...fieldStatus(mobileNumber, fieldErrors.mobileNumber, validateMobileNumber)}
          />
        </SectionCard>
        {email.trim() !== (profile.email ?? '') ? <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.resident.warning, fontSize: 12.5, lineHeight: 18 }}>You'll need to verify your new email again after saving.</ThemedText> : null}
        <SectionCard title="Address">
          <InlineFieldInput
            label="House No."
            required
            value={houseNo}
            placeholder="Enter house/unit number"
            onChangeText={setHouseNo}
            {...fieldStatus(houseNo, fieldErrors.houseNo)}
          />
          <Divider />
          <InlineFieldInput
            label="Street"
            required
            value={street}
            placeholder="Enter street"
            onChangeText={setStreet}
            {...fieldStatus(street, fieldErrors.street)}
          />
          <Divider />
          {profile?.barangays?.barangay_localities ? <View style={[fieldStyles.row, { opacity: 0.75 }]} accessible accessibilityLabel={`City, ${profile?.city ?? 'Not configured'}, read only`}>
            <View style={[fieldStyles.body, compactFields && fieldStyles.compactBody]}><ThemedText themeColor="textSecondary" style={[fieldStyles.label, compactFields && fieldStyles.compactLabel]}>City</ThemedText><ThemedText style={[fieldStyles.value, compactFields && fieldStyles.compactValue]}>{profile?.city ?? 'Not configured'}</ThemedText></View><Ionicons name="lock-closed-outline" size={16} color={theme.resident.muted} accessible={false} />
          </View> : <InlineFieldInput label="City" required value={city} placeholder="Enter city/municipality" onChangeText={setCity} {...fieldStatus(city, fieldErrors.city)} />}
          <Divider />
          {/* Read-only — this is profiles.barangay_id, assigned automatically at
              registration (AGENTS.md §0), not a free-text address component. */}
          <View style={fieldStyles.row} accessible accessibilityLabel={`Barangay, ${profile?.barangays?.barangay_localities?.display_name ?? profile?.barangays?.name ?? 'Not configured'}, read only`}>
            <View style={[fieldStyles.body, compactFields && fieldStyles.compactBody]}>
              <ThemedText themeColor="textSecondary" style={[fieldStyles.label, compactFields && fieldStyles.compactLabel]}>Barangay</ThemedText>
              <ThemedText style={[fieldStyles.value, compactFields && fieldStyles.compactValue]}>{profile?.barangays?.barangay_localities?.display_name ?? profile?.barangays?.name ?? '—'}</ThemedText>
            </View><Ionicons name="lock-closed-outline" size={16} color={theme.resident.muted} accessible={false} />
          </View>
          <Divider />
          <View style={[fieldStyles.row, { opacity: 0.75 }]} accessible accessibilityLabel={`Province, ${profile?.province ?? 'Not configured'}, read only`}>
            <View style={[fieldStyles.body, compactFields && fieldStyles.compactBody]}><ThemedText themeColor="textSecondary" style={[fieldStyles.label, compactFields && fieldStyles.compactLabel]}>Province</ThemedText><ThemedText style={[fieldStyles.value, compactFields && fieldStyles.compactValue]}>{profile?.province ?? 'Not configured'}</ThemedText></View><Ionicons name="lock-closed-outline" size={16} color={theme.resident.muted} accessible={false} />
          </View>
        </SectionCard>

        {/* ── ⑤ Household Information ──────────────────────────────────── */}
        <SectionCard title="Household Information" action={
          <Pressable onPress={() => setMemberModal({ member: null })} accessibilityRole="button" accessibilityLabel="Add household member" style={styles.addMemberBtn}>
            <Ionicons name="add" size={16} color={theme.resident.accentText} />
            <ThemedText style={[styles.addLink, { color: theme.resident.accentText }]}>Add Member</ThemedText>
          </Pressable>
        }>
          {householdUnavailable ? <ThemedText accessibilityRole="alert" style={{ color: theme.resident.danger, paddingVertical: 12 }}>Your saved household details are unavailable. Reopen Profile or contact barangay staff before saving.</ThemedText> : null}

          {members.length === 0 ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyHousehold}>No household members added yet.</ThemedText>
          ) : (
            members.map((m, idx) => (
              <View key={m.id}>
                {idx > 0 && <Divider />}
                <MemberRow member={m} onPress={() => setMemberModal({ member: m })} />
              </View>
            ))
          )}
        </SectionCard>

      </ScrollView>

      <View style={[styles.saveBar, { backgroundColor: theme.resident.card, borderTopColor: theme.resident.border, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <PrimaryButton presentation="resident" label={saving ? 'Saving…' : 'Save Changes'} disabled={!isDirty || householdUnavailable} loading={saving} onPress={handleSave} />
      </View>

      {/* ── Centered toast ────────────────────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <BirthdayCalendarModal
        presentation="resident"
        visible={showBirthPicker}
        value={birthDateIso ? isoToLocalDate(birthDateIso) : null}
        onClose={() => setShowBirthPicker(false)}
        onSave={(date) => {
          setBirthDateIso(dateToIso(date));
          setShowBirthPicker(false);
          clearFieldError('birthDate');
        }}
      />

      <MemberModal
        visible={!!memberModal}
        initial={memberModal?.member ?? null}
        onClose={() => setMemberModal(null)}
        onSave={(m) => {
          setMembers((prev) => {
            const existing = prev.findIndex((x) => x.id === m.id);
            if (existing >= 0) {
              const next = [...prev];
              next[existing] = m;
              return next;
            }
            return [...prev, m];
          });
        }}
        onDelete={(id) => setMembers((prev) => prev.filter((x) => x.id !== id))}
      />

      <ChoiceListModal
        visible={sexModal}
        title="Select Sex"
        options={SEXES}
        labels={SEX_LABELS}
        current={sex}
        onClose={() => setSexModal(false)}
        onSelect={(v) => {
          setSex(v);
          clearFieldError('sex');
        }}
      />

      <ChoiceListModal
        visible={employmentModal}
        title="Select Employment Status"
        options={EMPLOYMENT_STATUSES}
        labels={EMPLOYMENT_STATUS_LABELS}
        current={employmentStatus}
        onClose={() => setEmploymentModal(false)}
        onSelect={(v) => {
          setEmploymentStatus(v);
          if (!EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(v)) setOccupation('');
          clearFieldError('employmentStatus');
        }}
      />
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 }, root: { flex: 1 },
  avatarSection: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  identityText: { flex: 1, minWidth: 0, gap: 4 }, identityBadge: { alignSelf: 'flex-start', maxWidth: '100%' },
  avatarOuter: { width: 76, height: 76, position: 'relative' },
  avatarCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarInitials: { fontSize: 28, fontWeight: '700', lineHeight: 36 },
  avatarImage: { width: '100%', height: '100%' },
  avatarSpinnerOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  cameraBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  nameText: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  content: { padding: 16, gap: 16 },
  sectionTitle: { fontSize: 15, lineHeight: 21, fontWeight: '700', flexShrink: 1 },
  sectionHeaderRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, paddingHorizontal: 4, gap: 8 },
  addLink: { fontSize: 14, fontWeight: '700' },
  addMemberBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4 },
  emptyHousehold: { fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  saveBar: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12 },
});
