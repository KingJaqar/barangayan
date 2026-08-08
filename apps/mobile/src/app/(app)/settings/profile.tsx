/**
 * Resident Profile screen — pixel-accurate rebuild of the design file.
 *
 * Sections
 *  ① Header            — green bar, back chevron, "Profile" title
 *  ② Avatar            — real photo (expo-image) when avatar_url set; initials fallback
 *                        Tap anywhere on the circle or the pencil badge to re-upload.
 *                        Saved immediately (independent of the Save Changes button).
 *  ③ Verified badge    — shows when email_verification_status = 'verified'
 *  ④ Personal Info     — Full Name, Address, Mobile, Birthday (each inline-editable)
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuestPrompt } from '@/components/guest-prompt';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
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

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** YYYY-MM-DD → "August 8, 2000" */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d, 12);
  return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** "August 8, 2000" or "2000-08-08" → "2000-08-08" (best-effort) */
function parseToIso(raw: string): string | null {
  raw = raw.trim();
  if (!raw) return null;
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Attempt locale parse
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${day}`;
  }
  return null;
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
  return (
    <Pressable style={fieldStyles.row} onPress={onEdit} accessibilityRole="button" accessibilityLabel={`Edit ${label}`}>
      <View style={fieldStyles.body}>
        <ThemedText style={fieldStyles.label}>{label}</ThemedText>
        <ThemedText style={[fieldStyles.value, !value && fieldStyles.placeholder]}>
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
  label: { fontSize: 12, color: '#60646C', fontWeight: '500' },
  value: { fontSize: 16, color: '#111111' },
  placeholder: { color: '#B0B4BA' },
});

/** Household member list item */
function MemberRow({
  member,
  onPress,
}: {
  member: HouseholdMember;
  onPress: () => void;
}) {
  return (
    <Pressable style={memberStyles.row} onPress={onPress} accessibilityRole="button">
      <View style={memberStyles.avatar}>
        <ThemedText style={memberStyles.initials}>{getInitials(member.name)}</ThemedText>
      </View>
      <View style={memberStyles.info}>
        <ThemedText style={memberStyles.name}>{member.name}</ThemedText>
        <ThemedText style={memberStyles.sub}>
          {member.relation} · {member.role}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#B0B4BA" />
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
    backgroundColor: '#E8E8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: { fontSize: 14, fontWeight: '700', color: '#60646C' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: 14, fontWeight: '600', color: '#111111' },
  sub: { fontSize: 12, color: '#60646C' },
});

/** Section card wrapper */
function SectionCard({ children }: { children: React.ReactNode }) {
  return <View style={cardStyles.card}>{children}</View>;
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
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    paddingHorizontal: Spacing.three,
    paddingVertical: 4,
    gap: 0,
  },
});

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#E8E8EC', marginLeft: 0 }} />;
}

// ─── Edit Field Modal ─────────────────────────────────────────────────────────

function EditFieldModal({
  visible,
  label,
  value,
  multiline,
  onClose,
  onSave,
}: {
  visible: boolean;
  label: string;
  value: string;
  multiline?: boolean;
  onClose: () => void;
  onSave: (val: string) => void;
}) {
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
        <View style={editModalStyles.sheet}>
          {/* Handle */}
          <View style={editModalStyles.handle} />

          <ThemedText style={editModalStyles.title}>Edit {label}</ThemedText>

          <TextInput
            ref={inputRef}
            style={[editModalStyles.input, multiline && editModalStyles.inputMulti]}
            value={text}
            onChangeText={setText}
            multiline={multiline}
            returnKeyType={multiline ? 'default' : 'done'}
            placeholder={label}
            placeholderTextColor="#B0B4BA"
          />

          <View style={editModalStyles.actions}>
            <Pressable style={editModalStyles.cancelBtn} onPress={onClose}>
              <ThemedText style={{ fontWeight: '600', color: '#60646C' }}>Cancel</ThemedText>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#E0E1E6',
    marginBottom: Spacing.one,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111111' },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E1E6',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    fontSize: 16,
    color: '#111111',
    backgroundColor: '#F6F6F6',
  },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', gap: Spacing.two },
  cancelBtn: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    backgroundColor: '#F0F0F3',
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

  const OptionRow = ({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two, flexDirection: 'row' }}>
      {options.map((opt) => (
        <Pressable
          key={opt}
          onPress={() => onChange(opt)}
          style={[
            mModalStyles.chip,
            value === opt && { backgroundColor: PRIMARY_GREEN },
          ]}>
          <ThemedText style={[mModalStyles.chipText, value === opt && { color: '#fff' }]}>{opt}</ThemedText>
        </Pressable>
      ))}
    </ScrollView>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={mModalStyles.backdrop} onPress={onClose} />
      <View style={mModalStyles.sheet}>
        <View style={mModalStyles.handle} />
        <ThemedText style={mModalStyles.title}>{isEdit ? 'Edit Member' : 'Add Household Member'}</ThemedText>

        <ThemedText style={mModalStyles.label}>Full Name</ThemedText>
        <TextInput
          style={mModalStyles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Juan Santos"
          placeholderTextColor="#B0B4BA"
          returnKeyType="done"
        />

        <ThemedText style={mModalStyles.label}>Relation</ThemedText>
        <OptionRow options={RELATIONS} value={relation} onChange={setRelation} />

        <ThemedText style={[mModalStyles.label, { marginTop: Spacing.two }]}>Role</ThemedText>
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
    backgroundColor: '#fff',
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
    backgroundColor: '#E0E1E6',
    marginBottom: Spacing.one,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111111' },
  label: { fontSize: 12, fontWeight: '600', color: '#60646C', marginBottom: -4 },
  input: {
    borderWidth: 1.5,
    borderColor: '#E0E1E6',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 15,
    color: '#111111',
    backgroundColor: '#F6F6F6',
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F0F0F3',
    borderWidth: 1,
    borderColor: '#E0E1E6',
  },
  chipText: { fontSize: 13, fontWeight: '600', color: '#60646C' },
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={idModalStyles.backdrop} onPress={onClose} />
      <View style={idModalStyles.sheet}>
        <View style={idModalStyles.handle} />
        <ThemedText style={idModalStyles.title}>Select ID Type</ThemedText>
        <ScrollView showsVerticalScrollIndicator={false}>
          {ID_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => { onSelect(t); onClose(); }}
              style={idModalStyles.optionRow}>
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    paddingBottom: 40,
  },
  handle: {
    alignSelf: 'center',
    width: 38, height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E1E6',
    marginBottom: Spacing.two,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#111111', marginBottom: Spacing.two },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F3',
  },
  optionText: { fontSize: 15, color: '#111111' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router   = useRouter();
  const { session } = useAuth();
  const { profile, isLoading, refetch } = useProfile();
  const insets   = useSafeAreaInsets();

  // ── Personal info fields ──────────────────────────────────────────────────
  const [fullName, setFullName]       = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [mobileNumber, setMobile]     = useState('');
  const [birthDateRaw, setBirthDate]  = useState('');  // displayed as formatted, stored as ISO

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

  // ── Resolved public URLs for ID photos ───────────────────────────────────
  // Resolved once (in a memo) so we never call getPublicUrl() inside render.
  const idPhotoPublicUrls = useMemo(
    () =>
      idPhotoUrls.map((path) => {
        const { data } = supabase.storage.from('id-documents').getPublicUrl(path);
        return data.publicUrl;
      }),
    [idPhotoUrls],
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [saving, setSaving]   = useState(false);
  const [toast, setToast]     = useState<{ message: string; type: ToastType } | null>(null);

  function showToast(message: string, type: ToastType = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2800);
  }

  // Edit field modal
  const [editModal, setEditModal] = useState<{
    label: string; key: 'fullName' | 'homeAddress' | 'mobileNumber' | 'birthDate'; multiline?: boolean;
  } | null>(null);

  // Household member modal
  const [memberModal, setMemberModal] = useState<{ member: HouseholdMember | null } | null>(null);

  // ID type modal
  const [idTypeModal, setIdTypeModal] = useState(false);

  // ── Sync from profile ────────────────────────────────────────────────────
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? '');
    setMobile(profile.mobile_number ?? '');
    setHomeAddress(profile.home_address ?? '');
    setBirthDate(profile.birth_date ? fmtDate(profile.birth_date) : '');
    setAvatarUrl((profile as any).avatar_url ?? null);
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
    if (fullName     !== (profile.full_name    ?? ''))  return true;
    if (homeAddress  !== (profile.home_address ?? ''))  return true;
    if (mobileNumber !== (profile.mobile_number ?? '')) return true;
    const profileDateFmt = profile.birth_date ? fmtDate(profile.birth_date) : '';
    if (birthDateRaw !== profileDateFmt)                return true;
    // Household comparison — stringify for deep equality
    const rawMembers = (profile as any).household_members;
    const profileMembersJson = JSON.stringify(Array.isArray(rawMembers) ? rawMembers : []);
    if (JSON.stringify(members) !== profileMembersJson) return true;
    // ID type
    if (idType !== ((profile as any).id_type ?? null)) return true;
    // New ID photo uploaded this session
    if (newIdUploaded) return true;
    return false;
  }, [profile, fullName, homeAddress, mobileNumber, birthDateRaw, members, idType, newIdUploaded]);

  // ── Edit-field helpers ────────────────────────────────────────────────────
  function currentEditValue() {
    if (!editModal) return '';
    if (editModal.key === 'fullName')     return fullName;
    if (editModal.key === 'homeAddress')  return homeAddress;
    if (editModal.key === 'mobileNumber') return mobileNumber;
    if (editModal.key === 'birthDate')    return birthDateRaw;
    return '';
  }

  function applyEditSave(val: string) {
    if (!editModal) return;
    if (editModal.key === 'fullName')     setFullName(val);
    if (editModal.key === 'homeAddress')  setHomeAddress(val);
    if (editModal.key === 'mobileNumber') setMobile(val);
    if (editModal.key === 'birthDate')    setBirthDate(val);
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
      const path  = `${session.user.id}/id_${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('id-documents')
        .upload(path, bytes, { contentType: picked.mimeType, upsert: false });
      if (uploadErr) throw uploadErr;
      setIdPhotoUrls((prev) => [...prev, path]);
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
    setSaving(true);

    const isoBirth = parseToIso(birthDateRaw);

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

    const { error: updateErr } = await supabase
      .from('profiles')
      .update({
        full_name:              fullName.trim() || null,
        mobile_number:          mobileNumber.trim() || null,
        home_address:           homeAddress.trim() || null,
        birth_date:             isoBirth,
        household_members:      members as any,
        id_type:                idType || null,
        id_photo_urls:          idPhotoUrls,
        id_verification_status: nextIdStatus,
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
    setNewIdUploaded(false);
    setSaving(false);
    showToast('Profile saved successfully ✓');
    refetch();
  }

  // ── Guards ────────────────────────────────────────────────────────────────
  if (!session) return <GuestPrompt label="Log in to see your profile." />;
  if (isLoading) return <PlaceholderPanel label="Loading profile…" />;

  const isVerified  = (profile as any)?.email_verification_status === 'verified';
  const hasIdPhoto  = idPhotoUrls.length > 0;

  return (
    <View style={styles.screen}>

      {/* ── ① Header ──────────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.two, backgroundColor: PRIMARY_GREEN }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={Spacing.two}>
          <Ionicons name="chevron-back" size={26} color="#fff" />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Profile</ThemedText>
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
              <View style={styles.avatarCircle}>
                {avatarUrl ? (
                  <Image
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ) : (
                  <ThemedText style={styles.avatarInitials}>
                    {getInitials((fullName || session.user.email?.split('@')[0]) ?? '?')}
                  </ThemedText>
                )}

                {avatarUploading && (
                  <View style={styles.avatarSpinnerOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                  </View>
                )}
              </View>

              {/* Camera badge — sibling of circle, paints on top */}
              <View style={styles.cameraBadge}>
                {avatarUploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={13} color="#fff" />}
              </View>
            </View>
          </Pressable>

          {/* ③ Name + badge */}
          <ThemedText style={styles.nameText}>{fullName || '—'}</ThemedText>
          {isVerified && <VerifiedBadge />}
        </View>

        {/* ── ④ Personal Information ────────────────────────────────────── */}
        <SectionCard>
          <ThemedText style={styles.sectionTitle}>Personal Information</ThemedText>

          <FieldRow
            label="Full Name"
            value={fullName}
            placeholder="Enter full name"
            onEdit={() => setEditModal({ label: 'Full Name', key: 'fullName' })}
          />
          <Divider />
          <FieldRow
            label="Address"
            value={homeAddress}
            placeholder="Enter home address"
            onEdit={() => setEditModal({ label: 'Home Address', key: 'homeAddress', multiline: true })}
          />
          <Divider />
          <FieldRow
            label="Mobile Number"
            value={mobileNumber}
            placeholder="e.g. +63 917 123 4567"
            onEdit={() => setEditModal({ label: 'Mobile Number', key: 'mobileNumber' })}
          />
          <Divider />
          <FieldRow
            label="Birthday"
            value={birthDateRaw}
            placeholder="e.g. January 1, 2000"
            onEdit={() => setEditModal({ label: 'Birthday', key: 'birthDate' })}
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
            <ThemedText style={styles.emptyHousehold}>No household members added yet.</ThemedText>
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
              <Ionicons name="card-outline" size={22} color="#111111" />
              <ThemedText style={[fieldStyles.value, !idType && fieldStyles.placeholder]}>
                {idType ?? 'Select ID Type'}
              </ThemedText>
            </View>
            <Ionicons name="create-outline" size={18} color={PRIMARY_GREEN} />
          </Pressable>

          {/* ID photo preview — full-width, 16:10 aspect, no scroll if single photo */}
          {idPhotoPublicUrls.length > 0 && (
            idPhotoPublicUrls.length === 1 ? (
              <View style={styles.idPhotoWrap}>
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
                  <View key={i} style={[styles.idPhotoWrap, { width: 220, marginRight: Spacing.two }]}>
                    <Image source={{ uri: url }} style={styles.idPhoto} contentFit="cover" transition={200} />
                  </View>
                ))}
              </ScrollView>
            )
          )}

          {/* Re-upload button */}
          <Pressable
            style={styles.reuploadBtn}
            onPress={handleIdUpload}
            disabled={idUploading}
            accessibilityRole="button">
            {idUploading
              ? <ActivityIndicator size="small" color={PRIMARY_GREEN} />
              : <>
                  <Ionicons name="cloud-upload-outline" size={16} color="#111111" />
                  <ThemedText style={styles.reuploadText}>
                    {hasIdPhoto ? 'Re-upload Document' : 'Upload ID Document'}
                  </ThemedText>
                </>
            }
          </Pressable>
        </SectionCard>

      </ScrollView>

      {/* ── ⑦ Fixed Save button ──────────────────────────────────────────── */}
      <View style={[styles.saveBar, { paddingBottom: insets.bottom + Spacing.three }]}>
        <Pressable
          onPress={handleSave}
          disabled={!isDirty || saving}
          accessibilityRole="button"
          accessibilityLabel="Save changes"
          style={[styles.saveBtn, (!isDirty || saving) && styles.saveBtnDisabled]}>
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
    </View>
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
  screen: { flex: 1, backgroundColor: '#F6F6F6' },

  /* Header */
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 60,
    position: 'relative',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44, height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#fff', lineHeight: 28 },

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
    backgroundColor: PRIMARY_GREEN,
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
    backgroundColor: PRIMARY_GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  nameText: { fontSize: 22, fontWeight: '700', color: '#111111', textAlign: 'center' },

  /* Content */
  content: { paddingHorizontal: Spacing.three, gap: Spacing.three },

  /* Section headers */
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#111111', marginBottom: Spacing.one },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  addLink: { fontSize: 13, fontWeight: '600', color: PRIMARY_GREEN },

  /* Household empty */
  emptyHousehold: { fontSize: 14, color: '#B0B4BA', paddingVertical: Spacing.three, textAlign: 'center' },

  /* ID photo — full-width frame with 16:10 aspect ratio */
  idPhotoScroll: { marginTop: Spacing.two },
  idPhotoWrap: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: Spacing.two,
    borderWidth: 1,
    borderColor: '#E0E1E6',
    backgroundColor: '#F0F0F3',
  },
  idPhoto: { width: '100%', height: '100%' },

  /* Re-upload */
  reuploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderColor: '#C0C0C8',
    borderRadius: 24,
    paddingVertical: 13,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  reuploadText: { fontSize: 14, fontWeight: '600', color: '#111111' },

  /* Fixed save bar */
  saveBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E8E8EC',
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
  saveBtnDisabled: {
    backgroundColor: '#B0B4BA',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
