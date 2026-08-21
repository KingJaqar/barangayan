'use client';

import { CheckCircle2, ChevronDown, ShieldCheck, Star } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { driveTypeConfig, useMedicalDrives, type MedicalDrive } from '@/hooks/use-medical-drives';

interface HouseholdMember {
  id: string;
  name: string;
  relation: string;
  role?: string;
}

type ApplicantSelection = { type: 'self' } | { type: 'member'; member: HouseholdMember };

const COMORBIDITY_OPTIONS = ['Hypertension', 'Diabetes', 'Immunocompromised', 'Pregnant', 'Allergy'] as const;

function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${mStr ?? '00'} ${period}`;
}

function computeAge(birthDate: string | null): number | null {
  if (!birthDate) return null;
  const [y, m, d] = birthDate.split('-').map(Number);
  const born = new Date(y, m - 1, d);
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const monthDiff = today.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < born.getDate())) age--;
  return age;
}

/** Registration form for a single medical drive [C-023] — web port of mobile's
 * ApplicantRegistrationScreen, trimmed of native-only chrome (no dose-history tabs; the
 * "2nd dose/booster" question collapses to a single prior-dose-date field). */
export function ApplicantForm({
  drive,
  residentName,
  residentBirthDate,
  residentAddress,
  householdMembers,
  onDone,
}: {
  drive: MedicalDrive;
  residentName: string;
  residentBirthDate: string | null;
  residentAddress: string | null;
  householdMembers: HouseholdMember[];
  /** Called instead of navigating to /health/my-registrations when the resident taps
   * "Done" on the confirmation screen — passed by RegisterDrawer so a successful
   * registration just closes the drawer and leaves the Active Drives list underneath in
   * place, instead of routing away from it. Standalone /health/register/[driveId] page
   * usage omits this and keeps the original navigate-away behavior. */
  onDone?: () => void;
}) {
  const router = useRouter();
  const { registerForDrive } = useMedicalDrives({ typeFilter: 'all', userId: null });
  const cfg = driveTypeConfig(drive.type);
  const fraction = drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0;

  const [selection, setSelection] = useState<ApplicantSelection>({ type: 'self' });
  const profileAge = selection.type === 'self' ? computeAge(residentBirthDate) : null;
  const [ageOverride, setAgeOverride] = useState('');
  const [isPwd, setIsPwd] = useState(false);
  const [comorbidities, setComorbidities] = useState<Set<string>>(new Set());
  const [hasPriorDose, setHasPriorDose] = useState(false);
  const [priorDoseDate, setPriorDoseDate] = useState('');
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<{ applicant_number: string; priority_score: number } | null>(null);

  const selectedName = selection.type === 'self' ? residentName : selection.member.name;
  const effectiveAge = profileAge ?? (ageOverride ? parseInt(ageOverride, 10) : null);

  const isFull = drive.stock_remaining <= 0;

  function toggleComorbidity(c: string) {
    setComorbidities((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  }

  async function handleSubmit() {
    if (!consented) {
      setSubmitError('Please check the consent box before registering.');
      return;
    }
    if (effectiveAge === null || Number.isNaN(effectiveAge) || effectiveAge < 0 || effectiveAge > 130) {
      setSubmitError('Please enter a valid age (0–130).');
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await registerForDrive({
        driveId: drive.id,
        age: effectiveAge,
        isPwd,
        comorbidities: Array.from(comorbidities),
        priorDoseDate: hasPriorDose && priorDoseDate ? priorDoseDate : null,
      });
      setResult({ applicant_number: res.applicant_number, priority_score: res.priority_score });
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const applicantOptions = useMemo<ApplicantSelection[]>(
    () => [{ type: 'self' }, ...householdMembers.map((member) => ({ type: 'member' as const, member }))],
    [householdMembers],
  );

  if (result) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-10 text-center">
        <CheckCircle2 size={56} className="text-primary" />
        <h1 className="text-xl font-extrabold text-primary">Registration Confirmed!</h1>
        <p className="text-sm text-muted-foreground">You&apos;re all set for the {drive.title}.</p>
        <div className="w-full rounded-2xl border border-primary/30 bg-primary/10 px-6 py-4">
          <p className="text-xs font-semibold text-primary">Your Applicant Number</p>
          <p className="text-2xl font-extrabold tracking-wide text-primary">{result.applicant_number}</p>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Star size={15} className="text-primary" /> Priority score: <span className="font-bold text-foreground">{result.priority_score} pts</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Please arrive on time at {drive.location} on {fmtShortDate(drive.drive_date)} between {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}.
        </p>
        <Button size="lg" className="w-full" onClick={() => (onDone ? onDone() : router.push('/health/my-registrations'))}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 pb-10">
      {/* Drive info */}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-base font-bold leading-snug">{drive.title}</h1>
          <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ backgroundColor: `${cfg.color}22`, color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          {fmtShortDate(drive.drive_date)} · {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)} · {drive.location}
        </p>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="font-bold">{drive.stock_label}</span>
          <span className="text-muted-foreground">
            {drive.stock_remaining} / {drive.stock_total} {drive.stock_unit}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-[#22C55E]" style={{ width: `${Math.round(fraction * 100)}%` }} />
        </div>
      </div>

      {/* Registering for */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Registering For</p>
        <div className="relative">
          <select
            aria-label="Registering for"
            className="w-full appearance-none rounded-xl border border-border bg-card px-4 py-3 pr-10 text-sm font-semibold"
            value={selection.type === 'self' ? 'self' : selection.member.id}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'self') {
                setSelection({ type: 'self' });
              } else {
                const member = householdMembers.find((m) => m.id === val);
                if (member) setSelection({ type: 'member', member });
              }
              setAgeOverride('');
            }}>
            {applicantOptions.map((opt) =>
              opt.type === 'self' ? (
                <option key="self" value="self">
                  {residentName} (Myself)
                </option>
              ) : (
                <option key={opt.member.id} value={opt.member.id}>
                  {opt.member.name} ({opt.member.relation})
                </option>
              ),
            )}
          </select>
          <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <dl className="flex flex-col divide-y divide-border text-sm">
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="font-semibold">{selectedName}</dd>
            </div>
            {selection.type === 'member' ? (
              <div className="flex items-center justify-between py-2">
                <dt className="text-muted-foreground">Relation</dt>
                <dd className="font-semibold">{selection.member.relation}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between py-2">
              <dt className="text-muted-foreground">Age</dt>
              {profileAge !== null ? (
                <dd className="font-semibold">{profileAge}</dd>
              ) : (
                <Input
                  aria-label="Age"
                  type="number"
                  min={0}
                  max={130}
                  className="h-8 w-24 text-right"
                  placeholder="Enter age"
                  value={ageOverride}
                  onChange={(e) => setAgeOverride(e.target.value)}
                />
              )}
            </div>
            {selection.type === 'self' && residentAddress ? (
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">Address</dt>
                <dd className="text-right font-semibold">{residentAddress}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </div>

      {/* Eligibility */}
      <div className="flex flex-col gap-2">
        <h2 className="text-base font-bold">Eligibility Information</h2>

        <div className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3">
          <Label htmlFor="pwd-toggle" className="text-sm font-medium">
            Person with Disability (PWD)?
          </Label>
          <input id="pwd-toggle" type="checkbox" className="h-5 w-5 accent-[color:var(--accent)]" checked={isPwd} onChange={(e) => setIsPwd(e.target.checked)} />
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2.5 text-sm font-bold">Comorbidities (select all that apply)</p>
          <div className="grid grid-cols-2 gap-2.5">
            {COMORBIDITY_OPTIONS.map((c) => (
              <label key={c} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="h-4 w-4 accent-[color:var(--accent)]" checked={comorbidities.has(c)} onChange={() => toggleComorbidity(c)} />
                {c}
              </label>
            ))}
          </div>

          <p className="mb-2 mt-4 text-sm font-bold">Prior Dose on File</p>
          <label className="mb-2 flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-[color:var(--accent)]" checked={hasPriorDose} onChange={(e) => setHasPriorDose(e.target.checked)} />
            I have received a prior dose for this vaccine
          </label>
          {hasPriorDose ? <Input type="date" value={priorDoseDate} onChange={(e) => setPriorDoseDate(e.target.value)} /> : null}
        </div>
      </div>

      {/* Consent */}
      <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={18} className="mt-0.5 shrink-0" />
          <p>This information is used only to determine allocation priority for this drive and is handled under the Barangay&apos;s Data Privacy Policy.</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" className="h-4 w-4 accent-[color:var(--accent)]" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
          I understand and consent
        </label>
      </div>

      {submitError ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{submitError}</div> : null}

      <Button size="lg" loading={submitting} disabled={isFull} onClick={handleSubmit}>
        {isFull ? 'No Slots Available' : 'Submit Registration'}
      </Button>
    </div>
  );
}
