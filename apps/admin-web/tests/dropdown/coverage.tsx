import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ToastProvider } from '../../src/components/ui/toast';
import { ProfileForm } from '../../src/app/resident/profile/profile-form';
import { IdUpload } from '../../src/app/resident/profile/id-upload';
import { NewRequestForm } from '../../src/app/resident/requests/new/new-request-form';
import { MemberFormModal } from '../../src/app/(admin)/households-residents/member-form-modal';
import { ApplicantDetailModal } from '../../src/app/(admin)/health/applicants/applicant-detail-modal';
import { QrInstructionsModal } from '../../src/app/(admin)/emergency-qr/qr-instructions-modal';
import { ArchivedContentRecords } from '../../src/app/(admin)/archive/[screen]/content-records';
import { contentArchiveConfig, type ContentArchiveSection } from '../../src/lib/admin-tables/archive-sections';
import { parseBrowseState, queryIdentity } from '../../src/lib/admin-tables/browse-state';
import { Header } from '../../src/components/admin/header';
import { AdminSuggestions } from '../../src/components/admin/dropdown/admin-suggestions';

function Coverage() {
  const mode = new URLSearchParams(location.search).get('mode');
  const [modal, setModal] = useState('');
  const [writes, setWrites] = useState(0);
  const [reference, setReference] = useState('');
  if (mode === 'archive') {
    const name = (new URLSearchParams(location.search).get('section') ?? 'services') as ContentArchiveSection;
    const state = parseBrowseState(new URLSearchParams(location.search), contentArchiveConfig(name));
    return <ArchivedContentRecords name={name} label={name} requestedState={state} result={{ status: 'success', value: {
      state, queryIdentity: queryIdentity(state), total: 1, rows: [{ id: 'content-1', title: 'Fixture archived content', description: 'Read-only archive', archivedAt: '2026-10-14T08:00:00Z', details: {} }],
    } }} />;
  }
  if (mode === 'popups') return <>
    <Header barangayName="Fixture Barangay" adminName="Fixture Admin" barangayId="fixture-barangay" sidebarCollapsed={false}
      onToggleSidebar={() => {}} onLogout={() => setWrites(current => current + 1)} />
    <label>Free reference<AdminSuggestions aria-label="Free reference" value={reference} onValueChange={setReference} options={['REQ-2026-00001', 'REQ-2026-00002']} /></label>
    <output data-testid="reference">{reference}</output><output data-testid="popup-calls">{writes}</output>
  </>;
  return <>
    <ProfileForm profile={{ id: 'fixture-profile', first_name: 'Fixture', last_name: 'Resident', middle_name: null, suffix: null, sex: 'female',
      email: 'fixture@example.test', mobile_number: '09171234567', house_no: '1', street: 'Fixture Street', city: 'San Mateo', province: 'Rizal',
      employment_status: 'student', occupation: 'Student', id_verification_status: 'unverified', barangays: { name: 'Fixture Barangay' } }} />
    <IdUpload /><NewRequestForm documentTypes={[]} />
    <button onClick={() => setModal('member')}>Fixture member modal</button><button onClick={() => setModal('applicant')}>Fixture applicant modal</button>
    <button onClick={() => setModal('qr')}>Fixture QR instructions</button>
    <output data-testid="compatibility-writes">{writes}</output>
    {modal === 'member' && <div data-testid="member-modal"><MemberFormModal mode="add" profileId="fixture-profile" members={[]} onClose={() => setModal('')}
      onSubmit={async () => { setWrites(current => current + 1); }} /></div>}
    {modal === 'applicant' && <ApplicantDetailModal row={{ id: 'fixture-applicant', drive_id: 'fixture-drive', user_id: 'fixture-profile', applicant_number: 'AP-001',
      age: 26, is_pwd: false, comorbidities: [], prior_dose_date: null, priority_score: 0, status: 'pending', created_at: '2026-10-14T08:00:00Z', updated_at: '2026-10-14T08:00:00Z',
      medical_drives: null, profiles: { full_name: 'Fixture Applicant' } }} detailStatus="ready" onRetry={() => {}} onClose={() => setModal('')}
      onChanged={() => setWrites(current => current + 1)} onEditingChange={() => {}} />}
    {modal === 'qr' && <QrInstructionsModal section="why_scan" barangayId="fixture-barangay" existing={undefined} onClose={() => setModal('')}
      onSaved={() => setWrites(current => current + 1)} />}
  </>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<ToastProvider><main style={{ padding: 16 }}><Coverage /></main></ToastProvider>);
