import { Ionicons } from '@expo/vector-icons';
import type { Tables } from '@barangayan/shared';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { Avatar } from '@/components/avatar';
import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { GuestPrompt } from '@/components/guest-prompt';
import { NotificationBell } from '@/components/notification-bell';
import { SearchBar } from '@/components/search-bar';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name'> | null;
};
type Announcement = Tables<'announcements'>;

const QUICK_ACTIONS = [
  { label: 'Request Document', href: '/services' as const, icon: 'document-text-outline' as const },
  { label: 'Report Issue', href: '/reports' as const, icon: 'warning-outline' as const },
  { label: 'Emergency Info', href: '/home/emergency-info' as const, icon: 'medkit-outline' as const },
  { label: 'Medical Info', href: '/health' as const, icon: 'pulse-outline' as const },
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
    <View style={styles.screen}>
      <AppHeader />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.three }]}>
        <View style={styles.profileRow}>
          {session ? (
            <View style={styles.profileInfo}>
              <Avatar fullName={profile?.full_name ?? 'Resident'} size={56} />
              <View>
                <ThemedText type="smallBold" style={[styles.profileNameFont, { color: theme.primary }]}>
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
                <ThemedText type="smallBold" style={[styles.profileNameFont, { color: theme.primary }]}>
                  Login
                </ThemedText>
              </Pressable>
            </Link>
          )}
          <Link href="/reports?tab=announcements" asChild>
            <Pressable accessibilityLabel="View announcements" accessibilityRole="button">
              <NotificationBell />
            </Pressable>
          </Link>
        </View>

        <SearchBar />

        {/* Nonblocking deferred-verification notice — shown only to logged-in residents
            whose status is not yet verified. Never blocks any action. Once SMTP is
            available this becomes an active "Verify Email" entry point. */}
        {session && profile && profile.email_verification_status !== 'verified' ? (
          <ThemedView type="backgroundElement" style={styles.verificationBanner}>
            <Ionicons name="mail-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.verificationText}>
              Email verification is not yet available. You can manage this in Settings.
            </ThemedText>
          </ThemedView>
        ) : null}

        <View style={styles.quickActionsRow}>
          {QUICK_ACTIONS.map((action) => (
            <Link key={action.label} href={action.href} asChild>
              <Pressable style={styles.quickActionPressable}>
                <View
                  style={[
                    styles.quickActionIcon,
                    { backgroundColor: `${theme.primary}26`, borderColor: theme.primary },
                  ]}>
                  <Ionicons name={action.icon} size={22} color={theme.primary} />
                </View>
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
              No requests yet — tap &quot;Request Document&quot; to get started.
            </ThemedText>
          </ThemedView>
        ) : (
          <Card>
            {requests.map((request, index) => (
              <Fragment key={request.id}>
                <Link href={`/services/requests/${request.id}`} asChild>
                  <Pressable style={styles.requestRow}>
                    <ThemedView type="backgroundSelected" style={styles.requestIconBox}>
                      <Ionicons name="id-card-outline" size={18} color={theme.textSecondary} />
                    </ThemedView>
                    <View style={styles.requestInfo}>
                      <ThemedText type="smallBold">{request.document_types?.name ?? 'Document Request'}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        Ref #{request.reference_number}
                      </ThemedText>
                    </View>
                    <StatusBadge status={request.status} />
                  </Pressable>
                </Link>
                {index < requests.length - 1 ? <Divider /> : null}
              </Fragment>
            ))}
          </Card>
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
              <View style={styles.announcementImageWrap}>
                <Image source={{ uri: announcement.image_url }} style={styles.announcementImage} contentFit="cover" />
                <View style={[styles.categoryPill, { backgroundColor: theme.primary }]}>
                  <Ionicons name="people-outline" size={12} color={theme.onPrimary} />
                  <ThemedText type="small" style={{ color: theme.onPrimary }}>
                    {announcement.category}
                  </ThemedText>
                </View>
              </View>
            ) : null}
            <View style={styles.announcementBody}>
              <View style={styles.announcementMeta}>
                <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                <ThemedText type="small" themeColor="textSecondary">
                  {formatAnnouncementTimestamp(announcement.published_at)}
                </ThemedText>
              </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  profileNameFont: {
    fontFamily: Fonts.serif,
    fontSize: 16,
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
    width: 56,
    height: 56,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  verificationText: {
    flex: 1,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
  },
  requestIconBox: {
    width: 36,
    height: 36,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  announcementCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  announcementImageWrap: {
    position: 'relative',
  },
  announcementImage: {
    width: '100%',
    height: 140,
  },
  categoryPill: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
  },
  announcementBody: {
    padding: Spacing.three,
    gap: Spacing.half,
  },
  announcementMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
});
