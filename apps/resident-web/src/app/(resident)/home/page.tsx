import { formatDateTime } from '@barangayan/shared';
import { Bell, FileText, Inbox, TriangleAlert, HeartPulse, Megaphone } from 'lucide-react';
import Link from 'next/link';

import { EmailVerifyBanner } from '@/components/home/email-verify-banner';
import { GuestHero } from '@/components/home/guest-hero';
import { HomeSearchBar } from '@/components/home/home-search-bar';
import { LatestAnnouncementCard } from '@/components/home/latest-announcement-card';
import { QuickActionTile } from '@/components/home/quick-action-tile';
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

  const [{ data: recentRequests }, { data: recentReports }, { data: latestAnnouncement }, { data: emailStatusRow }] = await Promise.all([
    user
      ? supabase
          .from('service_requests')
          .select('id, reference_number, status, created_at, document_types(name)')
          .eq('resident_id', user.id)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
    user
      ? supabase
          .from('incidents')
          .select('id, title, status, created_at')
          .eq('reporter_id', user.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(5)
      : Promise.resolve({ data: null }),
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
    user ? supabase.from('profiles').select('email_verification_status').eq('id', user.id).single() : Promise.resolve({ data: null }),
  ]);

  if (!user) {
    return (
      <div className="mx-auto max-w-5xl">
        <GuestHero />

        <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {GUEST_HIGHLIGHTS.map(({ title, body, icon: Icon }) => (
            <div key={title} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Icon size={20} strokeWidth={1.75} />
              </div>
              <p className="font-semibold">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <LatestAnnouncementCard announcement={latestAnnouncement ?? null} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Welcome back, {profile!.full_name.split(' ')[0]}</h1>
        <p className="text-sm text-muted-foreground">Request documents, report incidents, and track their status here.</p>
      </div>

      <HomeSearchBar />

      {emailStatusRow ? <EmailVerifyBanner status={emailStatusRow.email_verification_status} /> : null}

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickActionTile href="/services/documents" icon={FileText} label="Request a Document" description="Barangay clearance, certificates, and more." />
        <QuickActionTile href="/services/requests" icon={Inbox} label="My Requests" description="Track the status of everything you've requested." />
        <QuickActionTile href="/reports/new" icon={TriangleAlert} label="Report an Incident" description="Flag a hazard, dispute, or concern in your barangay." />
        <QuickActionTile href="/health" icon={HeartPulse} label="Medical Drives" description="Register for vaccination and medical drives." />
      </div>

      <LatestAnnouncementCard announcement={latestAnnouncement ?? null} />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Requests</h2>
            <Link href="/services/requests" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {recentRequests && recentRequests.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recentRequests.map((r) => (
                <li key={r.id}>
                  <Link href={`/services/requests/${r.id}`} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{r.document_types?.name ?? 'Document Request'}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.reference_number} · {formatDateTime(r.created_at)}
                      </p>
                    </div>
                    <StatusPill status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No requests yet.</p>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Recent Reports</h2>
            <Link href="/reports" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          {recentReports && recentReports.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}</p>
                  </div>
                  <StatusPill status={r.status} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
