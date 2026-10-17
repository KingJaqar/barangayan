import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { serviceDocumentTypeValues } from '@barangayan/shared';
import { usePathname } from 'next/navigation';
import { SettingsIdStatusProvider } from '../src/app/(resident)/settings/settings-id-status';
import { SettingsSidebar } from '../src/app/(resident)/settings/settings-sidebar';
import { SettingsContent } from '../src/app/(resident)/settings/settings-content';
import { ValidIdFlow } from '../src/app/(resident)/settings/valid-id/valid-id-flow';
import { ProfileForm } from '../src/app/(resident)/settings/profile/profile-form';
import { ResidentServiceForm, VerificationNotice } from '../src/components/services/resident-service-form';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ResidentShell } from '@/components/shell/resident-shell';
import { ThemeControllerProvider } from '@/components/theme/theme-controller';
import bannerStyles from '@/components/auth/profile-completion-banner.module.css';
import * as photo from '../src/app/(resident)/settings/valid-id/photo';

window.__photoHelpers = photo;
const id = 'b1180000-0000-4000-8000-000000000001';
const profile = { id, first_name: 'Ana', last_name: 'Reyes', middle_name: '', suffix: '', sex: 'female', birth_date: '2000-02-29', email: 'fixture@example.test', mobile_number: '09171234567', house_no: '12', street: 'Main Street', city: 'San Mateo', province: 'Rizal', employment_status: 'student', occupation: '', avatar_url: null, barangay_id: 'fixture', household_members: [], email_verification_status: 'verified', barangays: { name: 'Fixture barangay' } };
const doc = { id, processing_target_hours: 1, ...serviceDocumentTypeValues({
  name: 'Synthetic service', description: '', feeCentavos: 0,
  catalog: { serviceKind: 'general', pricingMode: 'fixed', processingTargetMinutes: 15,
    charter: { officeDivision: 'Office', classification: 'Simple', transactionType: 'G2C', whoMayAvail: 'Residents', checklistOfRequirements: 'Approved ID', whereToSecureRequirements: 'Settings', clientSteps: 'Apply', agencyActions: 'Review', feesToBePaid: 'None', processingTime: '15 minutes', personResponsible: null },
    purposes: [{ code: 'general', label: 'General', requiresExplanation: false }],
    requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: false, personalAppearance: false },
  },
}) };
function Fixture() {
  const path = usePathname();
  const [client] = useState(createSupabaseBrowserClient);
  const legacyProps = path.includes('legacy') ? { profileHref: '/resident/profile#upload-valid-id' } : {};
  if (new URLSearchParams(location.search).get('layout') === '1') return <ThemeControllerProvider><ResidentShell barangayName="Fixture barangay" residentName="Ana Reyes" avatarUrl={null} isAuthenticated>
    {/* Server-rendered incomplete-profile notice with the production stylesheet. */}
    {new URLSearchParams(location.search).get('incomplete') === '1' ? <aside aria-label="Complete your resident profile" className={bannerStyles.banner}>
      <div className={bannerStyles.copy}><h2 className={bannerStyles.title}>Your next step: complete your profile</h2><p className={bannerStyles.description}>Browse freely. Complete your profile to request documents, join health services, and submit reports.</p></div>
      <a className={bannerStyles.action} href="/settings/profile">Complete profile</a>
    </aside> : null}
    <SettingsIdStatusProvider><div className="mx-auto flex max-w-7xl flex-col gap-6 lg:h-full lg:min-h-0 lg:w-full lg:flex-1 lg:flex-row">
      <SettingsSidebar emailVerified locationVerified isAuthenticated />
      <SettingsContent><ValidIdFlow userId={id} /></SettingsContent>
    </div></SettingsIdStatusProvider>
  </ResidentShell></ThemeControllerProvider>;
  return <SettingsIdStatusProvider><div className="mx-auto flex max-w-7xl flex-col gap-6 p-4 lg:h-screen lg:flex-row">
    <SettingsSidebar emailVerified locationVerified isAuthenticated />
    <SettingsContent>{path === '/settings/profile' ? <ProfileForm profile={location.search === '?incomplete=1' ? { ...profile, first_name: '', birth_date: null } : profile} barangayName="Fixture barangay" /> : path === '/settings/valid-id' ? <ValidIdFlow userId={id} /> : path.endsWith('/notice') || path.endsWith('/legacy-notice') ? <VerificationNotice client={client} {...legacyProps} /> : path.startsWith('/test/') ? <ResidentServiceForm doc={path.endsWith('/attachment') ? { ...doc, contract_version: 1 } : doc} client={client} onSubmitted={() => { throw new Error('This regression check must not submit a request.'); }} {...legacyProps} /> : <p>Settings</p>}</SettingsContent>
  </div><Toaster /></SettingsIdStatusProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
