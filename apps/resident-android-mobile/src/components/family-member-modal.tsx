import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const RELATIONS = ['Spouse', 'Child', 'Parent', 'Sibling', 'Grandparent', 'Grandchild', 'Other'] as const;
const ROLES = ['Head of Family', 'Student', 'Employed', 'Unemployed', 'Retired', 'Minor'] as const;

export type ProfileHouseholdMemberInput = {
  id?: string;
  name: string;
  relation: string;
  role: string;
};

interface FamilyMemberModalProps {
  visible: boolean;
  initial: ProfileHouseholdMemberInput | null;
  onClose: () => void;
  onSave: (member: ProfileHouseholdMemberInput) => void;
  onDelete?: (id: string) => void;
}

export function FamilyMemberModal({ visible, initial, onClose, onSave, onDelete }: FamilyMemberModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState<string>(RELATIONS[0]);
  const [role, setRole] = useState<string>(ROLES[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setRelation((initial?.relation && RELATIONS.includes(initial.relation as typeof RELATIONS[number]))
        ? initial.relation
        : RELATIONS[0]);
      setRole((initial?.role && ROLES.includes(initial.role as typeof ROLES[number]))
        ? initial.role
        : ROLES[0]);
      setSubmitting(false);
    }
  }, [visible, initial]);

  const isEdit = !!initial;

  function handleSubmit() {
    if (!name.trim() || submitting) return;
    setSubmitting(true);
    onSave({
      id: initial?.id,
      name: name.trim(),
      relation,
      role,
    });
    setSubmitting(false);
    onClose();
  }

  function handleClose() {
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.handle} />
          <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
            {isEdit ? 'Edit Family Member' : 'Add Family Member'}
          </ThemedText>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              Full Name
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              value={name}
              onChangeText={setName}
              placeholder="Enter full name"
              placeholderTextColor={theme.textSecondary}
              returnKeyType="done"
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              Relation
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two, flexDirection: 'row' }}>
              {RELATIONS.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setRelation(opt)}
                  style={[
                    styles.chip,
                    relation === opt && { backgroundColor: Colors.light.primary },
                  ]}>
                  <ThemedText style={[styles.chipText, relation === opt && { color: '#FFFFFF' }]}>{opt}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              Role
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two, flexDirection: 'row' }}>
              {ROLES.map((opt) => (
                <Pressable
                  key={opt}
                  onPress={() => setRole(opt)}
                  style={[
                    styles.chip,
                    role === opt && { backgroundColor: Colors.light.primary },
                  ]}>
                  <ThemedText style={[styles.chipText, role === opt && { color: '#FFFFFF' }]}>{opt}</ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <View style={styles.actions}>
            {isEdit && onDelete && (
              <Pressable
                style={styles.deleteBtn}
                onPress={() => {
                  if (initial?.id) onDelete(initial.id);
                  onClose();
                }}>
                <ThemedText style={{ fontWeight: '700', color: '#93000A' }}>Remove</ThemedText>
              </Pressable>
            )}
            <Pressable
              style={[styles.saveBtn, { backgroundColor: Colors.light.primary }, !name.trim() && styles.saveBtnDisabled]}
              disabled={!name.trim() || submitting}
              onPress={handleSubmit}>
              {submitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.saveBtnText}>{isEdit ? 'Update' : 'Add Member'}</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  field: {
    gap: Spacing.one,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: '#F0F0F3',
    borderWidth: 1,
    borderColor: '#E0E1E6',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#60646C',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
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
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
