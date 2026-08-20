import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { AnnouncementsFeed } from './announcements-feed';

// Guest-accessible, like /home — announcements are public-read, not a security
// boundary (see home/page.tsx's comment on the same query). A guest sees the
// barangay-unscoped feed (no profile to scope by yet); a signed-in resident's feed
// is scoped to their own barangay.
export default async function AnnouncementsPage() {
  const { profile } = await getOptionalUser();
  return <AnnouncementsFeed barangayId={profile?.barangay_id ?? null} />;
}
