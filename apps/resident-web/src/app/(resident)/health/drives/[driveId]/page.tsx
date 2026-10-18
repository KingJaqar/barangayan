import { ArrowLeft, CalendarDays, Heart, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ReadFailure } from '@/components/shared/read-failure';
import { Button } from '@/components/ui/button';
import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const metadata = { title: 'Medical drive' };

export default async function MedicalDriveDetailPage({ params }: { params: Promise<{ driveId: string }> }) {
  const { driveId } = await params;
  const { user, profile } = await getOptionalUser();
  if (user && !profile) return <ReadFailure resultId={crypto.randomUUID()} contentName="your barangay information" message="We couldn't load your barangay information." />;
  const supabase = await createSupabaseServerClient();
  let query = supabase.from('medical_drives').select('id,title,drive_date,time_start,time_end,location,eligible_criteria,stock_remaining,stock_unit').eq('id', driveId).eq('is_active', true).is('deleted_at', null);
  if (profile) query = query.eq('barangay_id', profile.barangay_id);
  const { data: drive, error } = await query.maybeSingle();
  if (error) return <ReadFailure resultId={crypto.randomUUID()} contentName="this medical drive" message="We couldn't load this medical drive." />;
  if (!drive) notFound();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const canRegister = drive.stock_remaining > 0 && drive.drive_date >= today;
  const registrationHref = `/health/register/${drive.id}`;
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/health" className="mb-5 inline-flex min-h-8 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft aria-hidden size={16} /> All medical drives</Link>
      <article className="rounded-2xl border border-border bg-card p-5 sm:p-8">
        <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-primary"><Heart aria-hidden size={18} strokeWidth={1.75} /> Medical drive</p>
        <h1 className="break-words text-2xl font-bold tracking-tight">{drive.title}</h1>
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><CalendarDays aria-hidden size={17} />{drive.drive_date} · {drive.time_start.slice(0, 5)}–{drive.time_end.slice(0, 5)}</p>
        <p className="mt-3 flex items-start gap-2 break-words text-sm text-muted-foreground"><MapPin aria-hidden size={17} className="shrink-0" />{drive.location || 'Location to be announced'}</p>
        <h2 className="mt-6 text-base font-semibold">Who can join?</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7">{drive.eligible_criteria}</p>
        <p className="mt-4 text-sm text-muted-foreground">{drive.stock_remaining} {drive.stock_unit} remaining</p>
        <div className="mt-6">{canRegister ? <Button asChild><Link href={user ? registrationHref : `/login?next=${encodeURIComponent(registrationHref)}`}>{user ? 'Register for this drive' : 'Log in to register'}</Link></Button> : <p className="text-sm font-semibold text-muted-foreground">{drive.drive_date < today ? 'This drive has ended.' : 'This drive is full.'}</p>}</div>
      </article>
    </div>
  );
}
