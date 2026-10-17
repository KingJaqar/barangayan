import { useState } from 'react';
import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Action, Body, SymbolIcon } from '../../components/ui';
import { layout, radius, space, useColors, useType } from '../../lib/theme';

/**
 * Full-screen photo preview with previous/next controls (A34-009…012). The photo is shown whole
 * (`contain`), every control is a labeled button, and closing returns to the screen underneath.
 */
export function PhotoViewer({ uris, index, onIndex, onClose, subject }: { uris: readonly string[]; index: number | null; onIndex: (index: number) => void; onClose: () => void; subject: string }) {
  const type = useType();
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const open = index !== null && index >= 0 && index < uris.length;
  const current = open ? uris[index] : null;
  return <Modal visible={open} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: '#000', paddingTop: space[7], paddingBottom: space[5], paddingHorizontal: layout.margin, gap: space[4] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text accessibilityRole="header" style={[type.headline, { color: '#fff' }]}>{open ? `${subject} ${index + 1} of ${uris.length}` : subject}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`Close ${subject}`} onPress={onClose} style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, justifyContent: 'center', alignItems: 'flex-end' }}>
          <Text style={[type.body, { color: '#fff' }]}>Close</Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        {current && !failed[current] && <Image source={{ uri: current }} accessibilityLabel={`${subject} ${index !== null ? index + 1 : ''}`} accessibilityIgnoresInvertColors resizeMode="contain"
          onError={() => setFailed((previous) => ({ ...previous, [current]: true }))} style={{ width: '100%', height: '100%' }} />}
        {current && failed[current] && <Text style={[type.body, { color: '#fff', textAlign: 'center' }]}>This photo could not be loaded.</Text>}
      </View>
      {uris.length > 1 && index !== null && <View style={{ flexDirection: 'row', gap: space[3] }}>
        <View style={{ flex: 1 }}><Action label="Previous photo" secondary disabled={index === 0} onPress={() => onIndex(index - 1)} /></View>
        <View style={{ flex: 1 }}><Action label="Next photo" secondary disabled={index === uris.length - 1} onPress={() => onIndex(index + 1)} /></View>
      </View>}
    </View>
  </Modal>;
}

/** A report's photos: the current photo, previous/next controls and selectable dots; tapping opens the full-screen viewer. */
export function PhotoGallery({ uris }: { uris: readonly string[] }) {
  const colors = useColors();
  const [active, setActive] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  if (!uris.length) return null;
  const index = Math.min(active, uris.length - 1);
  const uri = uris[index];
  return <View style={{ gap: space[3] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Photo ${index + 1} of ${uris.length}`} accessibilityHint="Opens the photo full screen" onPress={() => setViewing(index)}
      style={{ height: 260, borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSelected, justifyContent: 'center' }}>
      {failed[uri] ? <Body tone="secondary">The photo could not be loaded.</Body>
        : <Image source={{ uri }} accessibilityIgnoresInvertColors resizeMode="contain" onError={() => setFailed((previous) => ({ ...previous, [uri]: true }))} style={{ width: '100%', height: '100%' }} />}
    </Pressable>
    {uris.length > 1 && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Pressable accessibilityRole="button" accessibilityLabel="Previous photo" accessibilityState={{ disabled: index === 0 }} disabled={index === 0} onPress={() => setActive(index - 1)}
        style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, justifyContent: 'center', alignItems: 'center', opacity: index === 0 ? 0.4 : 1 }}>
        <SymbolIcon name="chevron.left" color={colors.primary} size={18} />
      </Pressable>
      <View style={{ flexDirection: 'row', gap: space[1], alignItems: 'center' }}>
        {uris.map((item, position) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Show photo ${position + 1}`} accessibilityState={{ selected: position === index }} onPress={() => setActive(position)}
          style={{ minHeight: layout.controlMin, minWidth: layout.controlMin / 2, justifyContent: 'center', alignItems: 'center' }}>
          <View style={{ width: position === index ? 18 : 8, height: 8, borderRadius: 4, backgroundColor: position === index ? colors.primary : colors.border }} />
        </Pressable>)}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Next photo" accessibilityState={{ disabled: index === uris.length - 1 }} disabled={index === uris.length - 1} onPress={() => setActive(index + 1)}
        style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, justifyContent: 'center', alignItems: 'center', opacity: index === uris.length - 1 ? 0.4 : 1 }}>
        <SymbolIcon name="chevron.right" color={colors.primary} size={18} />
      </Pressable>
    </View>}
    <PhotoViewer uris={uris} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} subject="Report photo" />
  </View>;
}
