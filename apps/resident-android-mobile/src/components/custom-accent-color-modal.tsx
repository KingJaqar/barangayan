import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ColorPicker } from '@/components/color-picker';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { DEFAULT_ACCENT_COLOR } from '@/hooks/use-theme-preference';

interface CustomAccentColorModalProps {
  visible: boolean;
  onClose: () => void;
  /** Returns false (and the modal stays open, showing an error) if the list is already
   * at the MAX_CUSTOM_COLORS cap — mirrors the web admin Theme page's addCustomColor(). */
  onSave: (color: string) => boolean;
  atLimit: boolean;
}

/**
 * Visual color picker for the Settings screen's App Theme section — lets a resident pick
 * any accent color via a saturation/value square + hue slider (components/color-picker.tsx)
 * instead of typing a hex code. Saved colors persist to profiles.custom_accent_colors
 * (0075 migration), capped at MAX_CUSTOM_COLORS, mirroring the web admin Theme page's
 * accent-controller.tsx behavior.
 */
export function CustomAccentColorModal({ visible, onClose, onSave, atLimit }: CustomAccentColorModalProps) {
  const theme = useTheme();
  const [pickedColor, setPickedColor] = useState(DEFAULT_ACCENT_COLOR);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setPickedColor(DEFAULT_ACCENT_COLOR);
      setError(null);
    }
  }, [visible]);

  function handleClose() {
    onClose();
  }

  function handleSave() {
    if (atLimit) {
      setError('You can save up to 10 custom colors. Remove one to add another.');
      return;
    }
    const saved = onSave(pickedColor);
    if (saved) {
      handleClose();
    } else {
      setError('That color is already saved.');
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <ThemedText type="smallBold" style={styles.title}>
            Custom Accent Color
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
            Drag to pick any color. Up to 10 custom colors can be saved.
          </ThemedText>

          <View style={styles.pickerWrap}>
            <ColorPicker value={pickedColor} onChange={(hex) => { setPickedColor(hex); setError(null); }} />
          </View>

          <View style={styles.previewRow}>
            <View style={[styles.previewSwatch, { backgroundColor: pickedColor, borderColor: theme.backgroundSelected }]} />
            <ThemedText type="smallBold" style={styles.previewHex}>
              {pickedColor}
            </ThemedText>
          </View>

          {error ? (
            <ThemedText type="small" style={[styles.error, { color: theme.accentRed }]}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable style={[styles.actionButton, { backgroundColor: theme.backgroundElement }]} onPress={handleClose}>
              <ThemedText style={styles.actionText}>Cancel</ThemedText>
            </Pressable>
            <Pressable style={[styles.actionButton, { backgroundColor: pickedColor }]} onPress={handleSave}>
              <ThemedText style={[styles.actionText, { color: '#ffffff' }]}>Save Color</ThemedText>
            </Pressable>
          </View>
        </Pressable>
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
  subtitle: {
    textAlign: 'center',
  },
  pickerWrap: {
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  previewSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  previewHex: {
    letterSpacing: 1,
  },
  error: {
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
