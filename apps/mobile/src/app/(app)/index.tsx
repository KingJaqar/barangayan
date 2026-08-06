import type { Tables } from '@barangayan/shared';
import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GuestPrompt } from '@/components/guest-prompt';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
};
type Announcement = Tables<'announcements'>;

const STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  in_progress: 'Processing',
  completed: 'Ready for Pickup',
  cancelled: 'Cancelled',
};

const QUICK_ACTIONS = [
  { label: 'Request Document', href: '/services' as const, icon: '📄' },
  { label: 'Report Issue', href: '/reports' as const, icon: '⚠️' },
  { label: 'Emergency', href: '/maps' as const, icon: '🚨' },
  { label: 'Medical Info', href: '/health' as const, icon: '➕' },
];

export default function HomeScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const theme = useTheme();

  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    // Real guest browsing per the 0005 migration's anon RLS policy — this must run
    // regardless of session, or a guest would never see the Announcements preview.
    supabase
      .from('announcements')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setAnnouncement(data?.[0] ?? null));
  }, []);

  useEffect(() => {
    // Personal data — service_requests stays authenticated + auth.uid()-scoped, so this
    // only runs (and only can succeed) once a real session exists.
    if (!session) {
      setRequests([]);
      return;
    }

    supabase
      .from('service_requests')
      .select('*, document_types(name)')
      .eq('resident_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRequests((data as ServiceRequest[]) ?? []));
  }, [session]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.three }]}>
        <ThemedText type="title" style={styles.greetingName}>
          {session ? (profile?.full_name ?? 'Welcome') : 'Welcome, Guest'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          {profile?.barangays?.name ?? 'Barangayan'}
        </ThemedText>

        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.label} href={action.href} asChild>
              <Pressable style={styles.quickActionPressable}>
                <ThemedView type="backgroundElement" style={styles.quickActionIcon}>
                  <ThemedText style={styles.quickActionEmoji}>{action.icon}</ThemedText>
                </ThemedView>
                <ThemedText type="small" style={styles.quickActionLabel}>
                  {action.label}
                </ThemedText>
              </Pressable>
            </Link>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold">Active Requests</ThemedText>
          <Link href="/services" asChild>
            <Pressable>
              <ThemedText type="link">View All</ThemedText>
            </Pressable>
          </Link>
        </View>

        {!session ? (
          <GuestPrompt label="Log in to see your requests." />
        ) : requests.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="small" themeColor="textSecondary">
              No requests yet — tap "Request Document" to get started.
            </ThemedText>
          </ThemedView>
        ) : (
          requests.map((request) => (
            <Link key={request.id} href={`/services/requests/${request.id}`} asChild>
              <Pressable>
                <ThemedView type="backgroundElement" style={styles.requestRow}>
                  <View style={styles.requestInfo}>
                    <ThemedText type="smallBold">{request.document_types?.name ?? 'Document Request'}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Ref #{request.reference_number}
                    </ThemedText>
                  </View>
                  <ThemedText type="small" style={{ color: theme.primary }}>
                    {STATUS_LABEL[request.status] ?? request.status}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </Link>
          ))
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="smallBold">Latest Announcements</ThemedText>
          <Link href="/reports" asChild>
            <Pressable>
              <ThemedText type="link">View All</ThemedText>
            </Pressable>
          </Link>
        </View>

        {announcement ? (
          <ThemedView type="backgroundElement" style={styles.announcementCard}>
            {announcement.image_url ? (
              <Image source={{ uri: announcement.image_url }} style={styles.announcementImage} />
            ) : null}
            <View style={styles.announcementBody}>
              <ThemedText type="smallBold">{announcement.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
                {announcement.body}
              </ThemedText>
            </View>
          </ThemedView>
        ) : (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <ThemedText type="small" themeColor="textSecondary">
              No announcements yet.
            </ThemedText>
          </ThemedView>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  greetingName: {
    fontSize: 26,
    lineHeight: 30,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  quickActionPressable: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionEmoji: {
    fontSize: 22,
  },
  quickActionLabel: {
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  emptyCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  requestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
  requestInfo: {
    gap: Spacing.half,
  },
  announcementCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  announcementImage: {
    width: '100%',
    height: 140,
  },
  announcementBody: {
    padding: Spacing.three,
    gap: Spacing.half,
  },
});
