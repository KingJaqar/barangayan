import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import type { Tables } from '@barangayan/shared';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { GuestPrompt } from '@/components/guest-prompt';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { getDocumentIcon } from '@/constants/document-icons';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
};
type Announcement = Tables<'announcements'>;

const QUICK_ACTIONS = [
  { label: 'Documents', description: 'Request a document', href: '/services' as const, icon: 'document-text-outline' as const },
  { label: 'Report', description: 'Report an issue', href: '/reports' as const, icon: 'warning-outline' as const },
  { label: 'Emergency', description: 'Emergency information', href: '/drrm' as const, icon: 'medkit-outline' as const },
  { label: 'Maps', description: 'Open barangay maps', href: '/maps' as const, icon: 'location-outline' as const },
  { label: 'Health', description: 'Open health services', href: '/health' as const, icon: 'heart-outline' as const },
];

/** "TODAY, 9:00 AM" for same-day announcements, else "AUG 6, 2026, 9:00 AM". Deliberately
 * not packages/shared's formatDateTime — that has no relative-day logic and the design
 * specifically calls for "TODAY". */
function formatAnnouncementTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  const time = new Intl.DateTimeFormat('en-PH', { timeStyle: 'short' }).format(date);
  const day = isToday
    ? 'TODAY'
    : new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(date).toUpperCase();
  return `${day}, ${time}`;
}

export default function HomeScreen() {
  const { session } = useAuth();
  const { profile } = useProfile();
  const theme = useTheme();
  const bottomTabInset = useFloatingTabInset();

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
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.contentWrapper, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomTabInset + Spacing.three }]}>
          <ProfileCompletionBanner />
        <View style={styles.profileRow}>
          {session ? (
            <View style={styles.profileInfo}>
              <Avatar
                fullName={profile?.full_name ?? 'Resident'}
                imageUrl={(profile as any)?.avatar_url ?? null}
                size={56}
              />
              <View style={styles.profileText}>
                <ThemedText type="smallBold" style={styles.profileNameFont}>
                  {profile?.full_name ?? 'Resident'}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {profile?.barangays?.name ?? 'Barangayan'}
                </ThemedText>
              </View>
            </View>
          ) : (
            <Link href="/(auth)/login" asChild>
              <Pressable style={styles.profileInfo}>
                <Avatar icon="person" color={theme.accentRed} size={56} />
                <ThemedText type="smallBold" style={styles.profileNameFont}>
                  Login
                </ThemedText>
              </Pressable>
            </Link>
          )}
        </View>

        <View style={styles.sectionIntro}>
          <ThemedText type="heading" style={styles.introTitle} accessibilityRole="header">How can we help?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Your barangay services, a tap away.
          </ThemedText>
        </View>
        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action, index) => (
            <Link key={action.label} href={action.href} asChild>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityHint={action.description}
                android_ripple={{ color: theme.backgroundSelected }}
                style={styles.quickActionPressable}>
                <View style={[styles.quickActionIcon, { backgroundColor: index === 0 ? theme.primary : theme.backgroundElement }]}>
                  <Ionicons name={action.icon} size={24} color={index === 0 ? theme.onPrimary : theme.primary} />
                </View>
                <ThemedText type="smallBold" style={styles.quickActionLabel}>
                  {action.label}
                </ThemedText>
              </Pressable>
            </Link>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <ThemedText type="heading" style={styles.sectionTitle} accessibilityRole="header">Active Requests</ThemedText>
          <Link href="/services" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="View all requests" style={styles.sectionLink}>
              <ThemedText type="smallBold" themeColor="primary">View All</ThemedText>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </Pressable>
          </Link>
        </View>

        {!session ? (
          <GuestPrompt label="Log in to see your requests." />
        ) : requests.length === 0 ? (
          <ThemedView type="backgroundElement" style={styles.emptyCard}>
            <Ionicons name="document-text-outline" size={28} color={theme.text} />
            <ThemedText type="smallBold">Your requests will appear here</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              No requests yet — tap &quot;Request Document&quot; to get started.
            </ThemedText>
          </ThemedView>
        ) : (
          <Card style={[styles.requestsCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
            {requests.map((request, index) => (
              <Fragment key={request.id}>
                <Link href={`/services/requests/${request.id}`} asChild>
                  <Pressable accessibilityRole="button" android_ripple={{ color: theme.backgroundSelected }} style={styles.requestRow}>
                    <View style={[styles.requestIconBox, { backgroundColor: theme.backgroundElement }]}>
                      <Ionicons name={getDocumentIcon(request.document_types?.name ?? '')} size={22} color={theme.primary} />
                    </View>
                    <View style={styles.requestInfo}>
                      <ThemedText type="smallBold" numberOfLines={2} ellipsizeMode="tail" style={styles.requestTitle}>
                        {request.document_types?.name ?? 'Document Request'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" style={styles.requestReference}>
                        Ref #{request.reference_number}
                      </ThemedText>
                      <View style={styles.requestStatus}>
                        <StatusBadge status={request.status} />
                        <View style={[styles.requestArrow, { backgroundColor: theme.primary }]}>
                          <Ionicons name="arrow-forward" size={16} color={theme.onPrimary} />
                        </View>
                      </View>
                    </View>
                  </Pressable>
                </Link>
                {index < requests.length - 1 ? <Divider /> : null}
              </Fragment>
            ))}
          </Card>
        )}

        <View style={styles.sectionHeader}>
          <ThemedText type="heading" style={styles.sectionTitle} accessibilityRole="header">Latest Announcements</ThemedText>
          <Link href="/announcements" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel="View all announcements" style={styles.sectionLink}>
              <ThemedText type="smallBold" themeColor="primary">View All</ThemedText>
              <Ionicons name="chevron-forward" size={16} color={theme.primary} />
            </Pressable>
          </Link>
        </View>

        {announcement ? (
          <ThemedView style={[styles.announcementCard, { borderColor: theme.backgroundSelected }]}>
            {announcement.image_url ? (
              <Image source={{ uri: announcement.image_url }} style={styles.announcementImage} contentFit="cover" />
            ) : null}
            <View style={styles.announcementBody}>
              <View style={[styles.categoryPill, { backgroundColor: theme.backgroundElement }]}>
                <Ionicons name="megaphone-outline" size={14} color={theme.primary} />
                <ThemedText type="smallBold" style={styles.categoryLabel}>
                  {announcement.category}
                </ThemedText>
              </View>
              <ThemedText type="heading" numberOfLines={2} ellipsizeMode="tail" style={styles.announcementTitle}>
                {announcement.title}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={2} style={styles.announcementPreview}>
                {announcement.body}
              </ThemedText>
              <View style={[styles.announcementMeta, { borderTopColor: theme.backgroundSelected }]}>
                <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.announcementMetaText}>
                  {formatAnnouncementTimestamp(announcement.published_at)}
                </ThemedText>
              </View>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  contentWrapper: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingTop: Spacing.four,
    gap: 12,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  profileText: {
    flex: 1,
  },
  profileNameFont: {
    fontSize: 18,
    lineHeight: 24,
  },
  sectionIntro: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  introTitle: {
    fontSize: 26,
    lineHeight: 34,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  quickActionPressable: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
    overflow: 'hidden',
    gap: Spacing.one,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  sectionTitle: {
    flex: 1,
  },
  sectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingLeft: Spacing.two,
  },
  emptyCard: {
    padding: 12,
    gap: Spacing.two,
    borderRadius: Spacing.three,
  },
  requestsCard: {
    borderWidth: 1,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
  },
  requestIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.half,
  },
  requestReference: {
    fontSize: 12,
    lineHeight: 16,
  },
  requestTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  requestStatus: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  requestArrow: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementCard: {
    borderRadius: Spacing.three,
    borderWidth: 1,
    overflow: 'hidden',
  },
  announcementImage: {
    width: '100%',
    aspectRatio: 2.4,
  },
  categoryPill: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
  },
  categoryLabel: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
    textTransform: 'capitalize',
  },
  announcementBody: {
    padding: 12,
    gap: 6,
  },
  announcementTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  announcementPreview: {
    lineHeight: 20,
  },
  announcementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  announcementMetaText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
  },
});
