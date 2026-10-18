/* Synthetic resident and payment records; no external services are called. */
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'framer-motion';
import { DocumentRequestModal } from '../src/components/services/document-request-modal/document-request-modal';
import { serviceDocumentTypeValues } from '@barangayan/shared';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server.browser';

const id = 'a1260000-0000-4000-8000-000000000001';
const requestId = 'e1260000-0000-4000-8000-000000000001';
const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZRkAAAAASUVORK5CYII=';
const catalog = {
  serviceKind: 'indigency', pricingMode: 'fixed', processingTargetMinutes: 15,
  charter: {
    officeDivision: 'Office of the Barangay Secretary', classification: 'Simple', transactionType: 'G2C',
    whoMayAvail: 'Residents of the barangay', checklistOfRequirements: 'Approved valid ID\nProof of residency, if requested',
    whereToSecureRequirements: 'Valid ID in your resident profile', clientSteps: 'Submit your request and present the original documents at the Barangay Hall.',
    agencyActions: 'Review requirements and prepare the certificate.', feesToBePaid: '₱100.00', processingTime: '15 minutes', personResponsible: 'Barangay Secretary',
  },
  purposes: [{ code: 'medical', label: 'Medical assistance', requiresExplanation: false }, { code: 'others', label: 'Others', requiresExplanation: true }],
  requirementRules: { dtiRequired: false, hoaRequired: false, lessorForRenter: true, personalAppearance: true },
};
const doc = { id, ...serviceDocumentTypeValues({ name: 'Certificate of Indigency', description: 'Request a certificate for financial assistance, medical support, or other eligible services.', feeCentavos: 10000, catalog }) };
const fixture = window.__documentSheet = {
  doc, pixel, requestId, calls: [], status: 'pending', error: null, authenticated: true, expiresAt: Date.now() + 1800000,
  qrImage: `data:image/svg+xml,${encodeURIComponent(renderToStaticMarkup(<QRCodeSVG xmlns="http://www.w3.org/2000/svg" value="SYNTHETIC-UI-TEST-NOT-A-PAYMENT" size={256} marginSize={2} />))}`,
  profile: { id, role: 'resident', first_name: 'Test', last_name: 'Resident', full_name: 'Test Resident', house_no: '12', street: 'Sample Street', sex: 'female', employment_status: 'unemployed', mobile_number: '09171234567', birth_date: '1995-01-01', id_verification_status: 'verified', approved_id_submission_id: id, current_id_submission_id: id, id_repair_required: false },
  approved: { id, decision: 'verified', id_type: 'PhilSys', version: 1, front_path: 'fixture/front.jpg', back_path: null },
  request: { id: requestId, contract_version: 2, reference_number: 'REQ-2026-00125', status: 'submitted', payment_status: 'pending', fee_assessment_state: 'assessed', assessed_amount_centavos: 10000, document_types: { name: doc.name, fee_centavos: 10000, service_kind: 'indigency' }, payments: [] },
  paid: { id, service_request_id: requestId, method: 'qrph', status: 'paid', amount_centavos: 10000, document_fee_centavos: 10000, paid_at: '2026-10-17T02:00:00Z', created_at: '2026-10-17T02:00:00Z', paymongo_payment_id: `pay_${'long-reference-'.repeat(6)}` },
  pay() { this.status = 'paid'; this.request.payment_status = 'paid'; window.dispatchEvent(new Event('fixture-update')); },
};
function App() {
  const [key, setKey] = useState(0);
  const [open, setOpen] = useState(true);
  useEffect(() => { fixture.reset = (mode = 'default') => {
    fixture.status = 'pending'; fixture.calls = []; fixture.error = null; fixture.authenticated = mode !== 'guest';
    fixture.request.payment_status = 'pending'; fixture.request.assessed_amount_centavos = mode === 'business' ? null : 10000;
    fixture.request.fee_assessment_state = mode === 'business' ? 'pickup_due' : 'assessed';
    fixture.request.document_types.service_kind = mode === 'business' ? 'business' : 'indigency';
    fixture.doc = mode === 'business' ? { ...doc, name: 'Business Clearance', service_kind: 'business', requirement_rules: { ...doc.requirement_rules, lessorForRenter: false } } : doc;
    setOpen(true); setKey(value => value + 1);
  }; }, []);
  return <MotionConfig reducedMotion="user">
    <main style={{ padding: 40 }}><h1>Documents</h1><p>Request documents from your barangay.</p><button onClick={() => setOpen(true)}>Open document</button></main>
    <DocumentRequestModal key={key} documentId={id} open={open} isAuthenticated={fixture.authenticated} onClose={() => setOpen(false)} />
  </MotionConfig>;
}
createRoot(document.getElementById('root')).render(<App />);
