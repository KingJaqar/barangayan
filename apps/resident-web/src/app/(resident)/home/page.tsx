import { formatDateTime } from '@barangayan/shared';
import { ArrowRight, Bell, FileText, Inbox, TriangleAlert, HeartPulse, Megaphone } from 'lucide-react';
import Link from 'next/link';

import { EmailVerifyBanner } from '@/components/home/email-verify-banner';
import { GuestHero } from '@/components/home/guest-hero';
import { HomeSearchBar } from '@/components/home/home-search-bar';
import { LandingCta, LandingFeatures } from '@/components/home/landing-features';
import { LandingFooter } from '@/components/home/landing-footer';
import { LatestAnnouncementCard } from '@/components/home/latest-announcement-card';
import { QuickActionTile } from '@/components/home/quick-action-tile';
import styles from '@/components/home/home.module.css';
import { ReadFailure } from '@/components/shared/read-failure';
import { StatusPill } from '@/components/shared/status-pill';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const GUEST_HIGHLIGHTS = [
  { title: 'Request Documents', body: 'Apply for barangay clearances and certificates online.', icon: FileText },
  { title: 'Report Incidents', body: 'Notify authorities about non-emergency community issues.', icon: Megaphone },
  { title: 'Stay Informed', body: 'Get trusted updates directly from your barangay administrators.', icon: Bell },
] as const;

/**
 * The website's landing page (the root `/` route redirects straight here) — for a
 * guest this IS the marketing/entry surface, not a screen behind a forced onboarding
 * wizard; for a signed-in resident it's their dashboard. Both states share this one
 * route via getOptionalUser() (never requireUser() — see the plan's §4 Route Contract
 * Matrix: a requireUser() mistake here would break guest browsing entirely).
 *
 * Migrated + extended from apps/admin-web/src/app/resident/page.tsx (real, working
 * Promise.all queries against service_requests/incidents — kept as-is).
 */
export default async function ResidentHomePage() {
  const { user, profile } = await getOptionalUser();
  const supabase = await createSupabaseServerClient();

  // Each read's error is kept so a failed read shows a retryable notice instead of an
  // empty state. The email-status banner is informational and simply stays hidden.
  const [
    { data: recentRequests, error: requestsError },
    { data: recentReports, error: reportsError },
    { data: latestAnnouncement, error: announcementError },
    { data: emailStatusRow },
  ] = await Promise.all([
    user
      ? supabase
          .from('service_requests')
          .select('id, reference_number, status, created_at, document_types(name)')
          .eq('resident_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null, error: null }),
    user
      ? supabase
          .from('incidents')
          .select('id, title, status, created_at')
          .eq('reporter_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null, error: null }),
    // Soft default for guests (no barangay context to scope by yet) — barangay-scoped
    // for a signed-in resident. Not a security boundary: announcements are public-read.
    profile
      ? supabase
          .from('announcements')
          .select('id, title, body, category, published_at')
          .eq('barangay_id', profile.barangay_id)
          .is('deleted_at', null)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : supabase
          .from('announcements')
          .select('id, title, body, category, published_at')
          .is('deleted_at', null)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
    user ? supabase.from('profiles').select('email_verification_status').eq('id', user.id).single() : Promise.resolve({ data: null, error: null }),
  ]);

  if (!user) {
    return (
      <div className={styles.home}>
        <GuestHero />

        <div className={styles.highlights}>
          {GUEST_HIGHLIGHTS.map(({ title, body, icon: Icon }) => (
            <section key={title} className={styles.highlight}>
              <div className={styles.actionIcon}>
                <Icon aria-hidden size={20} strokeWidth={1.75} />
              </div>
              <h2>{title}</h2>
              <p className={styles.actionDescription}>{body}</p>
            </section>
          ))}
        </div>

        <LandingFeatures />

        {latestAnnouncement || announcementError ? <LatestAnnouncement announcement={latestAnnouncement ?? null} failed={announcementError !== null} /> : null}

        <LandingCta />

        <LandingFooter barangayName={null} />
      </div>
    );
  }

  return (
    <div className={`${styles.home} ${styles.dashboard}`}>
      <div className={`${styles.hero} ${styles.dashboardHero}`}>
        <HomeSearchBar />
      </div>

      {emailStatusRow ? <EmailVerifyBanner status={emailStatusRow.email_verification_status} /> : null}

      <section aria-labelledby="quick-actions-title" className={styles.shortcuts}>
        <div className={styles.sectionHeader}>
          <h2 id="quick-actions-title">How can we help?</h2>
        </div>
        <div className={styles.actions}>
          <QuickActionTile href="/services/documents" icon={FileText} label="Request a Document" description="Barangay clearance, certificates, and more." />
          <QuickActionTile href="/services/requests" icon={Inbox} label="My Requests" description="Track the status of everything you've requested." />
          <QuickActionTile href="/reports/new" icon={TriangleAlert} label="Report an Incident" description="Flag a hazard, dispute, or concern in your barangay." />
          <QuickActionTile href="/health" icon={HeartPulse} label="Medical Drives" description="Register for vaccination and medical drives." />
        </div>
      </section>

      <div className={styles.dashboardLayout}>
        <section aria-labelledby="community-updates-title" className={styles.feed}>
          <div className={styles.sectionHeader}>
            <h2 id="community-updates-title">Community updates</h2>
            <Link href="/announcements" className={styles.textLink}>View all <ArrowRight aria-hidden size={13} /></Link>
          </div>
          <LatestAnnouncement announcement={latestAnnouncement ?? null} failed={announcementError !== null} />
        </section>

        <section aria-labelledby="recent-activity-title" className={styles.activitySidebar}>
          <div className={styles.sectionHeader}>
            <h2 id="recent-activity-title">Your recent activity</h2>
            <p className={styles.sectionHint}>The latest on your requests and reports.</p>
          </div>
          <div className={styles.activity}>
            <section aria-labelledby="recent-requests-title" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 id="recent-requests-title"><Inbox aria-hidden size={17} /> Recent Requests</h3>
                <Link href="/services/requests" className={styles.textLink}>
                  View all <ArrowRight aria-hidden size={13} />
                </Link>
              </div>
              <div className={styles.panelBody}>
                {requestsError ? (
                  <ReadFailure message="We couldn't load your recent requests." />
                ) : recentRequests && recentRequests.length > 0 ? (
                  <ul>
                    {recentRequests.map((r) => (
                      <li key={r.id}>
                        <Link href={`/services/requests/${r.id}`} className={styles.activityRow}>
                          <div className="min-w-0">
                            <p className={styles.rowTitle}>{r.document_types?.name ?? 'Document Request'}</p>
                            <p className={styles.rowMeta}>
                              {r.reference_number} · {formatDateTime(r.created_at)}
                            </p>
                          </div>
                          <span className={styles.rowStatus}><StatusPill status={r.status} /></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.empty}>
                    <span className={styles.emptyIcon}><FileText aria-hidden size={18} /></span>
                    <p className={styles.emptyTitle}>No requests yet.</p>
                    <p className={styles.emptyDescription}>Your document requests and their status will appear here.</p>
                    <Link href="/services/documents" className={styles.textLink}>Request a document <ArrowRight aria-hidden size={14} /></Link>
                  </div>
                )}
              </div>
            </section>

            <section aria-labelledby="recent-reports-title" className={styles.panel}>
              <div className={styles.panelHeader}>
                <h3 id="recent-reports-title"><TriangleAlert aria-hidden size={17} /> Recent Reports</h3>
                <Link href="/reports" className={styles.textLink}>
                  View all <ArrowRight aria-hidden size={13} />
                </Link>
              </div>
              <div className={styles.panelBody}>
                {reportsError ? (
                  <ReadFailure message="We couldn't load your recent reports." />
                ) : recentReports && recentReports.length > 0 ? (
                  <ul>
                    {recentReports.map((r) => (
                      <li key={r.id} className={styles.activityRow}>
                        <div className="min-w-0">
                          <p className={styles.rowTitle}>{r.title}</p>
                          <p className={styles.rowMeta}>{formatDateTime(r.created_at)}</p>
                        </div>
                        <span className={styles.rowStatus}><StatusPill status={r.status} /></span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className={styles.empty}>
                    <span className={styles.emptyIcon}><TriangleAlert aria-hidden size={18} /></span>
                    <p className={styles.emptyTitle}>No reports yet.</p>
                    <p className={styles.emptyDescription}>Keep track of community concerns you&apos;ve reported.</p>
                    <Link href="/reports/new" className={styles.textLink}>Report an incident <ArrowRight aria-hidden size={14} /></Link>
                  </div>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      <LandingFooter barangayName={profile?.barangayName ?? null} />
    </div>
  );
}

function LatestAnnouncement({ announcement, failed }: { announcement: Parameters<typeof LatestAnnouncementCard>[0]['announcement']; failed: boolean }) {
  if (failed) {
    return (
      <div className={`${styles.announcement} ${styles.announcementReadFailure}`}>
        <ReadFailure message="We couldn't load the latest announcement." />
      </div>
    );
  }
  return <LatestAnnouncementCard announcement={announcement} />;
}
