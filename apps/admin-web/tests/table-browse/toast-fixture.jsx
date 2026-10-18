import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster, toastAnchorRef } from '../../src/components/ui/sonner';
import { ThemeControllerProvider, useThemeController } from '../../src/components/ui/theme-controller';
import { beginAttempt, notify, setNotificationSession } from '../../src/lib/notify';
import { RequestFulfillmentPanel } from '../../src/components/admin/request-fulfillment-panel';
import { TableDetailDialog } from '../../src/components/admin/table-detail-dialog';

window.toastFixture = { writes: 0, result: 'success', errors: [], refreshes: 0 };

function Fixture() {
  const [open, setOpen] = useState(false);
  const { theme, setTheme } = useThemeController();
  const id = useRef(null);
  function outcome() {
    id.current = beginAttempt('fixture');
    notify.success('Saved successfully.', { id: id.current });
    notify.success('Duplicate must be suppressed.', { id: id.current });
  }
  const controls = <>
    <button onClick={outcome}>Show success</button>
    <button onClick={() => notify.error('Could not save. Please try again.')}>Show error</button>
    <button onClick={() => notify.info('A very long notification '.repeat(14))}>Long message</button>
    <button onClick={() => setOpen(false)}>Close dialog</button>
  </>;
  return <>
    <header ref={toastAnchorRef} style={{ height: 60, borderBottom: '1px solid #aaa' }}>Admin notification verification</header>
    <main style={{ padding: 24 }}>
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Toggle theme</button>
      <button onClick={() => setOpen(true)}>Open dialog</button>
      <button onClick={() => setNotificationSession('other-account')}>Switch account</button>
      {controls}
      <RequestFulfillmentPanel request={{ id: 'request-one', sla_state: 'pre_processing', fee_assessment_state: 'assessed', assessed_amount_centavos: 0, payment_status: 'waived', status: 'submitted' }} onChanged={() => { window.toastFixture.refreshes++; }} />
      {open && <TableDetailDialog label="Toast dialog" onClose={() => setOpen(false)}>{controls}</TableDetailDialog>}
    </main>
  </>;
}

const root = createRoot(document.getElementById('root'));
window.unmountToastFixture = () => root.unmount();
root.render(<React.StrictMode><ThemeControllerProvider><Toaster /><Fixture /></ThemeControllerProvider></React.StrictMode>);
