/**
 * Resident Profile screen — pixel-accurate rebuild of the design file.
 *
 * Sections
 *  ① Header            — green bar, back chevron, "Profile" title
 *  ② Avatar            — real photo (expo-image) when avatar_url set; initials fallback
 *                        Tap anywhere on the circle or the pencil badge to re-upload.
 *                        Saved immediately (independent of the Save Changes button).
 *  ③ Verified badge    — shows when email_verification_status = 'verified'
 *  ④ Personal Info     — First/Middle/Last/Suffix, Email, House No./Street/City, Mobile
 *                        Number are edited directly in the display form (plain
 *                        TextInput, no modal); Occupation still uses the tap-to-edit
 *                        bottom sheet, Sex/Employment Status/Birthday use their pickers.
 *  ⑤ Household         — JSONB member list; Add / edit / remove via bottom modal
 *  ⑥ Identification    — ID type picker + stored ID photo display + re-upload
 *  ⑦ Save Changes CTA  — fixed green pill at bottom
 *
 * DB columns added in migration 0039:
 *   email, household_members (jsonb), id_photo_urls (text[]), id_type (text)
 * DB column added in migration 0040:
 *   avatar_url (text) — full public URL of the profile-photos bucket object
 *
 * Design tokens (sampled from reference screenshot):
 *   Primary green      #0F6E5B  (Colors.light.primary)
 *   Background         #F6F6F6  (outer page)
 *   Card bg            #FFFFFF
 *   Card border        1 px  rgba(0,0,0,0.08)
 *   Card radius        16 px
 *   Text primary       #111111
 *   Text secondary     #60646C
 *   Divider            1 px  #E8E8EC
 *   Badge bg           rgba(15,110,91,0.12)
 *   Avatar size        96 px
 *   Section title      14 px semibold
 *   Field label        12 px  textSecondary
 *   Field value        16 px  text
 *   Edit pencil icon   "create-outline"  18 px  primary
 */

import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  SEXES,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { GuestPrompt } from '@/components/guest-prompt';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import {
  imageExtension,
  pickImageAsset,
  readImageBytes
} from '@/lib/image-upload';
import { supabase } from '@/lib/supabase';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY_GREEN = Colors.light.primary; // #0F6E5B — always brand green

const ID_TYPES = [
  'PhilSys',
  'Digital PhilSys',
  "Driver's License",
  'Passport',
  'SSS ID',
  "Voter's ID",
  'PhilHealth ID',
  'PRC ID',
  'UMID',
  'Postal ID',
  'Senior Citizen ID',
  'PWD ID',
  'GSIS ID',
  'TIN ID',
  'Barangay ID',
  'Other',
] as const;

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'] as const;

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
  role: string;
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

/** Verified Resident pill badge */
function VerifiedBadge() {
  return (
    <View style={badgeStyles.pill}>
      <Ionicons name="checkmark-circle" size={14} color={PRIMARY_GREEN} />
      <ThemedText style={badgeStyles.text}>Verified Resident</ThemedText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_GREEN + '1E',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'center',
  },
  text: {
    color: PRIMARY_GREEN,
    fontSize: 12,
    fontWeight: '600',
  },
});

/** A single field row: label / display value + edit pencil */
function FieldRow({
  label,
  value,
  placeholder,
  onEdit,
}: {
  label: string;
  value: string;
  placeholder: string;
  onEdit: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable style={fieldStyles.row} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${label}`}>
      <View style={fieldStyles.body}>
        <ThemedText themeColor="textSecondary" style={fieldStyles.label}>{label}</ThemedText>
        <ThemedText style={[fieldStyles.value, !value && { color: theme.textSecondary }]}>
          {value || placeholder}
        </ThemedText>
      </View>
      <Ionicons name="create-outline" size={18} color={PRIMARY_GREEN} />
    </Pressable>
  );
}

const fieldStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    gap: Spacing.three,
  },
  body: { flex: 1, gap: 2 },
  label: { fontSize: 12, fontWeight: '500' },
  value: { fontSize: 16 },
  inlineRow: { paddingVertical: Spacing.two, gap: 4 },
  inlineInput: {
    fontSize: 16,
    paddingVertical: 4,
  },
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
  onChangeText,
  keyboardType,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChangeText: (val: string) => void;
  keyboardType?: 'default' | 'phone-pad' | 'email-address';
}) {
  const theme = useTheme();
  return (
    <View style={fieldStyles.inlineRow}>
      <ThemedText themeColor="textSecondary" style={fieldStyles.label}>{label}</ThemedText>
      <TextInput
        style={[fieldStyles.inlineInput, { color: theme.text }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={keyboardType === 'email-address' ? 'none' : 'words'}
        returnKeyType="done"
      />
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
      <View style={[memberStyles.avatar, { backgroundColor: theme.backgroundSelected }]}>
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
function SectionCard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={[cardStyles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>{children}</View>;
}

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error';

function Toast({ message, type }: { message: string; type: ToastType }) {
  return (
    <View style={toastStyles.overlay} pointerEvents="none">
      <View style={[toastStyles.pill, type === 'error' ? toastStyles.errorPill : toastStyles.successPill]}>
        <Ionicons
          name={type === 'success' ? 'checkmark-circle' : 'alert-circle-outline'}
          size={16}
          color="#fff"
        />
        <ThemedText style={toastStyles.text}>{message}</ThemedText>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 10,
  },
  successPill: { backgroundColor: '#0F6E5B' },
  errorPill:   { backgroundColor: '#93000A' },
  text: { fontSize: 14, fontWeight: '600', color: '#fff' },
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
  return <View style={{ height: 1, backgroundColor: theme.backgroundSelected, marginLeft: 0 }} />;
}

// ─── Edit Field Modal ─────────────────────────────────────────────────────────

function EditFieldModal({
  visible,
  label,
  value,
  multiline,
  keyboardType,
  onClose,
  onSave,
}: {
  visible: boolean;
  label: string;
  value: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  onClose: () => void;
  onSave: (val: string) => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState(value);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setText(value);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [visible, value]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={editModalStyles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={editModalStyles.kav} pointerEvents="box-none">
        <View style={[editModalStyles.sheet, { backgroundColor: theme.backgroundElement }]}>
          {/* Handle */}
          <View style={[editModalStyles.handle, { backgroundColor: theme.backgroundSelected }]} />

          <ThemedText style={editModalStyles.title}>Edit {label}</ThemedText>

          <TextInput
            ref={inputRef}
            style={[
              editModalStyles.input,
              { borderColor: theme.backgroundSelected, backgroundColor: theme.background, color: theme.text },
              multiline && editModalStyles.inputMulti,
            ]}
            value={text}
            onChangeText={setText}
            multiline={multiline}
            keyboardType={keyboardType ?? 'default'}
            autoCapitalize={keyboardType === 'email-address' ? 'none' : 'sentences'}
            returnKeyType={multiline ? 'default' : 'done'}
            placeholder={label}
            placeholderTextColor={theme.textSecondary}
          />

          <View style={editModalStyles.actions}>
            <Pressable style={[editModalStyles.cancelBtn, { backgroundColor: theme.backgroundSelected }]} onPress={onClose}>
              <ThemedText style={{ fontWeight: '600', color: theme.textSecondary }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={editModalStyles.saveBtn}
              onPress={() => { onSave(text); onClose(); }}>
              <ThemedText style={{ fontWeight: '700', color: '#fff' }}>Save</ThemedText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const editModalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.one,
  },
  title: { fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  cancelBtn: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: PRIMARY_GREEN,
  },
});

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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={mModalStyles.backdrop} onPress={onClose} />
      <View style={[mModalStyles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <View style={[mModalStyles.handle, { backgroundColor: theme.backgroundSelected }]} />
        <ThemedText style={mModalStyles.title}>{isEdit ? 'Edit Member' : 'Add Household Member'}</ThemedText>

        <ThemedText themeColor="textSecondary" style={mModalStyles.label}>Full Name</ThemedText>
        <TextInput
          style={[mModalStyles.input, { borderColor: theme.backgroundSelected, backgroundColor: theme.background, color: theme.text }]}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Juan Santos"
          placeholderTextColor={theme.textSecondary}
          returnKeyType="done"
        />

        <ThemedText themeColor="textSecondary" style={mModalStyles.label}>Relation</ThemedText>
        <OptionRow options={RELATIONS} value={relation} onChange={setRelation} />

        <ThemedText themeColor="textSecondary" style={[mModalStyles.label, { marginTop: Spacing.two }]}>Role</ThemedText>
        <OptionRow options={ROLES} value={role} onChange={setRole} />

        <View style={mModalStyles.actions}>
          {isEdit && onDelete && (
            <Pressable style={mModalStyles.deleteBtn} onPress={() => { onDelete(initial!.id); onClose(); }}>
              <ThemedText style={{ fontWeight: '700', color: '#93000A' }}>Remove</ThemedText>
            </Pressable>
          )}
          <Pressable
            style={[mModalStyles.saveBtn, !name.trim() && { opacity: 0.5 }]}
            disabled={!name.trim()}
            onPress={() => {
              onSave({ id: initial?.id ?? genId(), name: name.trim(), relation, role });
              onClose();
            }}>
            <ThemedText style={{ fontWeight: '700', color: '#fff' }}>{isEdit ? 'Update' : 'Add Member'}</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const mModalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center',
    width: 38, height: 4,
    borderRadius: 2,
    marginBottom: Spacing.one,
  },
  title: { fontSize: 16, fontWeight: '700' },
  label: { fontSize: 12, fontWeight: '600', marginBottom: -4 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  deleteBtn: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#93000A',
  },
  saveBtn: {
    flex: 2,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: PRIMARY_GREEN,
  },
});

function OptionRow({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two, flexDirection: 'row' }}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[
            mModalStyles.chip,
            { backgroundColor: theme.backgroundSelected, borderColor: theme.backgroundSelected },
            value === opt && { backgroundColor: PRIMARY_GREEN, borderColor: PRIMARY_GREEN },
          ]}>
          <ThemedText style={[mModalStyles.chipText, { color: theme.textSecondary }, value === opt && { color: '#fff' }]}>{opt}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── ID Type Modal ────────────────────────────────────────────────────────────

function IdTypeModal({
  visible,
  current,
  onClose,
  onSelect,
}: {
  visible: boolean;
  current: string | null;
  onClose: () => void;
  onSelect: (t: string) => void;
}) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={idModalStyles.backdrop} onPress={onClose} />
      <View style={[idModalStyles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <View style={[idModalStyles.handle, { backgroundColor: theme.backgroundSelected }]} />
        <ThemedText style={idModalStyles.title}>Select ID Type</ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          {ID_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => { onSelect(t); onClose(); }}
              style={[idModalStyles.optionRow, { borderBottomColor: theme.backgroundSelected }]}>
              <ThemedText style={[idModalStyles.optionText, current === t && { color: PRIMARY_GREEN, fontWeight: '700' }]}>{t}</ThemedText>
              {current === t && <Ionicons name="checkmark" size={18} color={PRIMARY_GREEN} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const idModalStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center',
    width: 38, height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: Spacing.two },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  optionText: { fontSize: 15 },
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
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={idModalStyles.backdrop} onPress={onClose} />
      <View style={[idModalStyles.sheet, { backgroundColor: theme.backgroundElement }]}>
        <View style={[idModalStyles.handle, { backgroundColor: theme.backgroundSelected }]} />
        <ThemedText style={idModalStyles.title}>{title}</ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          {options.map((opt) => (
            <Pressable
              key={opt}
              onPress={() => { onSelect(opt); onClose(); }}
              style={[idModalStyles.optionRow, { borderBottomColor: theme.backgroundSelected }]}>
              <ThemedText style={[idModalStyles.optionText, current === opt && { color: PRIMARY_GREEN, fontWeight: '700' }]}>
                {labels[opt]}
              </ThemedText>
              {current === opt && <Ionicons name="checkmark" size={18} color={PRIMARY_GREEN} />}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router   = useRouter();
  const { session } = useAuth();
  const { profile, isLoading, refetch } = useProfile();
  const insets   = useSafeAreaInsets();
  const theme    = useTheme();
  // Shadows the module-level PRIMARY_GREEN fallback with the resident's live accent color
  // (Settings > App Theme) for this render — theme.primary already resolves to it. Needed
  // specifically for the avatar circle + camera badge below, which otherwise read the
  // static module constant and never re-render on an accent change.
  const PRIMARY_GREEN = theme.primary;

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

  // ── Avatar ────────────────────────────────────────────────────────────────
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // ── Identification ────────────────────────────────────────────────────────
  const [idType, setIdType]                       = useState<string | null>(null);
  const [idPhotoUrls, setIdPhotoUrls]             = useState<string[]>([]);
  const [idUploading, setIdUploading]             = useState(false);
  // Tracks whether the user uploaded a new ID photo in this session so that
  // handleSave knows to (re-)set id_verification_status to 'pending'.
  const [newIdUploaded, setNewIdUploaded]         = useState(false);
  const [idVerificationStatus, setIdVerifStatus]  = useState<'pending' | 'verified' | null>(null);

  // Tracks whether the user changed their email address this session so
  // handleSave knows to reset email_verification_status (an edited email
  // is no longer the one that was verified).
  const [emailVerificationStatus, setEmailVerifStatus] = useState<string | null>(null);

  // ── Resolved signed URLs for ID photos ───────────────────────────────────
  // id-documents is a private bucket (government ID photos) — short-lived
  // signed URLs replace getPublicUrl() so a leaked/guessed path alone can't
  // serve the image.
  const [idPhotoPublicUrls, setIdPhotoPublicUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (idPhotoUrls.length === 0) {
      setIdPhotoPublicUrls([]);
      return;
    }
    supabase.storage
      .from('id-documents')
      .createSignedUrls(idPhotoUrls, 60 * 10) // 10 minutes — just long enough to render
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setIdPhotoPublicUrls([]);
          return;
        }
        setIdPhotoPublicUrls(data.map((d) => d.signedUrl).filter((u): u is string => !!u));
      });
    return () => {
      cancelled = true;
    };
  }, [idPhotoUrls]);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: ToastType } | null>(null);

  function showToast(message: string, type: ToastType = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  // Edit field modal — only for the fields NOT edited directly on the display form:
  // Occupation. (First/Middle/Last/Suffix, Email, House No./Street/City, and Mobile
  // Number are plain InlineFieldInput fields now; Birthday uses BirthdayCalendarModal
  // below.)
  const [editModal, setEditModal] = useState<{
    label: string;
    key: 'occupation';
    multiline?: boolean;
  } | null>(null);

  // Household member modal
  const [memberModal, setMemberModal] = useState<{ member: HouseholdMember | null } | null>(null);

  // ID type modal
  const [idTypeModal, setIdTypeModal] = useState(false);

  // Sex / Employment Status modals
  const [sexModal, setSexModal] = useState(false);
  const [employmentModal, setEmploymentModal] = useState(false);

  // ── Sync from profile ────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
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
    setAvatarUrl((profile as any).avatar_url ?? null);
    setEmailVerifStatus((profile as any).email_verification_status ?? null);
    setIdType((profile as any).id_type ?? null);
    setIdPhotoUrls((profile as any).id_photo_urls ?? []);
    setIdVerifStatus((profile as any).id_verification_status ?? null);
    setNewIdUploaded(false); // reset on every profile sync
    // Parse JSONB members array
    const raw = (profile as any).household_members;
    if (Array.isArray(raw)) {
      setMembers(raw as HouseholdMember[]);
    }
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
    const rawMembers = (profile as any).household_members;
    const profileMembersJson = JSON.stringify(Array.isArray(rawMembers) ? rawMembers : []);
    if (JSON.stringify(members) !== profileMembersJson) return true;
    // ID type
    if (idType !== ((profile as any).id_type ?? null)) return true;
    // New ID photo uploaded this session
    if (newIdUploaded) return true;
    return false;
  }, [
    profile, firstName, lastName, middleName, suffix, sex, email, houseNo, street, city,
    employmentStatus, occupation, mobileNumber, birthDateIso, members, idType, newIdUploaded,
  ]);

  // ── Edit-field helpers ────────────────────────────────────────────────────
  function currentEditValue() {
    if (!editModal) return '';
    if (editModal.key === 'occupation') return occupation;
    return '';
  }

  function applyEditSave(val: string) {
    if (!editModal) return;
    if (editModal.key === 'occupation') setOccupation(val);
  }

  // ── Avatar upload ─────────────────────────────────────────────────────────
  // Saves immediately — independent of the "Save Changes" batch — so the
  // resident sees their new photo reflected in the app right away without
  // having to scroll down and tap the CTA.
  async function handleAvatarUpload() {
    if (!session) return;

    const picked = await pickImageAsset();
    if (!picked) return;

    setAvatarUploading(true);
    try {
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
        .update({ avatar_url: publicUrl } as any)
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
      setAvatarUploading(false);
    }
  }

  // ── ID photo upload ───────────────────────────────────────────────────────
  async function handleIdUpload() {
    if (!session) return;
    const picked = await pickImageAsset();
    if (!picked) return;

    setIdUploading(true);
    try {
      const bytes = await readImageBytes(picked);
      const ext   = imageExtension(picked.mimeType);
      // Single canonical path per resident (mirrors the avatar upload below) —
      // upsert:true overwrites the previous ID photo in storage so re-uploading
      // replaces it instead of accumulating extra files/entries. Previously this
      // used a timestamped filename with upsert:false and appended to the list,
      // so every re-upload left the old photo(s) in place.
      const path  = `${session.user.id}/id.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('id-documents')
        .upload(path, bytes, { contentType: picked.mimeType, upsert: true });
      if (uploadErr) throw uploadErr;
      setIdPhotoUrls([path]);
      // Any new ID upload must be re-verified by an admin, even if previously 'verified'.
      setNewIdUploaded(true);
    } catch (e: unknown) {
      Alert.alert('Upload Failed', e instanceof Error ? e.message : 'Could not upload ID photo.');
    } finally {
      setIdUploading(false);
    }
  }

  // ── Save all changes ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!session || !isDirty) return;

    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    setSaving(true);

    // ── ID verification status logic ────────────────────────────────────────
    // • New ID photo uploaded this session → always reset to 'pending'
    //   (forces admin re-review even if previously 'verified').
    // • ID type set + photo present + no prior status → first-time: 'pending'.
    // • Otherwise keep the existing status unchanged (don't overwrite 'verified').
    let nextIdStatus: 'pending' | 'verified' | null = idVerificationStatus;
    if (newIdUploaded) {
      nextIdStatus = 'pending';
    } else if (!idVerificationStatus && idType && idPhotoUrls.length > 0) {
      nextIdStatus = 'pending';
    }

    // Editing the email address invalidates whatever verification was
    // previously recorded for the old address — clear it so the "Verified
    // Resident" badge doesn't keep showing for an address nobody confirmed.
    const emailChanged = email.trim() !== (profile?.email ?? '');
    const nextEmailStatus = emailChanged ? null : emailVerificationStatus;

    const { error: updateErr } = await supabase
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
        city:                     city.trim() || null,
        employment_status:        employmentStatus,
        occupation:               occupation.trim() || null,
        birth_date:               birthDateIso,
        household_members:        members as any,
        id_type:                  idType || null,
        id_photo_urls:            idPhotoUrls,
        id_verification_status:   nextIdStatus,
        email_verification_status: nextEmailStatus,
      } as any)
      .eq('id', session.user.id);

    setSaving(false);

    if (updateErr) {
      setSaving(false);
      showToast(updateErr.message, 'error');
      return;
    }
    // Reflect the computed status locally right away so the badge updates
    // before the next refetch resolves.
    setIdVerifStatus(nextIdStatus);
    setEmailVerifStatus(nextEmailStatus);
    setNewIdUploaded(false);
    setSaving(false);
    showToast('Profile saved successfully ✓');
    refetch();
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!session) return <GuestPrompt label="Log in to see your profile." />;
  if (isLoading) return <PlaceholderPanel label="Loading profile…" />;

  const isVerified  = emailVerificationStatus === 'verified';
  const hasIdPhoto  = idPhotoUrls.length > 0;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>

      {/* ── ① Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={Spacing.two}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Profile
          </ThemedText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">

        {/* ── ② Avatar ────────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          {/*
           * Layout fix — camera badge overlap:
           *   avatarOuter (110 × 110, relative) contains:
           *     avatarCircle (96 × 96, absolute at top:0 left:7, overflow:hidden)
           *     cameraBadge  (30 × 30, absolute at bottom:0 right:0)
           *
           *   The badge corner sits at (110-30, 110-30) = (80, 80), which is
           *   inside the 96 × 96 circle area — giving the classic overlapping
           *   edit-photo badge look — but since the badge is a SIBLING of the
           *   circle (not a child), overflow:hidden on the circle does not clip
           *   it. Rendered after the circle, it always paints on top.
           */}
          <Pressable
            onPress={handleAvatarUpload}
            disabled={avatarUploading}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            hitSlop={8}>

            <View style={styles.avatarOuter}>
              {/* Circle — photo or initials + upload spinner */}
              <View style={[styles.avatarCircle, { backgroundColor: PRIMARY_GREEN }]}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <ThemedText style={styles.avatarInitials}>
                    {getInitials((liveFullName || session.user.email?.split('@')[0]) ?? '?')}
                  </ThemedText>
                )}

                {avatarUploading && (
                  <View style={styles.avatarSpinnerOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </View>

              {/* Camera badge — sibling of circle, paints on top */}
              <View style={[styles.cameraBadge, { backgroundColor: PRIMARY_GREEN }]}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={13} color="#fff" />}
              </View>
            </View>
          </Pressable>

          {/* ③ Name + badge */}
          <ThemedText style={styles.nameText}>{liveFullName || '—'}</ThemedText>
          {isVerified && <VerifiedBadge />}
        </View>

        {/* ── ④ Personal Information ────────────────────────────────────── */}
        <SectionCard>
          <ThemedText style={styles.sectionTitle}>Personal Information</ThemedText>

          <InlineFieldInput label="First Name" value={firstName} placeholder="Enter first name" onChangeText={setFirstName} />
          <Divider />
          <InlineFieldInput label="Last Name" value={lastName} placeholder="Enter last name" onChangeText={setLastName} />
          <Divider />
          <InlineFieldInput label="Middle Name" value={middleName} placeholder="Optional" onChangeText={setMiddleName} />
          <Divider />
          <InlineFieldInput label="Suffix" value={suffix} placeholder="Optional — e.g. Jr., III" onChangeText={setSuffix} />
          <Divider />
          <FieldRow
            label="Sex"
            value={sex ? SEX_LABELS[sex] : ''}
            placeholder="Select sex"
            onEdit={() => setSexModal(true)}
          />
          <Divider />
          <InlineFieldInput label="Email" value={email} placeholder="Enter email address" onChangeText={setEmail} keyboardType="email-address" />
          <Divider />
          <InlineFieldInput label="House No." value={houseNo} placeholder="Enter house/unit number" onChangeText={setHouseNo} />
          <Divider />
          <InlineFieldInput label="Street" value={street} placeholder="Enter street" onChangeText={setStreet} />
          <Divider />
          <InlineFieldInput label="City" value={city} placeholder="Enter city/municipality" onChangeText={setCity} />
          <Divider />
          {/* Read-only — this is profiles.barangay_id, assigned automatically at
              registration (AGENTS.md §0), not a free-text address component. */}
          <View style={fieldStyles.row}>
            <View style={fieldStyles.body}>
              <ThemedText style={fieldStyles.label}>Barangay</ThemedText>
              <ThemedText style={fieldStyles.value}>{profile?.barangays?.name ?? '—'}</ThemedText>
            </View>
          </View>
          <Divider />
          <InlineFieldInput
            label="Mobile Number"
            value={mobileNumber}
            placeholder="e.g. +63 917 123 4567"
            onChangeText={setMobile}
            keyboardType="phone-pad"
          />
          <Divider />
          <FieldRow
            label="Employment Status"
            value={employmentStatus ? EMPLOYMENT_STATUS_LABELS[employmentStatus] : ''}
            placeholder="Select employment status"
            onEdit={() => setEmploymentModal(true)}
          />
          {employmentStatus && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus) ? (
            <>
              <Divider />
              <FieldRow
                label="Occupation"
                value={occupation}
                placeholder="Optional"
                onEdit={() => setEditModal({ label: 'Occupation', key: 'occupation' })}
              />
            </>
          ) : null}
          <Divider />
          <FieldRow
            label="Birthday"
            value={fmtDate(birthDateIso)}
            placeholder="Select your birthday"
            onEdit={() => setShowBirthPicker(true)}
          />
        </SectionCard>

        {/* ── ⑤ Household Information ──────────────────────────────────── */}
        <SectionCard>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Household Information</ThemedText>
            <Pressable
              onPress={() => setMemberModal({ member: null })}
              accessibilityRole="button"
              accessibilityLabel="Add household member">
              <ThemedText style={styles.addLink}>Add Member</ThemedText>
            </Pressable>
          </View>

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

        {/* ── ⑥ Identification ─────────────────────────────────────────── */}
        <SectionCard>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={styles.sectionTitle}>Identification</ThemedText>
            {idVerificationStatus === 'verified' && (
              <View style={idStatusStyles.verified}>
                <Ionicons name="checkmark-circle" size={13} color={PRIMARY_GREEN} />
                <ThemedText style={idStatusStyles.verifiedText}>Verified ID</ThemedText>
              </View>
            )}
            {idVerificationStatus === 'pending' && (
              <View style={idStatusStyles.pending}>
                <Ionicons name="time-outline" size={13} color="#B45309" />
                <ThemedText style={idStatusStyles.pendingText}>Pending Verification</ThemedText>
              </View>
            )}
          </View>

          {/* ID Type */}
          <Pressable
            style={fieldStyles.row}
            onPress={() => setIdTypeModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Select ID type">
            <View style={[fieldStyles.body, { flexDirection: 'row', alignItems: 'center', gap: Spacing.two }]}>
              <Ionicons name="card-outline" size={22} color={theme.text} />
              <ThemedText style={[fieldStyles.value, !idType && { color: theme.textSecondary }]}>
                {idType ?? 'Select ID Type'}
              </ThemedText>
            </View>
            <Ionicons name="create-outline" size={18} color={PRIMARY_GREEN} />
          </Pressable>

          {/* ID photo preview — full-width, 16:10 aspect, no scroll if single photo */}
          {idPhotoPublicUrls.length > 0 && (
            idPhotoPublicUrls.length === 1 ? (
              <View style={[styles.idPhotoWrap, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundSelected }]}>
                <Image
                  source={{ uri: idPhotoPublicUrls[0] }}
                  style={styles.idPhoto}
                  contentFit="cover"
                  transition={200}
                />
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.idPhotoScroll}>
                {idPhotoPublicUrls.map((url, i) => (
                  <View key={i} style={[styles.idPhotoWrap, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundSelected, width: 220, marginRight: Spacing.two }]}>
                    <Image source={{ uri: url }} style={styles.idPhoto} contentFit="cover" transition={200} />
                  </View>
                ))}
              </ScrollView>
            )
          )}

          {/* Re-upload button */}
          <Pressable
            style={[styles.reuploadBtn, { borderColor: theme.backgroundSelected }]}
            onPress={handleIdUpload}
            disabled={idUploading}
            accessibilityRole="button">
            {idUploading
              ? <ActivityIndicator size="small" color={PRIMARY_GREEN} />
              : <>
                  <Ionicons name="cloud-upload-outline" size={16} color={theme.text} />
                  <ThemedText style={styles.reuploadText}>
                    {hasIdPhoto ? 'Re-upload Document' : 'Upload ID Document'}
                  </ThemedText>
                </>
            }
          </Pressable>
        </SectionCard>

      </ScrollView>

      {/* ── ⑦ Fixed Save button ──────────────────────────────────────────── */}
      <View style={[styles.saveBar, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected, paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          onPress={handleSave}
          disabled={!isDirty || saving}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          style={[styles.saveBtn, (!isDirty || saving) && { backgroundColor: theme.backgroundSelected }]}>
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <ThemedText style={styles.saveBtnText}>Save Changes</ThemedText>}
        </Pressable>
      </View>

      {/* ── Centered toast ────────────────────────────────────────────────── */}
      {toast && <Toast message={toast.message} type={toast.type} />}

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <EditFieldModal
        visible={!!editModal}
        label={editModal?.label ?? ''}
        value={currentEditValue()}
        multiline={editModal?.multiline}
        onClose={() => setEditModal(null)}
        onSave={applyEditSave}
      />

      <BirthdayCalendarModal
        visible={showBirthPicker}
        value={birthDateIso ? isoToLocalDate(birthDateIso) : null}
        onClose={() => setShowBirthPicker(false)}
        onSave={(date) => {
          setBirthDateIso(dateToIso(date));
          setShowBirthPicker(false);
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

      <IdTypeModal
        visible={idTypeModal}
        current={idType}
        onClose={() => setIdTypeModal(false)}
        onSelect={(t) => setIdType(t)}
      />

      <ChoiceListModal
        visible={sexModal}
        title="Select Sex"
        options={SEXES}
        labels={SEX_LABELS}
        current={sex}
        onClose={() => setSexModal(false)}
        onSelect={(v) => setSex(v)}
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
        }}
      />
    </View>
    </SafeAreaView>
  );
}

// ─── ID status badge styles ────────────────────────────────────────────────────

const idStatusStyles = StyleSheet.create({
  verified: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY_GREEN + '1E',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verifiedText: { fontSize: 11, fontWeight: '600', color: PRIMARY_GREEN },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF3C7',
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pendingText: { fontSize: 11, fontWeight: '600', color: '#B45309' },
});

// ─── Screen styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },

  /* Header */
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
    width: 44, height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },

  /* Avatar */
  avatarSection: {
    alignItems: 'center',
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
    gap: Spacing.two,
  },
  // Outer container — explicit 110 × 110 so the badge can sit at its corner
  // without being clipped by the 96 × 96 circle's overflow:hidden.
  avatarOuter: {
    width: 110,
    height: 110,
    position: 'relative',
  },
  avatarCircle: {
    position: 'absolute',
    top: 0,
    left: 7,              // centre the 96 px circle inside the 110 px outer: (110-96)/2 = 7
    width: 96, height: 96,
    borderRadius: 48,
    // backgroundColor applied inline in ProfileScreen with the live accent color.
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',   // clips photo + spinner to the circle shape
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarInitials: { fontSize: 32, fontWeight: '700', color: '#fff', lineHeight: 40 },
  avatarImage: { width: 96, height: 96 },
  avatarSpinnerOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Badge sits at the bottom-right corner of avatarOuter.
  // It is a SIBLING (not child) of avatarCircle → overflow:hidden never clips it.
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 30, height: 30,
    borderRadius: 15,
    // backgroundColor applied inline in ProfileScreen with the live accent color.
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  nameText: { fontSize: 22, fontWeight: '700', textAlign: 'center' },

  /* Content */
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three },

  /* Section headers */
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: Spacing.one },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  addLink: { fontSize: 13, fontWeight: '600', color: PRIMARY_GREEN },

  /* Household empty */
  emptyHousehold: { fontSize: 14, paddingVertical: Spacing.three, textAlign: 'center' },

  /* ID photo — full-width frame with 16:10 aspect ratio */
  idPhotoScroll: { marginTop: Spacing.two },
  idPhotoWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.two,
    borderWidth: 1,
  },
  idPhoto: { width: '100%', height: '100%' },

  /* Re-upload */
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: 24,
    paddingVertical: 13,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  reuploadText: { fontSize: 14, fontWeight: '600' },

  /* Fixed save bar */
  saveBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
  },
  saveBtn: {
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY_GREEN,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
