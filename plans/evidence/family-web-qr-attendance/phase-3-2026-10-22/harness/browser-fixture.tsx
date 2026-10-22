import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { FamilyContent } from '../../apps/resident-web/src/components/emergency/family-content';
import { HouseholdSection } from '../../apps/resident-web/src/app/(resident)/settings/profile/profile-form';
import { setNotificationSession } from '../../apps/resident-web/src/lib/notify';
const id = 'dfb21000-0000-4000-8000-000000000002';
function Fixture() {
  const [mode, setMode] = useState('family');
  const [profile, setProfile] = useState(id);
  Object.assign(window, { fixtureMode: setMode, fixtureProfile: setProfile });
  useEffect(() => { setNotificationSession(profile); }, [profile]);
  return <main style={{ maxWidth: 960, margin: 'auto', padding: 16 }}>
    {mode === 'profile' ? <HouseholdSection key={profile} profileId={profile} />
      : <FamilyContent profileId={mode === 'guest' ? null : profile} accountUnavailable={mode === 'setup'} residentName="Synthetic Family" />}
    <Toaster />
  </main>;
}
const element = document.getElementById('root');
if (element) createRoot(element).render(<StrictMode><Fixture /></StrictMode>);
