import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface AddFamilyMemberModalProps {
  visible: boolean;
  onClose: () => void;
  onAdd: (input: { name: string; relation: string; role?: string; avatar_url?: string | null }) => Promise<boolean>;
}

export function AddFamilyMemberModal({ visible, onClose, onAdd }: AddFamilyMemberModalProps) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [role, setRole] = useState('member');
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName('');
    setRelation('');
    setRole('member');
    setSubmitting(false);
  }

  async function handleSubmit() {
    if (!name.trim() || !relation.trim()) return;
    setSubmitting(true);
    const ok = await onAdd({
      name: name.trim(),
      relation: relation.trim(),
      role: role.trim() || 'member',
    });
    setSubmitting(false);
    if (ok) {
      reset();
      onClose();
    }
  }

  function handleClose() {
    reset();
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <View style={styles.handle} />
          <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
            Add Family Member
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
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              Relation
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              value={relation}
              onChangeText={setRelation}
              placeholder="e.g., Wife, Son, Daughter"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <View style={styles.field}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.label}>
              Role
            </ThemedText>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text, borderColor: theme.backgroundSelected }]}
              value={role}
              onChangeText={setRole}
              placeholder="member"
              placeholderTextColor={theme.textSecondary}
            />
          </View>

          <Pressable
            style={[styles.submitButton, { backgroundColor: Colors.light.primary }]}
            onPress={handleSubmit}
            disabled={submitting || !name.trim() || !relation.trim()}>
            {submitting ? (
              <ActivityIndicator size="small" color={theme.onPrimary} />
            ) : (
              <ThemedText style={[styles.submitText, { color: theme.onPrimary }]}>Add Member</ThemedText>
            )}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
  submitButton: {
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
