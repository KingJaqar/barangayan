import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useProfileHouseholdMembers } from '@/hooks/use-profile-household-members';
import { FamilyMemberModal, type ProfileHouseholdMemberInput } from '@/components/family-member-modal';
import { HouseholdQrModal } from '@/components/household-qr-modal';
import { useAuth } from '@/hooks/use-auth';

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function FamilyContent() {
  const theme = useTheme();
  const { profile } = useProfile();
  const { session } = useAuth();
  const { members, isLoading, addMember, updateMember, removeMember } = useProfileHouseholdMembers();
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingMember, setEditingMember] = useState<ProfileHouseholdMemberInput | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  const householdName = (profile as any)?.full_name
    ? (profile as any).full_name.split(' ').slice(-1)[0] + ' Family'
    : 'Your Household';

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;

  useEffect(() => {
    if (profile?.id && supabaseUrl) {
      const url = `${supabaseUrl}/functions/v1/generate-household-qr?profileId=${profile.id}`;
      setQrUrl(url);
    }
  }, [profile?.id, supabaseUrl]);

  async function handleAddMember(input: ProfileHouseholdMemberInput) {
    return await addMember(input);
  }

  async function handleUpdateMember(input: ProfileHouseholdMemberInput) {
    if (!input.id) return;
    await updateMember(input.id, input);
  }

  async function handleDeleteMember(id: string) {
    await removeMember(id);
  }

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <View>
          <ThemedText type="smallBold" style={[styles.householdTitle, { color: theme.text }]}>
            Household: {householdName}
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.householdSubtitle}>
            View your family members from your profile.
          </ThemedText>
        </View>
      </View>

      <View style={[styles.qrCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
        <View style={styles.qrCardHeader}>
          <View style={styles.qrCardHeaderLeft}>
            <View style={[styles.qrIconWrap, { backgroundColor: '#E6F2EF' }]}>
              <Ionicons name="qr-code-outline" size={22} color={Colors.light.primary} />
            </View>
            <ThemedText type="smallBold" style={styles.qrLabel}>
              My QR Code
            </ThemedText>
          </View>
          <Pressable
            style={[styles.showCodeButton, { borderColor: Colors.light.primary }]}
            onPress={() => setShowQrModal(true)}>
            <ThemedText style={[styles.showCodeText, { color: Colors.light.primary }]}>
              Show My Code
            </ThemedText>
            <Ionicons name="open-outline" size={16} color={Colors.light.primary} />
          </Pressable>
        </View>

        <View style={styles.qrImageContainer}>
          <View style={[styles.qrImageFrame, { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }]}>
            {qrUrl && session?.access_token ? (
              <Image
                source={{ uri: qrUrl, headers: { Authorization: `Bearer ${session.access_token}` } }}
                style={styles.qrImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <QrPlaceholder />
            )}
          </View>
        </View>

        <ThemedText themeColor="textSecondary" style={styles.qrCaption}>
          Present this QR code at evacuation centers for quick family check-in.
        </ThemedText>
      </View>

      <View style={styles.membersHeader}>
        <ThemedText type="smallBold" style={[styles.membersTitle, { color: theme.text }]}>
          Family Members
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.membersCount}>
          {members.length} Total
        </ThemedText>
      </View>

      {isLoading && members.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ThemedText themeColor="textSecondary">Loading family members…</ThemedText>
        </View>
      ) : members.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
          <Ionicons name="people-outline" size={40} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.emptyText}>
            No family members added yet.
          </ThemedText>
          <Pressable
            style={[styles.emptyAddButton, { backgroundColor: Colors.light.primary }]}
            onPress={() => { setEditingMember(null); setShowAddModal(true); }}>
            <ThemedText style={[styles.emptyAddText, { color: theme.onPrimary }]}>
              + Add Family Member
            </ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.membersList}>
          {members.map((member, index) => (
            <Pressable
              key={member.id}
              onPress={() => setEditingMember({
                id: member.id,
                name: member.name,
                relation: member.relation,
                role: member.role ?? 'Member',
              })}
              style={[
                styles.memberCard,
                { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                index < members.length - 1 && styles.memberCardSeparator,
              ]}>
              <View style={styles.memberLeft}>
                <View style={styles.avatarCircle}>
                  <ThemedText style={styles.avatarInitials}>{getInitials(member.name)}</ThemedText>
                </View>
                <View style={styles.memberInfo}>
                  <ThemedText type="smallBold" style={[styles.memberName, { color: theme.text }]}>
                    {member.name}
                  </ThemedText>
                  <View style={styles.memberRelationRow}>
                    <View style={[styles.relationChip, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.relationChipText}>
                        {member.relation}
                      </ThemedText>
                    </View>
                    {member.role ? (
                      <View style={[styles.relationChip, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
                        <ThemedText type="small" themeColor="textSecondary" style={styles.relationChipText}>
                          {member.role}
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>
      )}

      {members.length > 0 && (
        <Pressable
          style={[styles.fab, { backgroundColor: Colors.light.primary }]}
          onPress={() => { setEditingMember(null); setShowAddModal(true); }}>
          <Ionicons name="add" size={22} color="#FFFFFF" />
          <ThemedText style={[styles.fabText, { color: '#FFFFFF' }]}>Add Family Member</ThemedText>
        </Pressable>
      )}

      <FamilyMemberModal
        visible={showAddModal || !!editingMember}
        initial={editingMember}
        onClose={() => { setShowAddModal(false); setEditingMember(null); }}
        onSave={(input) => {
          if (editingMember?.id) {
            handleUpdateMember(input);
          } else {
            handleAddMember(input);
          }
        }}
        onDelete={(id) => handleDeleteMember(id)}
      />

      <HouseholdQrModal visible={showQrModal} onClose={() => setShowQrModal(false)} />
    </ScrollView>
  );
}

function QrPlaceholder() {
  return (
    <View style={styles.qrPlaceholder}>
      <View style={styles.qrRow}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={`top-${i}`} style={[styles.qrBlock, i % 2 === 0 && styles.qrBlockFilled]} />
        ))}
      </View>
      {Array.from({ length: 4 }).map((_, row) => (
        <View key={`row-${row}`} style={styles.qrRow}>
          <View style={[styles.qrBlock, styles.qrBlockFilled]} />
          <View style={[styles.qrBlock, row % 2 === 0 && styles.qrBlockFilled]} />
          <View style={[styles.qrBlock, row % 2 === 1 && styles.qrBlockFilled]} />
          <View style={[styles.qrBlock, styles.qrBlockFilled]} />
          <View style={[styles.qrBlock, row % 2 === 0 && styles.qrBlockFilled]} />
          <View style={[styles.qrBlock]} />
          <View style={[styles.qrBlock, row % 2 === 1 && styles.qrBlockFilled]} />
          <View style={[styles.qrBlock, styles.qrBlockFilled]} />
        </View>
      ))}
      <View style={styles.qrRow}>
        {Array.from({ length: 8 }).map((_, i) => (
          <View key={`bottom-${i}`} style={[styles.qrBlock, i % 2 === 0 && styles.qrBlockFilled]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six * 2,
    gap: Spacing.four,
  },
  headerRow: {
    gap: Spacing.one,
  },
  householdTitle: {
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  householdSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  qrCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.four,
    gap: Spacing.three,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  qrCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  qrCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  qrIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  showCodeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  showCodeText: {
    fontSize: 13,
    fontWeight: '600',
  },
  qrImageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImageFrame: {
    width: 220,
    height: 220,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.three,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  qrRow: {
    flexDirection: 'row',
    gap: 4,
  },
  qrBlock: {
    width: 14,
    height: 14,
    borderRadius: 2,
    backgroundColor: 'transparent',
  },
  qrBlockFilled: {
    backgroundColor: '#000000',
  },
  qrCaption: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  membersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  membersCount: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: Spacing.six,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyAddButton: {
    borderRadius: 14,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  emptyAddText: {
    fontSize: 15,
    fontWeight: '700',
  },
  membersList: {
    gap: 0,
  },
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  memberCardSeparator: {
    marginBottom: Spacing.three,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flex: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8E8EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: '#60646C',
  },
  memberInfo: {
    gap: 2,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  memberRelation: {
    fontSize: 13,
    lineHeight: 18,
  },
  memberRelationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: 2,
  },
  relationChip: {
    borderRadius: 12,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderWidth: 1,
  },
  relationChipText: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 16,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    borderRadius: 28,
    marginTop: Spacing.four,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  fabText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
