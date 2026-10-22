import { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { AttendanceDialog } from '../../apps/admin-web/src/app/(admin)/households-residents/attendance-dialog';
function Fixture() {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState(JSON.stringify({ type: 'household', version: '1.0', profileId: 'dfb21000-0000-4000-8000-000000000003' }));
  const close = useCallback(() => setOpen(false), []);
  const changed = useCallback(() => {}, []);
  Object.assign(window, { fixtureSetQr: setQr });
  return <main><div data-fixture-qr aria-hidden="true" style={{ position: 'fixed', left: -10000 }}><QRCodeCanvas value={qr} size={480} marginSize={4} /></div>
    <button onClick={() => setOpen(true)}>Open attendance</button>{open && <AttendanceDialog
    actorId="dfb21000-0000-4000-8000-000000000001" barangayId="afb21000-0000-4000-8000-000000000001"
    residents={[{ id: 'dfb21000-0000-4000-8000-000000000002', full_name: 'Synthetic Family' },
      { id: 'dfb21000-0000-4000-8000-000000000003', full_name: 'Synthetic Holder Only' }]}
    optionsError={null} onClose={close} onIdentityLost={close} onChanged={changed} />}</main>;
}
const root = document.getElementById('root');
if (root) createRoot(root).render(<Fixture />);
