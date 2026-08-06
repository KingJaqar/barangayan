import { PlaceholderPanel } from '@/components/placeholder-panel';

// One light exception per the 30% milestone: this can show the real logged-in user's
// name/email once Auth lands (essentially free), but isn't editable yet — the rest of
// Profile (household info, ID upload, Save Changes) is static/mock for now.
export default function ProfileScreen() {
  return <PlaceholderPanel label="Profile (name, household info, ID) goes here." />;
}
