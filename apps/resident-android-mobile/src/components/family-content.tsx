import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { PrimaryButton } from '@/components/primary-button';
import { DrrmSourceState } from '@/components/drrm/presentation';
import { HouseholdCode } from '@/components/drrm/household-code';
import { FamilyMemberModal, type ProfileHouseholdMemberInput } from '@/components/family-member-modal';
import { HouseholdQrModal } from '@/components/household-qr-modal';
import { useProfileHouseholdMembers } from '@/hooks/use-profile-household-members';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/hooks/use-auth';
import { useHouseholdAttendance } from '@/hooks/use-household-attendance';
import { attendanceTime } from '@/lib/household';
import type { HouseholdAttendance } from '@barangayan/shared';

export function FamilyContent() {
  const { session } = useAuth();
  return <AccountFamily key={session?.user.id ?? 'signed-out'} />;
}

function AccountFamily() {
  const { resident } = useTheme();
  const { profile } = useProfile();
  const focused = useIsFocused();
  const { width, fontScale } = useWindowDimensions();
  const { members, isLoading, error, saveError, needsReload, refetch, addMember, updateMember, removeMember } = useProfileHouseholdMembers();
  const attendance = useHouseholdAttendance();
  const [showCode, setShowCode] = useState(false);
  const [editing, setEditing] = useState<ProfileHouseholdMemberInput | 'new' | null>(null);
  useEffect(() => { if (!focused) { setShowCode(false); setEditing(null); } }, [focused]);
  // Account changes discard presentation state; no member or code crosses accounts.
  useEffect(() => { setShowCode(false); setEditing(null); }, [profile?.id]);
  const initial = editing === 'new' ? null : editing;
  const householdName = profile?.last_name ? `${profile.last_name} Family` : 'Your Household';
  const holder = attendance.attendance?.people.find(person => person.kind === 'holder');
  const statusUnavailable = attendance.loading || !!attendance.error || !attendance.attendance;
  function refresh() { void refetch(); void attendance.refetch(); }
  return <View style={styles.root}>
    <View><ThemedText accessibilityRole="header" style={[styles.title, { color: resident.text }]}>Household: {householdName}</ThemedText>
      <ThemedText style={[styles.subtitle, { color: resident.muted }]}>Staff confirm who is present. Showing a code alone does not record attendance.</ThemedText></View>
    <View style={[styles.qrCard, { backgroundColor: resident.card, borderColor: resident.border }]}>
      <View style={[styles.qrHeader, (width < 360 || fontScale > 1.2) && styles.wrap]}>
        <View style={[styles.tile, { backgroundColor: resident.accentSoft }]}><Ionicons name="qr-code-outline" size={20} color={resident.accentText} /></View>
        <ThemedText style={[styles.qrTitle, { color: resident.text }]}>My QR Code</ThemedText>
        <Pressable onPress={() => setShowCode(true)} accessibilityRole="button" style={[styles.showCode, { borderColor: resident.accentText }]}>
          <ThemedText style={{ fontSize: 13, fontWeight: '700', color: resident.accentText }}>Show My Code</ThemedText><Ionicons name="expand-outline" size={14} color={resident.accentText} />
        </Pressable>
      </View>
      <HouseholdCode size={Math.max(80, Math.min(120, width - 120))} />
      <ThemedText style={[styles.caption, { color: resident.muted }]}>Show this Family QR to barangay staff and confirm who is present.</ThemedText>
    </View>
    <View style={styles.membersSection}>
      <View style={styles.membersHeading}><ThemedText accessibilityRole="header" style={[styles.membersTitle, { color: resident.text }]}>Family Members</ThemedText>
        <ThemedText style={{ color: resident.muted, fontSize: 13, fontWeight: '600' }}>{isLoading || error ? 'Family list unavailable' : `${members.length + 1} ${members.length ? 'people' : 'person'}`}</ThemedText></View>
      <PrimaryButton presentation="resident" compact variant="secondary" label="Refresh family" disabled={isLoading || attendance.loading} onPress={refresh} />
      {error ? <DrrmSourceState message={error} retry={() => { void refetch(); }} /> : null}
      {attendance.error ? <DrrmSourceState message={attendance.error} retry={() => { void attendance.refetch(); }} /> : null}
      {isLoading && !members.length ? <DrrmSourceState loading message="Loading family members…" /> : null}
      <View style={[styles.members, { borderColor: resident.border, backgroundColor: resident.card }]}>
        <View style={styles.member}><View style={styles.info}>
          <ThemedText style={[styles.memberName, { color: resident.text }]}>{holder?.name || profile?.full_name || 'Account holder'}</ThemedText>
          <ThemedText style={{ color: resident.muted }}>Account holder (you)</ThemedText>
          <AttendanceStatus person={holder} unavailable={statusUnavailable} loading={attendance.loading} />
        </View></View>
        {members.map(member => <Pressable key={member.id} disabled={isLoading || !!error || needsReload} accessibilityRole="button" accessibilityLabel={`Edit ${member.name}`} onPress={() => setEditing({ ...member, role: member.role ?? 'Member' })}
          style={({ pressed }) => [styles.member, { backgroundColor: pressed ? resident.pressed : resident.card, borderTopWidth: 1, borderTopColor: resident.border }]}>
          <View style={[styles.avatar, { backgroundColor: resident.accentSoft }]}><ThemedText style={{ color: resident.accentText, fontSize: 14, fontWeight: '700' }}>{member.name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(part => part.slice(0, 1)).join('').toUpperCase() || '?'}</ThemedText></View>
          <View style={styles.info}><ThemedText style={[styles.memberName, { color: resident.text }]}>{member.name}</ThemedText>
            <View style={styles.tags}>{[member.relation, member.role].filter(Boolean).map((tag, tagIndex) => <View key={tagIndex} style={[styles.tag, { backgroundColor: resident.surface }]}><ThemedText style={{ fontSize: 11.5, lineHeight: 17, fontWeight: '600', color: resident.muted }}>{tag}</ThemedText></View>)}</View>
            <AttendanceStatus person={attendance.attendance?.people.find(person => person.member_id === member.id)} unavailable={statusUnavailable} loading={attendance.loading} />
          </View><Ionicons name="chevron-forward" size={20} color={resident.muted} />
        </Pressable>)}
      </View>
    </View>
    {needsReload ? <DrrmSourceState message={saveError ?? 'Reload your family list before editing again.'} retry={refresh} /> : null}
    <PrimaryButton presentation="resident" compact label="Add Family Member" disabled={isLoading || !!error || needsReload || members.length >= 30} leadingIcon={<Ionicons name="add" size={20} color={resident.onAccent} />} onPress={() => setEditing('new')} />
    <FamilyMemberModal visible={focused && editing !== null} initial={initial} onClose={() => setEditing(null)}
      saveError={saveError} needsReload={needsReload} onReload={() => { setEditing(null); refresh(); }}
      onSave={async input => Boolean(input.id ? await updateMember(input.id, input) : await addMember(input))} onDelete={removeMember} />
    <HouseholdQrModal visible={focused && showCode} onClose={() => setShowCode(false)} />
  </View>;
}

function AttendanceStatus({ person, unavailable, loading }: { person: HouseholdAttendance['people'][number] | undefined; unavailable: boolean; loading: boolean }) {
  const { resident } = useTheme();
  if (unavailable || !person) return <ThemedText style={{ color: resident.muted, fontSize: 12.5, lineHeight: 19 }}>{loading ? 'Loading attendance…' : 'Attendance unavailable. Refresh to check.'}</ThemedText>;
  return <View style={{ gap: 3 }}>
    {person.current_stay ? <ThemedText style={{ color: resident.accentText, fontSize: 12.5, lineHeight: 19 }}>Checked in at {person.current_stay.center_name}{'\n'}Arrived {attendanceTime(person.current_stay.checked_in_at)} (Manila)</ThemedText>
      : <ThemedText style={{ color: resident.muted, fontSize: 12.5, lineHeight: 19 }}>No recorded check-in</ThemedText>}
    {person.latest_departure?.checked_out_at ? <ThemedText style={{ color: resident.muted, fontSize: 12.5, lineHeight: 19 }}>Last visit: {person.latest_departure.center_name}{'\n'}Arrived {attendanceTime(person.latest_departure.checked_in_at)}{'\n'}Departed {attendanceTime(person.latest_departure.checked_out_at)} (Manila)</ThemedText> : null}
  </View>;
}
const styles = StyleSheet.create({
  root: { gap: 16 }, title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 }, subtitle: { fontSize: 13.5, lineHeight: 20, marginTop: 4 },
  qrCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 }, qrHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 }, wrap: { flexWrap: 'wrap' },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, qrTitle: { flex: 1, fontSize: 16, fontWeight: '700', minWidth: 80 },
  showCode: { minHeight: 44, borderRadius: 22, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  caption: { fontSize: 12.5, lineHeight: 18, textAlign: 'center', maxWidth: 260, alignSelf: 'center' }, membersSection: { gap: 8 },
  membersHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }, membersTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  members: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' }, member: { paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }, info: { flex: 1, minWidth: 0, gap: 4 }, memberName: { fontSize: 15, lineHeight: 21, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, tag: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 2 },
});
