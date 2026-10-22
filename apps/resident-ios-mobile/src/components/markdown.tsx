import { useMemo, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';
import { openExternal } from '../lib/open-external';
import { parseMarkdown, type Block, type Inline } from '../lib/markdown';
import { radius, space, useColors, useType } from '../lib/theme';
import { Notice } from './ui';

const LINK_FAILED = 'This link could not be opened. Check that the app it needs is available, then try again.';

/**
 * Managed rich text (policies, About, help articles) rendered with the app's own type roles so Dynamic Type and the resident's
 * font choice apply. Raw HTML is shown as text, and only https, mail and telephone links are followed.
 */
export function Markdown({ source }: { source: string }) {
  const blocks = useMemo(() => parseMarkdown(source), [source]);
  const [failed, setFailed] = useState(false);
  return <View style={{ gap: space[3] }}>
    {blocks.map((block, index) => <BlockView key={index} block={block} onLinkFailed={() => setFailed(true)} />)}
    {failed && <Notice tone="danger" message={LINK_FAILED} />}
  </View>;
}

function BlockView({ block, onLinkFailed }: { block: Block; onLinkFailed: () => void }) {
  const colors = useColors();
  const type = useType();
  switch (block.kind) {
    case 'heading':
      return <Text selectable accessibilityRole="header" style={[block.level <= 2 ? type.title2 : type.headline, { color: colors.textPrimary }]}><Inlines inlines={block.inlines} onLinkFailed={onLinkFailed} /></Text>;
    case 'paragraph':
      return <Text selectable style={[type.body, { color: colors.textPrimary }]}><Inlines inlines={block.inlines} onLinkFailed={onLinkFailed} /></Text>;
    case 'list':
      return <View accessibilityRole="list" style={{ gap: space[2] }}>
        {block.items.map((item, index) => <View key={index} style={{ flexDirection: 'row', gap: space[2] }}>
          <Text accessibilityElementsHidden style={[type.body, { color: colors.textSecondary, minWidth: 22 }]}>{block.ordered ? `${block.start + index}.` : '•'}</Text>
          <Text selectable style={[type.body, { color: colors.textPrimary, flex: 1 }]}><Inlines inlines={item} onLinkFailed={onLinkFailed} /></Text>
        </View>)}
      </View>;
    case 'quote':
      return <View style={{ borderLeftWidth: 3, borderLeftColor: colors.border, paddingLeft: space[3] }}>
        <Text selectable style={[type.body, { color: colors.textSecondary }]}><Inlines inlines={block.inlines} onLinkFailed={onLinkFailed} /></Text>
      </View>;
    case 'code':
      return <View style={{ backgroundColor: colors.surfaceSelected, borderRadius: radius.sm, padding: space[3] }}><Text selectable style={[type.monoReference, { color: colors.textPrimary }]}>{block.text}</Text></View>;
    case 'rule':
      return <View accessibilityElementsHidden style={{ height: 1, backgroundColor: colors.border }} />;
  }
}

function Inlines({ inlines, onLinkFailed }: { inlines: Inline[]; onLinkFailed: () => void }) {
  const colors = useColors();
  const type = useType();
  return <>{inlines.map((inline, index) => {
    switch (inline.kind) {
      case 'text': return inline.text;
      case 'bold': return <Text key={index} style={{ fontWeight: '700' } satisfies TextStyle}><Inlines inlines={inline.children} onLinkFailed={onLinkFailed} /></Text>;
      case 'italic': return <Text key={index} style={{ fontStyle: 'italic' } satisfies TextStyle}><Inlines inlines={inline.children} onLinkFailed={onLinkFailed} /></Text>;
      case 'code': return <Text key={index} style={type.monoReference}>{inline.text}</Text>;
      case 'link': {
        const target = inline.url;
        if (!target) return inline.label;
        return <Text key={index} accessibilityRole="link" accessibilityLabel={inline.label} style={{ color: colors.primary, textDecorationLine: 'underline' }}
          onPress={() => { void openExternal(target).then((opened) => { if (!opened) onLinkFailed(); }); }}>{inline.label}</Text>;
      }
    }
  })}</>;
}
