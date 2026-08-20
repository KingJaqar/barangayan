'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, MapPin, Calendar, RefreshCw, Users, Info, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Expand, X, Loader2, Trash2, Check, CircleDashed,
} from 'lucide-react';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { uniqueChannelName } from '@/lib/realtime-channel';
import { incidentStatusMeta } from '@/constants/incident-status';
import { renderIonicon } from '@/lib/ionicon-map';
import { IncidentLocationMapWrapper } from '@/components/reports/incident-location-map-wrapper';

type IncidentCategoryRow = { id: string; name: string; color: string | null; icon: string | null };

export interface IncidentDetailData {
  id: string;
  title: string;
  description: string | null;
  status: string;
  photo_urls: string[];
  created_at: string;
  updated_at: string;
  confirmation_count: number;
  resolved_read_at: string | null;
  address: string | null;
  specific_area_details: string | null;
  location: { lat: number; lng: number } | null;
  incident_categories: IncidentCategoryRow | null;
}

// Date + time, not date-only — mirrors mobile's `fmt()` ([incidentId].tsx) so a resident
// sees *when* a report was filed or last moved, not just which day.
function fmt(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  return `${date} · ${time}`;
}

/** Returns true if the incident was created less than 24 hours ago. */
function isWithinWithdrawWindow(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000;
}

const CARD = 'rounded-2xl border border-black/8 bg-white p-4 shadow-sm dark:border-white/8 dark:bg-zinc-900';

// ─── Info row ──────────────────────────────────────────────────────────────

function InfoRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-[26px] flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

// ─── Photo carousel + lightbox ────────────────────────────────────────────

function PhotoCarousel({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  if (urls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setLightbox(true)}
        aria-label="View photo full-screen"
        className="relative block h-56 w-full overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 sm:h-72">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={urls[index]} alt={`Photo ${index + 1} of ${urls.length}`} className="h-full w-full object-contain" />
        <span className="absolute bottom-2 right-2 flex size-[30px] items-center justify-center rounded-full bg-black/55 text-white">
          <Expand size={15} />
        </span>
      </button>

      {urls.length > 1 && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            aria-label="Previous photo"
            disabled={index === 0}
            onClick={() => setIndex((i) => i - 1)}
            className="flex size-7 items-center justify-center text-muted-foreground disabled:opacity-20">
            <ChevronLeft size={20} />
          </button>
          <div className="flex flex-1 items-center justify-center gap-1.5">
            {urls.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Photo ${i + 1}`}
                onClick={() => setIndex(i)}
                className={`h-[7px] rounded-full transition-all ${i === index ? 'w-[18px] bg-[var(--accent)]' : 'w-[7px] bg-muted'}`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next photo"
            disabled={index === urls.length - 1}
            onClick={() => setIndex((i) => i + 1)}
            className="flex size-7 items-center justify-center text-muted-foreground disabled:opacity-20">
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setLightbox(false)}
            className="absolute right-4 top-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20">
            <X size={18} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[index]} alt={`Photo ${index + 1} of ${urls.length}`} className="max-h-full max-w-full object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}

// ─── Status timeline ───────────────────────────────────────────────────────

// The linear happy path — mirrors mobile's INCIDENT_STEP_ORDER ([incidentId].tsx).
const STEP_ORDER = ['open', 'in_progress', 'resolved'] as const;
const STEP_LABEL: Record<string, string> = { open: 'Report Submitted', in_progress: 'In Progress', resolved: 'Resolved' };

function StatusTimeline({ incident }: { incident: IncidentDetailData }) {
  const isStopped = incident.status === 'withdrawn' || incident.status === 'unresolved';
  const currentStepIndex = isStopped ? -1 : STEP_ORDER.indexOf(incident.status as typeof STEP_ORDER[number]);

  return (
    <div className={CARD}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status History</p>
      <div className="flex flex-col">
        {STEP_ORDER.map((step, i) => {
          const isDone = i <= currentStepIndex && !isStopped;
          const isCurrent = step === incident.status;
          const isLast = i === STEP_ORDER.length - 1;
          const timeLabel = step === 'open' ? fmt(incident.created_at) : isCurrent ? fmt(incident.updated_at) : null;

          return (
            <div key={step} className="flex gap-2.5">
              <div className="flex flex-col items-center">
                <div
                  className={`flex size-[30px] flex-shrink-0 items-center justify-center rounded-full ${
                    isDone ? 'bg-[var(--accent)] text-white' : 'border border-muted-foreground bg-muted text-transparent'
                  }`}>
                  {isDone && <Check size={14} />}
                </div>
                {!isLast && <div className={`w-0.5 flex-1 ${i < currentStepIndex && !isStopped ? 'bg-[var(--accent)]' : 'bg-muted'}`} />}
              </div>
              <div className={`flex flex-col gap-0.5 ${isLast ? '' : 'pb-4'}`}>
                <span className={`text-sm ${isCurrent ? 'font-bold text-[var(--accent)]' : isDone ? 'font-semibold' : 'text-muted-foreground'}`}>
                  {STEP_LABEL[step]}
                </span>
                <span className="text-xs text-muted-foreground">{timeLabel ?? (isDone ? 'Completed' : 'Pending')}</span>
              </div>
            </div>
          );
        })}
      </div>

      {isStopped && (
        <p className={`mt-1 text-xs ${incident.status === 'unresolved' ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
          {incident.status === 'withdrawn'
            ? `Withdrawn by the reporter · ${fmt(incident.updated_at)}`
            : `Closed as unresolved by the barangay · ${fmt(incident.updated_at)}`}
        </p>
      )}
    </div>
  );
}

// ─── Withdraw button ───────────────────────────────────────────────────────

function WithdrawButton({ incidentId, onDone }: { incidentId: string; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleWithdraw() {
    setLoading(true);
    setConfirming(false);
    const supabase = createSupabaseBrowserClient();
    // The 24h window is enforced INSIDE the RPC — the client check above is UX only.
    const { error } = await supabase.rpc('withdraw_incident', { p_incident_id: incidentId });
    setLoading(false);
    if (error) { toast.error(`Could not withdraw: ${error.message}`); return; }
    toast.success('Report withdrawn. The barangay will no longer act on it.');
    onDone();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Withdraw this report? This action cannot be undone.</span>
        <button
          type="button"
          disabled={loading}
          onClick={handleWithdraw}
          className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 hover:bg-red-700">
          {loading ? <Loader2 size={12} className="inline animate-spin" /> : 'Yes, withdraw'}
        </button>
        <button type="button" onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:underline">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex w-full items-center justify-center gap-2 rounded-full border-[1.5px] border-red-500 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
      <Trash2 size={16} />
      Withdraw report
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function IncidentDetail({ incident: initial }: { incident: IncidentDetailData }) {
  const router = useRouter();
  const [incident, setIncident] = useState(initial);
  const cancelledRef = useRef(false);

  const refetch = useCallback(() => {
    const supabase = createSupabaseBrowserClient();
    supabase
      .from('incidents')
      .select(`
        id, title, description, status, photo_urls, created_at, updated_at, confirmation_count,
        resolved_read_at, address, specific_area_details, location, deleted_at,
        incident_categories(id, name, color, icon)
      `)
      .eq('id', initial.id)
      .single()
      .then(({ data }) => {
        if (!cancelledRef.current && data) setIncident(data as unknown as IncidentDetailData);
      });
  }, [initial.id]);

  // Realtime subscription — updates status badge, timeline and confirmation count live.
  useEffect(() => {
    cancelledRef.current = false;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(uniqueChannelName(`incident-detail:${initial.id}`))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'incidents', filter: `id=eq.${initial.id}` }, () => {
        if (!cancelledRef.current) refetch();
      })
      .subscribe();

    return () => {
      cancelledRef.current = true;
      supabase.removeChannel(channel);
    };
  }, [initial.id, refetch]);

  const meta = incidentStatusMeta(incident.status);
  const category = incident.incident_categories;

  // This route only ever loads the signed-in resident's OWN reports (page.tsx filters by
  // reporter_id), so — same as mobile's `isOwn` guard — withdrawal is the only action
  // ever available here, never "confirm" (that's reserved for other residents' reports).
  const canWithdraw = incident.status === 'open' && isWithinWithdrawWindow(incident.created_at);
  const windowClosed = incident.status === 'open' && !isWithinWithdrawWindow(incident.created_at);
  const isWithdrawn = incident.status === 'withdrawn';

  const loc = incident.location;

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <Link href="/reports" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={15} />
        Back to My Reports
      </Link>

      {/* Photos */}
      <PhotoCarousel urls={incident.photo_urls} />

      {/* Header card: title + status, category, description */}
      <div className={CARD}>
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-lg font-bold leading-snug tracking-tight">{incident.title}</h1>
          <span className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${meta.className}`}>
            {meta.label}
          </span>
        </div>

        {category && (
          <div
            className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
            style={{ backgroundColor: `${category.color ?? 'var(--accent)'}20`, color: category.color ?? 'var(--accent)' }}>
            {renderIonicon(category.icon, { size: 13, color: category.color ?? 'var(--accent)' })}
            {category.name}
          </div>
        )}

        {incident.description && (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{incident.description}</p>
        )}
      </div>

      {/* Location card: map, address, coordinates, specific area details */}
      {(loc || incident.address || incident.specific_area_details) && (
        <div className={`${CARD} flex flex-col gap-2.5`}>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Location</p>

          {loc && <IncidentLocationMapWrapper position={loc} />}

          {incident.address && (
            <InfoRow icon={<MapPin size={13} />}>
              <span>{incident.address}</span>
            </InfoRow>
          )}

          {loc && (
            <p className="ml-[34px] text-xs text-muted-foreground">
              {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
            </p>
          )}

          {incident.specific_area_details && (
            <InfoRow icon={<Info size={13} />}>
              <span className="italic">&ldquo;{incident.specific_area_details}&rdquo;</span>
            </InfoRow>
          )}
        </div>
      )}

      {/* Meta card: reported / last updated / confirmations */}
      <div className={`${CARD} flex flex-col gap-3`}>
        <InfoRow icon={<Calendar size={13} />}>
          <span>Reported on {fmt(incident.created_at)}</span>
        </InfoRow>

        {incident.updated_at !== incident.created_at && (
          <InfoRow icon={<RefreshCw size={13} />}>
            <span>Last updated {fmt(incident.updated_at)}</span>
          </InfoRow>
        )}

        <InfoRow icon={<Users size={13} />}>
          <span>
            {incident.confirmation_count === 0
              ? 'No confirmations yet'
              : `${incident.confirmation_count} resident${incident.confirmation_count !== 1 ? 's' : ''} confirmed this report`}
          </span>
        </InfoRow>
      </div>

      {/* Status History */}
      <StatusTimeline incident={incident} />

      {/* Actions */}
      {canWithdraw && (
        <WithdrawButton incidentId={incident.id} onDone={() => { refetch(); router.refresh(); }} />
      )}

      {windowClosed && (
        <p className="px-2 text-center text-xs leading-relaxed text-muted-foreground">
          The 24-hour window for withdrawing this report has closed. Contact the barangay office if it needs to be cancelled.
        </p>
      )}

      {isWithdrawn && (
        <div className={`${CARD} flex items-center gap-2.5 py-3`}>
          <XCircle size={18} className="flex-shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            You withdrew this report. It stays on record but the barangay will not act on it.
          </span>
        </div>
      )}

      {incident.status === 'resolved' && (
        <div className={`${CARD} flex items-center gap-2.5 py-3`} style={{ borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' }}>
          <CheckCircle2 size={18} className="flex-shrink-0 text-[var(--accent)]" />
          <span className="text-sm font-semibold text-[var(--accent)]">This incident has been resolved by the barangay.</span>
        </div>
      )}

      {incident.status === 'unresolved' && (
        <div className={`${CARD} flex items-center gap-2.5 py-3`}>
          <CircleDashed size={18} className="flex-shrink-0 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">This report was closed as unresolved by the barangay.</span>
        </div>
      )}
    </div>
  );
}
