import { servicePriceLabel, serviceProcessingLabel, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { ThemedText } from '@/components/themed-text';
import { ServiceListLink, ServicesPanel, serviceListStyles } from '@/components/services/services-list-presentation';
import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

/** Real document_types catalog for the resident's own barangay (RLS-scoped). */
export function DocumentsList({ verification }: { verification?: ReactNode }) {
  const theme = useTheme();
  const [documents, setDocuments] = useState<DocumentType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // Each mount gets its own unique channel name so that fast re-mounts (e.g. via
  // router.replace('/services') from the COD confirmation screen) never try to add
  // postgres_changes listeners to a channel that a previous instance already
  // subscribed — Supabase throws "cannot add callbacks after subscribe()" in that case.
  // useState lazy initialiser so Date.now() runs once at mount, not on re-renders.
  // Value is stable (no setter used) — same role as useRef but avoids the purity lint.
  const [channelName] = useState(() => `document-types-${Date.now()}`);

  useEffect(() => {
    let active = true;
    function load() {
      supabase
        .from('document_types')
        .select('*').eq('is_active', true)
        .order('name')
        .then(({ data, error: queryError }) => { if (active) { setDocuments(queryError ? null : data ?? []); setError(queryError ? 'Could not load the service catalog. Reconnect and retry.' : null); } });
    }

    load();

    // Realtime: an admin editing/deactivating a document type on the web dashboard
    // should show up here without a manual pull-to-refresh — same pattern as
    // requests-list.tsx's existing subscription.
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_types' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelName, retry]);

  if (error) {
    return <ServicesErrorState message={error} retryLabel="Retry catalog" onRetry={() => setRetry(value => value + 1)} />;
  }
  if (documents === null) {
    return <ServicesListSkeleton />;
  }

  if (documents.length === 0) {
    return (
      <ServicesEmptyState
        icon="document-text-outline"
        title="No documents available yet"
        message="Services offered by your barangay will appear here."
      />
    );
  }

  return (
    <View style={[serviceListStyles.list, styles.list]}>
      <View style={styles.sectionHeader}>
        <ThemedText type="heading" style={[serviceListStyles.heading, styles.heading]}>Available Documents</ThemedText>
        {verification ? <View style={styles.headingMeta}>{verification}</View> : null}
      </View>

      <ServicesPanel>
        {documents.map((doc, index) => (
          <ServiceListLink key={doc.id} href={`/services/${doc.id}`} label={doc.name} divider={index > 0} style={styles.documentRow}>
            <View style={[serviceListStyles.icon, styles.documentIcon, { backgroundColor: theme.resident.accent, borderColor: theme.resident.controlBorder, borderWidth: theme.resident.accentNeedsOutline ? 1 : 0 }]}>
              <DocumentIcon name={getDocumentIcon(doc.name)} size={20} color={theme.resident.onAccent} accessible={false} />
            </View>

            <View style={serviceListStyles.info}>
              <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail" style={[serviceListStyles.title, styles.documentTitle]}>
                {doc.name}
              </ThemedText>
              <View style={styles.metaRow}>
                <Ionicons name="time-outline" size={14} color={theme.resident.muted} accessible={false} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
                  {serviceProcessingLabel(doc)}
                </ThemedText>
              </View>
              <View style={styles.metaRow}>
                <Ionicons name="pricetag-outline" size={14} color={theme.resident.accentText} accessible={false} />
                <ThemedText type="smallBold" style={[styles.metaText, { color: theme.resident.accentText }]}>
                  {servicePriceLabel(doc)}
                </ThemedText>
              </View>
            </View>

            <Ionicons name="chevron-forward" size={16} color={theme.resident.muted} style={styles.documentChevron} accessible={false} />
          </ServiceListLink>
        ))}
      </ServicesPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 2 },
  sectionHeader: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: 4 },
  heading: { textAlign: 'center', fontSize: 22, lineHeight: 28, letterSpacing: -0.4, flexShrink: 1 },
  headingMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 8 },
  documentRow: { paddingHorizontal: 12, paddingVertical: 10, gap: 10, minHeight: 72 },
  documentIcon: { width: 36, height: 36, borderRadius: 10 },
  documentTitle: { fontSize: 14, lineHeight: 18 },
  documentChevron: { alignSelf: 'center', flexShrink: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 3 },
  metaText: { flex: 1, fontSize: 12.5, lineHeight: 16 },
});
