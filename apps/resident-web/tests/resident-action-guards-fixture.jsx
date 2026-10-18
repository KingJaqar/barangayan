import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { RegisterDrawer } from '../src/components/health/register-drawer';
import { NewReportDrawer } from '../src/components/reports/new-report-drawer';
import { DocumentRequestModal } from '../src/components/services/document-request-modal/document-request-modal';
import { serviceDocumentTypeValues } from '@barangayan/shared';

const id = 'a1260000-0000-4000-8000-000000000001';
const profile = { id, role: 'resident', barangay_id: id, first_name: 'Test', last_name: 'Resident', full_name: 'Test Resident', house_no: '12', street: 'Sample Street', sex: 'female', employment_status: 'unemployed', mobile_number: '09171234567', birth_date: '1995-01-01', id_verification_status: 'verified', approved_id_submission_id: id, current_id_submission_id: id, id_repair_required: false };
const fixture = window.__guards = { id, profile, reads: 0, writes: [], error: false, delay: 0, authenticated: true,
  drive: { id, title: 'Test medical drive', type: 'vaccination', drive_date: '2026-10-17', time_start: '08:00', time_end: '12:00', stock_total: 100, stock_remaining: 100, stock_label: 'doses', location: 'Health Center' },
  doc: { id, ...serviceDocumentTypeValues({ name: 'Certificate of Indigency', feeCentavos: 10000, description: 'Test document', catalog: {
    serviceKind: 'indigency', pricingMode: 'fixed', processingTargetMinutes: 15,
    charter: { officeDivision: 'Secretary', classification: 'Simple', transactionType: 'G2C', whoMayAvail: 'Residents',
      checklistOfRequirements: 'Approved valid ID', whereToSecureRequirements: 'Settings', clientSteps: 'Submit request',
      agencyActions: 'Review request', feesToBePaid: '100 pesos', processingTime: '15 minutes', personResponsible: 'Secretary' },
    purposes: [{ code: 'medical', label: 'Medical assistance', requiresExplanation: false }],
    requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: false, personalAppearance: false },
  } }) },
};
function App() {
  const [state, setState] = useState({ action: 'drive', key: 0, open: false });
  useEffect(() => { fixture.open = (action, mode = 'complete', role = 'resident') => {
    fixture.profile = { ...profile, role, profile_completed_at: '2026-10-01T00:00:00Z',
      ...(mode.includes('incomplete-birth-date') ? { birth_date: null } : mode.includes('incomplete') ? { house_no: '' } : {}),
      ...(mode.includes('unverified') ? { id_verification_status: 'pending' } : {}) };
    fixture.reads = 0; fixture.writes = []; fixture.error = mode === 'error'; fixture.delay = mode === 'delayed' ? 500 : 0;
    fixture.authenticated = mode !== 'guest';
    setState(previous => ({ action, key: previous.key + 1, open: true }));
  }; }, []);
  const close = () => setState(previous => ({ ...previous, open: false }));
  return <>
    <button onClick={() => { fixture.backgroundClicks = (fixture.backgroundClicks ?? 0) + 1; }}>Background action</button>
    {state.action === 'drive' ? <RegisterDrawer key={state.key} driveId={state.open ? id : null} userId={id} open={state.open} onClose={close} />
      : state.action === 'report' ? <NewReportDrawer key={state.key} open={state.open} onClose={close} onSubmitted={close} />
        : <DocumentRequestModal key={state.key} documentId={state.open ? id : null} open={state.open} isAuthenticated onClose={close} />}
  </>;
}
createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
