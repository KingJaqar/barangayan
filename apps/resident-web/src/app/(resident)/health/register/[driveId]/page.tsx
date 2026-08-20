import { notFound } from 'next/navigation';

import { ApplicantForm } from '@/components/health/applicant-form';
import { requireUser } from '@/lib/auth/require-user';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { MedicalDrive } from '@/hooks/use-medical-drives';

/**
 * Applicant Registration [C-023] — real dynamic segment, an improvement over mobile's
 * `?driveId=` query param (per the plan's file-tree note). Resident-only.
 */
export default async function RegisterForDrivePage({ params }: { params: Promise<{ driveId: string }> }) {
  const { driveId } = await params;
  const { user, profile } = await requireUser();
  const supabase = await createSupabaseServerClient();

  const [{ data: drive }, { data: fullProfile }] = await Promise.all([
    supabase.from('medical_drives').select('*').eq('id', driveId).eq('is_active', true).is('deleted_at', null).single(),
    supabase.from('profiles').select('birth_date, home_address, household_members').eq('id', user.id).single(),
  ]);

  if (!drive) {
    notFound();
  }

  const householdMembers = Array.isArray(fullProfile?.household_members)
    ? (fullProfile!.household_members as { id: string; name: string; relation: string; role?: string }[])
    : [];

  return (
    <ApplicantForm
      drive={drive as MedicalDrive}
      residentName={profile.full_name}
      residentBirthDate={fullProfile?.birth_date ?? null}
      residentAddress={fullProfile?.home_address ?? null}
      householdMembers={householdMembers}
    />
  );
}
