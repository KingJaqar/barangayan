import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from '../../src/components/ui/sonner';
import { ThemeControllerProvider } from '../../src/components/ui/theme-controller';
import { RequestsTable } from '../../src/app/(admin)/requests/requests-table';
import { TransactionsTable } from '../../src/app/(admin)/transactions/transactions-table';
import { ResidentDirectory } from '../../src/app/(admin)/residents/resident-directory';
import { IncidentTable } from '../../src/app/(admin)/incident-reports/incident-table';
import { DriveTable } from '../../src/app/(admin)/health/drive-table';
import { ApplicantsTable } from '../../src/app/(admin)/health/applicants/applicants-table';
import { HouseholdsTable } from '../../src/app/(admin)/households-residents/households-table';
import { StaffTable } from '../../src/app/(admin)/staff/staff-table';
import { ArchivedRecords } from '../../src/app/(admin)/archive/[screen]/records';
import { TABLE_CONFIGS, TABLE_SUMMARY_KEYS } from '../../src/lib/admin-tables/table-configs';
import { parseBrowseState, queryIdentity } from '../../src/lib/admin-tables/browse-state';
import { RECORD_CONFIG } from '../../src/lib/admin-tables/record-config';

const profile = { id: 'b1150000-0000-0000-0000-000000000003', full_name: 'Fixture Resident', first_name: 'Fixture', last_name: 'Resident',
  middle_name: 'Santos', suffix: 'Jr.', sex: 'female', avatar_url: null, email: 'fixture@test.local', mobile_number: '09171234567',
  home_address: '1 Fixture Street', house_no: '1', street: 'Fixture Street', city: 'San Mateo', employment_status: 'student', occupation: 'Student',
  birth_date: '2000-01-01', email_verification_status: 'unverified', household_members: [], id_photo_urls: [], id_type: null,
  id_verification_status: null, current_id_submission_id: null, id_repair_required: false, location_verified: true, verified_location: null,
  created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-13T08:00:00Z' };
const base = { id: 'f1150000-0000-0000-0000-000000000001', barangay_id: 'a1150000-0000-0000-0000-000000000001',
  created_at: '2026-10-13T08:00:00Z', updated_at: '2026-10-13T08:00:00Z', deleted_at: null };
const request = { ...base, reference_number: 'LC-001', profiles: profile, document_types: { name: 'Fixture Service' }, contract_version: 1,
  resident_id: base.id, document_type_id: 'c1150000-0000-0000-0000-000000000001',
  status: 'submitted', payment_status: 'pending', payment_method: 'pickup', requester_notes: 'Fixture note' };
window.recordFixture = { name: new URLSearchParams(location.search).get('screen') ?? 'requests', failNext: false, unavailable: false, reads: 0, mutations: [],
  rows: {
    requests: request,
    transactions: { ...base, service_request_id: request.id, service_requests: request, method: 'pickup', status: 'pending', amount_centavos: 5000, document_fee_centavos: 5000, collector: profile, refund_status: 'none', paymongo_payment_id: 'pay_fixture' },
    residents: { ...profile, ...base },
    incidents: { ...base, title: 'Fixture Incident', description: 'Fixture description', address: 'Fixture Street', specific_area_details: 'Near the park', profiles: profile,
      category_id: 'c1150000-0000-0000-0000-000000000002', reporter_id: base.id,
      incident_categories: { name: 'Fixture category', color: '#166534', icon: 'warning' }, status: 'open', confirmation_count: 0, photo_urls: [], location: { lat: 14.7, lng: 121.1 } },
    health: { ...base, title: 'Fixture Medical Drive', type: 'vaccination', drive_date: '2026-10-20', time_start: '08:00', time_end: '12:00', location: 'Fixture Health Center',
      eligible_criteria: 'Residents', stock_total: 10, stock_remaining: 9, stock_label: 'Remaining slots', stock_unit: 'slots', is_active: true, registration_count: 0 },
    applicants: { ...base, applicant_number: 'LC-001', age: 30, is_pwd: false, comorbidities: [], prior_dose_date: null, priority_score: 0, status: 'pending', profiles: profile,
      medical_drives: { id: base.id, title: 'Fixture Medical Drive', type: 'vaccination', drive_date: '2026-10-20', location: 'Fixture Health Center' } },
    households: { ...base, profile_id: profile.id, name: 'Fixture Member', relation: 'child', role: 'member', is_checked_in: false, checked_in_at: null, checked_in_center_name: null, profiles: profile },
    staff: { ...base, profile_id: profile.id, profile, official_role: 'staff', date_hired: '2026-01-01', is_active: true },
  } };

const components = { requests: RequestsTable, transactions: TransactionsTable, residents: ResidentDirectory, incidents: IncidentTable,
  health: DriveTable, applicants: ApplicantsTable, households: HouseholdsTable, staff: StaffTable };
function Fixture() {
  const [revision, change] = useState(0);
  const [archive, setArchive] = useState(false);
  useEffect(() => { const update = () => change(value => value + 1); window.addEventListener('record-refresh', update); return () => window.removeEventListener('record-refresh', update); }, []);
  const name = window.recordFixture.name;
  const row = window.recordFixture.rows[name];
  const state = parseBrowseState(new URLSearchParams({ tab: 'all' }), TABLE_CONFIGS[name]);
  const rows = row && !!row.deleted_at === archive && !new URLSearchParams(location.search).has('hideRows') ? [{ ...row }] : [];
  const result = { status: 'success', value: { rows, total: rows.length, state, queryIdentity: queryIdentity(state) } };
  const summary = { status: 'success', value: Object.fromEntries(TABLE_SUMMARY_KEYS[name].map(key => [key, 0])) };
  const Component = components[name];
  return <ThemeControllerProvider><Toaster /><main className="mx-auto max-w-[1440px] p-6" data-revision={revision}>
    <h1 className="mb-4 text-xl">{RECORD_CONFIG[name].label} lifecycle fixture</h1>
    <button id="fixture-archive" className="mb-4 rounded border p-2" onClick={() => setArchive(value => !value)}>{archive ? 'Active fixture' : 'Archive fixture'}</button>
    {archive ? <ArchivedRecords name={name} result={result} requestedState={state} currentUserId="signed-in-admin" />
      : <Component result={result} summary={summary} requestedState={state} barangayId={base.barangay_id} currentUserId="signed-in-admin"
        residents={[profile]} documentTypes={[]} categories={[]} optionsError={null} referenceOptions={[]} admins={[profile]} drives={[]} />}
  </main></ThemeControllerProvider>;
}
createRoot(document.getElementById('root')).render(<Fixture />);
