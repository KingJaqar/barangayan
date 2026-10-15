import type { LatLng } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { useState } from 'react';
import { Action, Body, Card, Sheet } from '../../components/ui';
import { releaseGates } from '../../lib/release-gates';
import { PinPicker, usePinPlacement } from './pin-picker';

type Boundary = Polygon | MultiPolygon | null;

/**
 * Optional manual home pin for registration (carried from Phase 4, P04-D03). The pin is only
 * held in the form until the details are saved; the server checks it against the barangay
 * boundary again, and saving a pin is not proof of residency.
 */
export function HomePinCard({ boundary, home, onHome, areaName, disabled }: {
  boundary: Boundary; home: LatLng | null; onHome: (point: LatLng | null) => void; areaName: string; disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  return <Card>
    <Body heading role="headline">Home location on the map (optional)</Body>
    <Body tone="secondary">{home ? 'A home pin inside your barangay is set. You can move it now or later in Settings.' : 'Place a pin where your home is, or continue and do it later in Settings.'}</Body>
    <Action label={home ? 'Move my home pin' : 'Place my home on the map'} secondary disabled={disabled || !boundary} onPress={() => setOpen(true)} />
    {home && <Action label="Remove my home pin" secondary disabled={disabled} onPress={() => onHome(null)} />}
    {!boundary && <Body role="footnote" tone="secondary">The barangay boundary is not available right now, so the pin cannot be placed.</Body>}
    <Sheet visible={open} title="Home location" onClose={() => setOpen(false)}>
      <HomePinBody boundary={boundary} initial={home} areaName={areaName} onApply={(point) => { onHome(point); setOpen(false); }} onCancel={() => setOpen(false)} />
    </Sheet>
  </Card>;
}

/** Mounted fresh whenever the sheet opens, so the draft pin always starts from the form's pin. */
function HomePinBody({ boundary, initial, areaName, onApply, onCancel }: {
  boundary: Boundary; initial: LatLng | null; areaName: string; onApply: (point: LatLng) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<LatLng | null>(initial);
  const placement = usePinPlacement(boundary, setDraft);
  return <>
    <PinPicker boundary={boundary} position={draft} placement={placement} tiles={releaseGates.mapProviders} areaName={areaName} />
    <Action label="Use this pin" disabled={!draft} onPress={() => { if (draft) onApply(draft); }} />
    <Action label="Cancel" secondary onPress={onCancel} />
  </>;
}
