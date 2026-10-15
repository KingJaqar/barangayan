import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { Tables } from '@barangayan/shared';
import { ContentCreatePanel } from '../../src/components/admin/content-create-panel';
import { ContentSection } from '../../src/components/admin/content-workspace';
import styles from '../../src/components/admin/content-workspace.module.css';
import { ToastProvider } from '../../src/components/ui/toast';
import { DocumentTypeCatalog } from '../../src/app/(admin)/services/document-type-catalog';
import { DocumentTypeForm } from '../../src/app/(admin)/services/document-type-form';
import { AnnouncementCatalog } from '../../src/app/(admin)/announcements/announcement-catalog';
import { AnnouncementForm } from '../../src/app/(admin)/announcements/announcement-form';
import { EmergencyCatalog } from '../../src/app/(admin)/hub/emergency-catalog';
import { EmergencyForm } from '../../src/app/(admin)/hub/emergency-form';
import { WasteCatalog } from '../../src/app/(admin)/waste-management/waste-catalog';
import { ZoneForm } from '../../src/app/(admin)/waste-management/zone-form';
import { ScheduleForm } from '../../src/app/(admin)/waste-management/schedule-form';
import { TrashIncidentTable } from '../../src/app/(admin)/waste-management/trash-incident-table';
import { FaqList } from '../../src/app/(admin)/faq/faq-list';
import { FaqForm } from '../../src/app/(admin)/faq/faq-form';
import { EvacuationCenterCatalog } from '../../src/app/(admin)/evacuation-centers/evacuation-center-catalog';
import { EvacuationCenterForm } from '../../src/app/(admin)/evacuation-centers/evacuation-center-form';

// Real UI components with synthetic records. The preview server blocks all writes.
const base = { barangay_id: 'preview', created_at: '2026-10-12T08:00:00Z', published_at: '2026-10-12T08:00:00Z', deleted_at: null, is_active: true, sort_order: 0 };
const services = [
  { ...base, id: 'service-1', name: 'Barangay Clearance', description: 'Proof of residency for employment, applications, and everyday transactions.', fee_centavos: 5000, processing_target_hours: 1, requirements: ['Valid ID'], contract_version: 1 },
  { ...base, id: 'service-2', name: 'Certificate of Indigency', description: 'Support for residents seeking financial and medical assistance.', fee_centavos: 0, processing_target_hours: 1, requirements: [], contract_version: 1 },
  { ...base, id: 'service-3', name: 'Business Permit', description: 'Documentation for business establishments in the barangay.', fee_centavos: 15000, processing_target_hours: 2, requirements: [], contract_version: 1, is_active: false },
] as unknown as Tables<'document_types'>[];
const announcements = [
  { ...base, id: 'announcement-1', title: 'Community cleanup this Saturday', body: 'Join your neighbors at the barangay hall at 7 AM. Bring gloves and a reusable water bottle.', category: 'events' },
  { ...base, id: 'announcement-2', title: 'Free health screening', body: 'Visit the health center for free blood pressure and blood sugar checks.', category: 'health' },
  { ...base, id: 'announcement-3', title: 'Heavy rain advisory', body: 'Stay alert and follow the latest guidance from the local disaster response team.', category: 'emergency' },
] as unknown as Tables<'announcements'>[];
const entries = [
  { ...base, id: 'entry-1', title: 'Flood preparedness', body: 'Prepare an emergency kit and identify your nearest evacuation center.', category: 'guidelines', content: [], icon_color: '#0f6e5b' },
  { ...base, id: 'entry-2', title: 'Emergency contacts', body: 'Barangay response team: 0912 345 6789', category: 'hotlines', content: [], icon_color: '#6366f1' },
  { ...base, id: 'entry-3', title: 'Earthquake safety', body: 'Drop, cover, and hold on until the shaking stops.', category: 'guidelines', content: [], is_active: false },
] as unknown as Tables<'emergency_information'>[];
const zones = [
  { ...base, id: 'zone-1', name: 'Purok 1 — Town center', description: 'Main road and surrounding streets', trash_score: 0 },
  { ...base, id: 'zone-2', name: 'Purok 2 — Riverside', description: 'Riverside households and market area', trash_score: 2.5, is_active: false },
] as unknown as Tables<'waste_zones'>[];
const schedules = [
  { ...base, id: 'schedule-1', zone_id: 'zone-1', waste_type: 'biodegradable', day_of_week: 1, start_time: '08:00', end_time: '10:00', notes: 'Place bins outside before collection.' },
  { ...base, id: 'schedule-2', zone_id: 'zone-2', waste_type: 'recyclable', day_of_week: 4, start_time: '09:00', end_time: '11:00', notes: '', is_active: false },
] as unknown as Tables<'waste_collection_schedules'>[];
const articles = [
  { ...base, id: 'faq-1', question: 'How do I request a barangay clearance?', answer: 'Open Services, choose Barangay Clearance, and complete the request form with your supporting documents.', category: 'services' },
  { ...base, id: 'faq-2', question: 'When is waste collected?', answer: 'Check your zone in Waste Management for the current collection days and times.', category: 'general', is_active: false },
  { ...base, id: 'faq-3', question: 'Where can I get emergency assistance?', answer: 'Open the Emergency Hub for contact numbers and safety guidance.', category: 'general', deleted_at: '2026-10-12T08:00:00Z' },
] as unknown as Tables<'faq_articles'>[];

const centers = [
  { ...base, id: 'center-1', name: 'Town Center Elementary School', address: 'Main Road, Purok 1', capacity: 300, current_occupancy: 72, verified: true, contact_number: '(02) 8123-4501', position: { lat: 14.684583, lng: 121.112071 }, facilities: ['medical_desk', 'generator'] },
  { ...base, id: 'center-2', name: 'Barangay Covered Court', address: 'Riverside Road, Purok 2', capacity: 80, current_occupancy: 80, verified: false, contact_number: '0912 345 6789', position: { lat: 14.686, lng: 121.115 }, facilities: [] },
  { ...base, id: 'center-3', name: 'Community Activity Center', address: null, capacity: null, current_occupancy: 0, verified: false, contact_number: null, position: { lat: 14.688, lng: 121.117 }, facilities: [], is_active: false },
] as unknown as Tables<'evacuation_centers'>[];

const screens = ['Services', 'Announcements', 'Waste Management', 'Hub', 'FAQ Content', 'Evacuation Centers'] as const;
type Screen = typeof screens[number];
function App() {
  const [screen, setScreen] = useState<Screen>('Services');
  const [empty, setEmpty] = useState(false);
  const [dark, setDark] = useState(false);
  const zoneList = empty ? [] : zones;
  const scheduleList = empty ? [] : schedules;
  const pages = {
    Services: { title: 'Services', description: 'Manage the barangay’s document request catalog and fees.', forms: [{ label: 'Create new service', title: 'New service', description: 'Define the service details, Citizen’s Charter, requirements, and pricing.', content: <DocumentTypeForm barangayId="preview" /> }], content: <DocumentTypeCatalog documentTypes={empty ? [] : services} /> },
    Announcements: { title: 'Announcements', description: 'Create and manage barangay announcements pushed to residents.', forms: [{ label: 'Create new announcement', title: 'New announcement', description: 'Write the announcement, then choose its category and publication details.', content: <AnnouncementForm barangayId="preview" /> }], content: <AnnouncementCatalog announcements={empty ? [] : announcements} /> },
    'Waste Management': { title: 'Waste Management', description: 'Manage collection zones, recurring pickup schedules, and monitor illegal dumping reports.', forms: [
      { label: 'Create new zone', title: 'New collection zone', description: 'Name the collection area and describe its boundaries or landmarks.', content: <ZoneForm barangayId="preview" /> },
      { label: 'Create new schedule', title: 'New collection schedule', description: 'Choose a zone, waste type, and recurring collection window.', content: <ScheduleForm barangayId="preview" zones={zoneList.filter(z => z.is_active)} /> },
    ], content: <><WasteCatalog zones={zoneList} schedules={scheduleList} schedulesByZone={{ 'zone-1': [schedules[0]], 'zone-2': [schedules[1]] }} zoneNameById={{ 'zone-1': zones[0].name, 'zone-2': zones[1].name }} /><ContentSection title="Illegal dumping reports" description="Prioritized by recent reports and community confirmations · 0 reports"><TrashIncidentTable rows={[]} categoryNames={{}} highPriorityThreshold={5} /></ContentSection></> },
    Hub: { title: 'Emergency Hub', description: 'Manage emergency guidelines and hotlines pushed to residents.', forms: [{ label: 'Create new entry', title: 'New emergency entry', description: 'Add guidelines or hotlines and configure how they appear to residents.', content: <EmergencyForm barangayId="preview" /> }], content: <EmergencyCatalog items={empty ? [] : entries} /> },
    'FAQ Content': { title: 'FAQ Content', description: 'Manage Help Center articles visible to residents in your barangay.', forms: [{ label: 'Create new article', title: 'New FAQ article', description: 'Write a helpful question and answer, then set its category and visibility.', content: <FaqForm barangayId="preview" /> }], content: <FaqList articles={empty ? [] : articles} /> },
    'Evacuation Centers': { title: 'Evacuation Centers', description: 'Create and manage barangay evacuation centers visible to residents.', forms: [{ label: 'Create new center', title: 'New evacuation center', description: 'Add the center’s location, capacity, facilities, and contact details.', content: <EvacuationCenterForm barangayId="preview" /> }], content: <EvacuationCenterCatalog centers={empty ? [] : centers} /> },
  };
  const page = pages[screen];
  return <ToastProvider><div className={dark ? 'dark' : ''} style={{ minHeight: '100vh' }}>
    <nav aria-label="Preview controls" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, padding: 16, background: '#f4f4f5', color: '#27272a', borderBottom: '1px solid #e4e4e7' }}>
      <label>Screen preview <select value={screen} onChange={e => setScreen(e.target.value as Screen)}>{screens.map(s => <option key={s}>{s}</option>)}</select></label>
      <label><input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} /> Dark preview</label>
      <label><input type="checkbox" checked={empty} onChange={e => setEmpty(e.target.checked)} /> Empty preview</label>
      <span>UI fixture · writes disabled</span>
    </nav>
    <main className="bg-zinc-50 p-8 dark:bg-black" style={{ minHeight: 'calc(100vh - 60px)' }}>
      <div key={screen} className={styles.page}>
        <ContentCreatePanel title={page.title} description={page.description} forms={page.forms} />
        {page.content}
      </div>
    </main>
  </div></ToastProvider>;
}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
