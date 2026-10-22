import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScanFamilySheet } from '@/components/drrm/scan-family-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'];
const ROLES = ['Head of Family', 'Student', 'Employed', 'Unemployed', 'Retired', 'Minor'];
export type ProfileHouseholdMemberInput = { id?: string; name: string; relation: string; role: string };

export function FamilyMemberModal({ visible, initial, onClose, onSave, onDelete, saveError, needsReload = false, onReload }: {
  visible: boolean; initial: ProfileHouseholdMemberInput | null; onClose: () => void;
  onSave: (member: ProfileHouseholdMemberInput) => Promise<boolean>; onDelete: (id: string) => Promise<boolean>;
  saveError?: string | null; needsReload?: boolean; onReload?: () => void;
}) {
  const { resident } = useTheme();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [role, setRole] = useState(ROLES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  useEffect(() => {
    generation.current += 1;
    if (visible) {
      setName(initial?.name ?? ''); setRelation(initial?.relation || RELATIONS[0]); setRole(initial?.role || ROLES[0]);
      setBusy(false); lock.current = false; setError(null); setConfirmRemove(false);
    }
    return () => { generation.current += 1; };
  }, [visible, initial]);
  async function submit(remove = false) {
    if (lock.current || needsReload || !name.trim() || name.trim().length > 200) return;
    lock.current = true; setBusy(true); setError(null);
    const ticket = generation.current;
    try {
      const ok = remove && initial?.id ? await onDelete(initial.id) : await onSave({ id: initial?.id, name: name.trim(), relation, role });
      if (ticket !== generation.current) return;
      if (ok) onClose();
      else setError(remove ? 'Could not confirm removal. Refresh your family information and try again.' : 'Could not save this member. Your input is retained. Try again.');
    } catch { if (ticket === generation.current) setError('Could not save your changes. Reconnect and try again.'); }
    finally { if (ticket === generation.current) { lock.current = false; setBusy(false); } }
  }
  const footer = <>
    {saveError || error ? <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>{saveError || error}</ThemedText> : null}
    {needsReload ? <PrimaryButton presentation="resident" compact label="Reload family list" onPress={() => onReload?.()} /> : confirmRemove ? <>
      <ThemedText style={{ color: resident.text }}>Remove {initial?.name} from your household?</ThemedText>
      <PrimaryButton presentation="resident" compact variant="destructive" label="Confirm Remove" loading={busy} onPress={() => submit(true)} />
      <PrimaryButton presentation="resident" compact variant="secondary" label="Keep Member" disabled={busy} onPress={() => setConfirmRemove(false)} />
    </> : <View style={styles.actions}>
      {initial?.id ? <View style={styles.remove}><PrimaryButton presentation="resident" compact variant="destructive" label="Remove" disabled={busy} onPress={() => setConfirmRemove(true)} /></View> : null}
      <View style={styles.save}><PrimaryButton presentation="resident" compact label={initial ? 'Update' : 'Add Member'} loading={busy} disabled={!name.trim() || name.trim().length > 200} onPress={() => submit()} /></View>
    </View>}
  </>;
  return <ScanFamilySheet visible={visible} title={initial ? 'Edit Family Member' : 'Add Family Member'} onClose={onClose} busy={busy} footer={footer}>
    <TextField presentation="resident" label="Full Name" accessibilityLabel="Full Name" placeholder="Enter full name" value={name} onChangeText={setName} maxLength={200} editable={!busy} returnKeyType="done" />
    <Choices label="Relation" options={RELATIONS} value={relation} onChange={setRelation} disabled={busy} />
    <Choices label="Role" options={ROLES} value={role} onChange={setRole} disabled={busy} />
  </ScanFamilySheet>;
}

function Choices({ label, options, value, onChange, disabled }: { label: string; options: string[]; value: string; onChange: (value: string) => void; disabled: boolean }) {
  const { resident } = useTheme();
  const choices = options.includes(value) ? options : [value, ...options];
  return <View style={{ gap: 6 }}><ThemedText style={{ color: resident.muted, fontSize: 13, fontWeight: '600' }}>{label}</ThemedText>
    <ScrollableChevronRow label={label.toLowerCase()} contentContainerStyle={{ gap: 8 }}>
      {choices.map(option => <Pressable key={option} disabled={disabled} onPress={() => onChange(option)} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ selected: option === value, disabled }}
        style={[styles.chip, { backgroundColor: option === value ? resident.accent : resident.surface, borderColor: option === value ? resident.accentText : resident.border }]}>
        <ThemedText style={{ color: option === value ? resident.onAccent : resident.muted, fontSize: 13, fontWeight: '600' }}>{option}</ThemedText>
      </Pressable>)}
    </ScrollableChevronRow>
  </View>;
}
const styles = StyleSheet.create({ actions: { flexDirection: 'row', gap: 8 }, remove: { flex: 1 }, save: { flex: 2 }, chip: { minHeight: 44, justifyContent: 'center', borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 } });
