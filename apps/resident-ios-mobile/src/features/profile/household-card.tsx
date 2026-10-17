import type { Json } from '@barangayan/shared';
import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Body, Card, confirmDestructive, EmptyState, Field, Notice, Sheet, useDiscardGuard } from '../../components/ui';
import { residentError } from '../../lib/errors';
import { releaseGates } from '../../lib/release-gates';
import { useResident, type Profile } from '../../lib/runtime';
import { layout, radius, space, useType, useColors } from '../../lib/theme';
import { MAX_MEMBERS, memberInitials, readMembers, RELATIONS, ROLES, sameMembers, saveHousehold, validateMember, type Member, type MemberDraft } from './household';

function Chips({ label, options, value, onChange, error }: { label: string; options: readonly string[]; value: string; onChange: (value: string) => void; error?: string }) {
  const colors = useColors();
  const type = useType();
  return <View accessibilityRole="radiogroup" accessibilityLabel={`${label}, required`} style={{ gap: space[2] }}>
    <Text style={[type.subheadline, { color: colors.textPrimary, fontWeight: '600' }]}>{label} <Text style={{ color: colors.danger }}>*</Text></Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {options.map((option) => {
        const selected = option === value;
        return <Pressable key={option} accessibilityRole="radio" accessibilityLabel={option} accessibilityState={{ selected }} onPress={() => onChange(option)}
          style={{ minHeight: layout.controlMin, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceSelected : 'transparent' }}>
          <Text style={[type.callout, { color: colors.textPrimary, fontWeight: selected ? '700' : '400' }]}>{option}</Text>
        </Pressable>;
      })}
    </View>
    {!!error && <Body role="footnote" tone="danger">{error}</Body>}
  </View>;
}

function MemberSheet({ visible, initial, onSave, onRemove, onClose }: { visible: boolean; initial: Member | null; onSave: (draft: MemberDraft) => void; onRemove?: () => void; onClose: () => void }) {
  // The sheet's content mounts fresh on every open, so each edit starts from the member's saved values.
  return <Sheet visible={visible} title={initial ? 'Edit household member' : 'Add household member'} onClose={onClose}>
    <MemberForm initial={initial} onSave={onSave} onRemove={onRemove} onClose={onClose} />
  </Sheet>;
}

function MemberForm({ initial, onSave, onRemove, onClose }: { initial: Member | null; onSave: (draft: MemberDraft) => void; onRemove?: () => void; onClose: () => void }) {
  const [draft, setDraft] = useState<MemberDraft>({ name: initial?.name ?? '', relation: initial?.relation ?? '', role: initial?.role ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof MemberDraft, string>>>({});
  function submit() {
    const found = validateMember(draft);
    setErrors(found);
    if (!Object.keys(found).length) onSave(draft);
  }
  return <>
    <Field label="Full name" required value={draft.name} onChangeText={(name) => setDraft((current) => ({ ...current, name }))} autoCapitalize="words" textContentType="name" error={errors.name} />
    <Chips label="Relationship" options={RELATIONS} value={draft.relation} error={errors.relation} onChange={(relation) => setDraft((current) => ({ ...current, relation }))} />
    <Chips label="Role" options={ROLES} value={draft.role} error={errors.role} onChange={(role) => setDraft((current) => ({ ...current, role }))} />
    <View style={{ gap: space[3], marginTop: space[3] }}>
      <Action label={initial ? 'Update member' : 'Add member'} onPress={submit} />
      {onRemove && <Action label="Remove member" destructive secondary onPress={onRemove} />}
      <Action label="Cancel" secondary onPress={onClose} />
    </View>
  </>;
}

function MemberRow({ member, onEdit }: { member: Member; onEdit?: () => void }) {
  const colors = useColors();
  const type = useType();
  const detail = [member.relation, member.role].filter(Boolean).join(' · ');
  const content = <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: layout.listRowMin }}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[type.callout, { color: colors.primary, fontWeight: '700' }]}>{memberInitials(member.name)}</Text>
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[type.headline, { color: colors.textPrimary }]}>{member.name}</Text>
      {!!detail && <Text style={[type.subheadline, { color: colors.textSecondary }]}>{detail}</Text>}
    </View>
  </View>;
  return onEdit
    ? <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${member.name}, ${detail}`} onPress={onEdit}>{content}</Pressable>
    : <View accessible accessibilityLabel={`${member.name}, ${detail}`}>{content}</View>;
}

/**
 * The shared profile/Family household list (A27, A37-028). Edits are staged locally and saved
 * as one whole list against the list that was last read, so a list changed on another device
 * is refused instead of overwritten. Editing stays behind the `householdEditing` release gate
 * until its backend evidence (G03) passes; the list is always readable.
 */
export function HouseholdCard({ profile }: { profile: Profile }) {
  const { client, refreshProfile } = useResident();
  const saved = readMembers(profile.household_members);
  // Staged edits remember the stored list they were made against (the stale-edit check).
  const [staged, setStaged] = useState<{ members: Member[]; base: Json } | null>(null);
  const [editing, setEditing] = useState<{ member: Member | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const dirty = staged !== null && !sameMembers(staged.members, readMembers(staged.base).members);
  const stale = staged !== null && JSON.stringify(staged.base) !== JSON.stringify(profile.household_members);
  const members = dirty && staged ? staged.members : saved.members;
  const needsReload = stale || unconfirmed;
  useDiscardGuard(dirty && !busy);
  const canEdit = releaseGates.householdEditing;
  const locked = !canEdit || busy || needsReload;

  function stage(next: Member[]) {
    setStaged({ members: next, base: staged?.base ?? profile.household_members });
    setMessage(null);
  }
  function upsert(draft: MemberDraft) {
    const target = editing?.member;
    const name = draft.name.trim();
    stage(target ? members.map((member) => member.id === target.id ? { ...member, name, relation: draft.relation, role: draft.role } : member)
      : [...members, { id: randomUUID(), name, relation: draft.relation, role: draft.role }]);
    setEditing(null);
  }
  async function remove(member: Member) {
    if (await confirmDestructive({ title: `Remove ${member.name}?`, message: 'They are removed from your household when you save.', confirmLabel: 'Remove member' })) {
      stage(members.filter((item) => item.id !== member.id));
      setEditing(null);
    }
  }
  async function reload() {
    setBusy(true);
    try {
      await refreshProfile();
      setStaged(null); setUnconfirmed(false);
      setMessage({ text: 'Showing your latest household list.', tone: 'primary' });
    } catch { setMessage({ text: 'The latest list could not be loaded. Check your connection and try again.', tone: 'danger' }); }
    finally { setBusy(false); }
  }
  async function save() {
    if (busy || !staged || !dirty || needsReload) return;
    setBusy(true); setMessage(null);
    try {
      const result = await saveHousehold(client, staged.members, staged.base, randomUUID);
      if (result.kind === 'saved') {
        setStaged(null);
        await refreshProfile().catch(() => undefined);
        setMessage({ text: 'Household saved.', tone: 'primary' });
      } else {
        setUnconfirmed(result.kind === 'unconfirmed');
        // A refused save wrote nothing; the stored list is reloaded so the staged edits can be redone.
        if (result.kind === 'changed') await refreshProfile().catch(() => undefined);
        setMessage({ text: result.kind === 'changed'
          ? 'Your household list was changed on another device, so nothing was saved. Reload the latest list, then make your changes again.'
          : 'We could not confirm whether your household was saved. Reload the latest list before making changes again.', tone: 'danger' });
      }
    } catch (failure) { setMessage({ text: residentError(failure), tone: 'danger' }); }
    finally { setBusy(false); }
  }

  return <Card>
    <Body heading>Household</Body>
    <Body tone="secondary">{members.length === 1 ? '1 member' : `${members.length} members`}</Body>
    {saved.unreadable > 0 && <Notice tone="danger" message={`${saved.unreadable} saved ${saved.unreadable === 1 ? 'entry' : 'entries'} could not be read and ${saved.unreadable === 1 ? 'is' : 'are'} not shown.`} />}
    {members.length === 0
      ? <EmptyState title="No household members yet" message="Add the people who live with you so evacuation centers and barangay staff have an accurate household." />
      : members.map((member) => <MemberRow key={member.id} member={member} onEdit={locked ? undefined : () => setEditing({ member })} />)}
    {canEdit
      ? <>
        <Action label="Add household member" secondary disabled={locked || members.length >= MAX_MEMBERS} onPress={() => setEditing({ member: null })} />
        {dirty && <Action label={busy ? 'Saving household…' : 'Save household'} disabled={busy || needsReload} onPress={() => void save()} />}
        {dirty && !busy && <Action label="Discard household changes" secondary onPress={() => { setStaged(null); setMessage(null); }} />}
        {needsReload && <Action label="Reload latest household list" disabled={busy} onPress={() => void reload()} />}
        {stale && !message && <Notice tone="danger" message="Your household list changed on another device. Reload the latest list, then make your changes again." />}
      </>
      : <Notice message="Household editing is not available in this version yet. Your saved household is shown above." />}
    {message && <Notice message={message.text} tone={message.tone} />}
    <MemberSheet visible={!!editing} initial={editing?.member ?? null} onSave={upsert} onClose={() => setEditing(null)}
      onRemove={editing?.member ? () => void remove(editing.member as Member) : undefined} />
  </Card>;
}
