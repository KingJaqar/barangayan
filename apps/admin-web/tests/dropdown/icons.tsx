import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileText, Star } from 'lucide-react';
import { AnnouncementForm } from '../../src/app/(admin)/announcements/announcement-form';
import { FaqForm } from '../../src/app/(admin)/faq/faq-form';
import { EmergencyForm } from '../../src/app/(admin)/hub/emergency-form';
import { ScheduleForm } from '../../src/app/(admin)/waste-management/schedule-form';
import { AdminSelect } from '../../src/components/admin/dropdown/admin-select';
import { Toaster } from '../../src/components/ui/sonner';
import { ThemeControllerProvider } from '../../src/components/ui/theme-controller';

function IconFixture() {
  const form = new URLSearchParams(location.search).get('form');
  const [value, setValue] = useState('first');
  if (form === 'announcements') return <AnnouncementForm barangayId="fixture-barangay" />;
  if (form === 'faq') return <FaqForm barangayId="fixture-barangay" />;
  if (form === 'hub') return <EmergencyForm barangayId="fixture-barangay" />;
  if (form === 'waste') return <ScheduleForm barangayId="fixture-barangay" zones={[]} />;
  return <>
    <AdminSelect aria-label="Explicit icons" icon={<FileText size={17} />} value={value} onValueChange={setValue}
      options={[{ value: 'first', label: 'First', icon: <Star size={17} /> }, { value: 'second', label: 'Second' }]} />
    <AdminSelect aria-label="Unknown value" kind="status" value="__proto__" onValueChange={() => {}}
      options={[{ value: '__proto__', label: 'Unknown status' }]} />
  </>;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<ThemeControllerProvider><Toaster /><main style={{ padding: 16, maxWidth: 800 }}><IconFixture /></main></ThemeControllerProvider>);
