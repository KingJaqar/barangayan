import { DirectoryContent } from '@/components/maps/directory-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * Directory — a full, searchable listing of the barangay's emergency contacts. Mobile's
 * `hotline-directory.tsx` is an unlinked, empty `PlaceholderPanel` stub (a content gap,
 * not an engineering one — see the plan's §5 Parity Matrix and file-tree legend), and
 * `emergency_information.category` only has two real values in this schema
 * ('guidelines', 'hotlines' — migration 0047) — there is no separate "directory" table
 * to source from. This reuses the same real `hotlines` data Emergency Hub already shows
 * (useEmergencyHotlines [C-013]), as a dedicated, searchable, full-page directory rather
 * than the Hub's condensed card. Guest-accessible, matching Hub/Centers/Alerts.
 */
export default async function MapsDirectoryPage() {
  const { profile } = await getOptionalUser();

  return <DirectoryContent barangayId={profile?.barangay_id ?? null} />;
}
