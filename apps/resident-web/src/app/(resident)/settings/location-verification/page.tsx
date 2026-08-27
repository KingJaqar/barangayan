import type { LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';

import { requireUser } from '@/lib/auth/require-user';
import { withBoundaryFallback } from '@/lib/barangay-boundary';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LocationVerificationForm } from './location-verification-form';

export const metadata = { title: 'Location Verification' };

export default async function LocationVerificationPage() {
  const { user, profile } = await requireUser();

  const supabase = await createSupabaseServerClient();
  const [{ data: barangay }, { data: residentProfile }] = await Promise.all([
    supabase.from('barangays').select('name, boundary').eq('id', profile.barangay_id).single(),
    supabase.from('profiles').select('verified_location, verified_location_address').eq('id', user.id).single(),
  ]);

  const barangayName = barangay?.name ?? profile.barangayName;

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Location Verification</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Drag the pin to your exact home location inside {barangayName}&apos;s boundary, then save.
        </p>
      </div>
      <LocationVerificationForm
        profileId={user.id}
        barangayName={barangayName}
        boundary={withBoundaryFallback((barangay?.boundary as Polygon | MultiPolygon | null) ?? null)}
        savedLocation={(residentProfile?.verified_location as LatLng | null) ?? null}
        savedAddress={residentProfile?.verified_location_address ?? null}
      />
    </div>
  );
}
