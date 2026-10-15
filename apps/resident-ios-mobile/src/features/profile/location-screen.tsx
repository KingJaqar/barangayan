import { isPointInPolygon, reverseGeocode, type LatLng } from '@barangayan/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Field, Loading, Notice, Screen, StatusBadge, useDiscardGuard } from '../../components/ui';
import { toDataError } from '../../data/outcome';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { useDeviceLocation } from '../../lib/device-location';
import { residentError } from '../../lib/errors';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useLatest } from '../../lib/use-latest';
import { readBoundary, readPoint } from './location-map';
import { PinPicker, usePinPlacement } from './pin-picker';

export function LocationVerificationRoute() {
  return <RequireResident purpose="verify your home location"><LocationVerification /></RequireResident>;
}

type Result = { text: string; tone: 'primary' | 'danger' };

function LocationVerification() {
  const { client, session, profile, refreshProfile } = useResident();
  const api = useApi();
  const context = useResource('barangay-profile', (signal) => api.barangayProfile(signal));
  const boundary = useMemo(() => readBoundary(context.data?.boundary), [context.data?.boundary]);
  const saved = readPoint(profile?.verified_location);
  const savedAddress = profile?.verified_location_address ?? '';
  const [position, setPosition] = useState<LatLng | null>(saved);
  const [address, setAddress] = useState(savedAddress);
  const [addressNote, setAddressNote] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [locating, setLocating] = useState(false);
  const geocodeTicket = useRef(0);
  // Address detection and map tiles are third-party map providers: closed until the `mapProviders` gate (G07) opens.
  const providers = releaseGates.mapProviders;
  const dirty = (position !== null && JSON.stringify(position) !== JSON.stringify(saved)) || address.trim() !== savedAddress.trim();
  useDiscardGuard(dirty && !busy);

  const placement = usePinPlacement(boundary, (point) => {
    setResult(null);
    setPosition(point);
    setAddressNote(null);
    if (!providers) return;
    const ticket = ++geocodeTicket.current;
    setDetecting(true);
    void reverseGeocode(point).then((detected) => {
      if (ticket !== geocodeTicket.current) return;
      setDetecting(false);
      if (detected) setAddress(detected); else setAddressNote('We could not detect an address for this pin. Type your address instead.');
    });
  });
  const placeLatest = useLatest(placement.place);

  const gps = useDeviceLocation(locating);
  const origin = gps.state.origin;
  useEffect(() => {
    // The confirmed fix is the trigger; the latest `place` reads the current boundary.
    if (origin) placeLatest.current({ lat: origin.lat, lng: origin.lng });
  }, [origin, placeLatest]);

  async function save() {
    if (busy || !position || !session) return;
    if (!boundary || !isPointInPolygon(position, boundary)) {
      setResult({ text: 'That spot is not inside your barangay boundary, so it cannot be saved. Move the pin and try again.', tone: 'danger' });
      return;
    }
    setBusy(true); setResult(null);
    try {
      const { error, status } = await client.from('profiles')
        .update({ verified_location: { lat: position.lat, lng: position.lng }, verified_location_address: address.trim() || null })
        .eq('id', session.user.id);
      if (error) {
        if (error.code === '22023') { setResult({ text: 'That spot is not inside your barangay boundary, so it was not saved. Move the pin and try again.', tone: 'danger' }); return; }
        throw toDataError(error, { status, write: true });
      }
      await refreshProfile().catch(() => undefined);
      setResult({ text: 'Location saved.', tone: 'primary' });
    } catch (failure) {
      void refreshProfile().catch(() => undefined);
      setResult({ text: residentError(failure), tone: 'danger' });
    } finally { setBusy(false); }
  }

  const message = gps.message;
  const areaName = context.data?.locality?.display_name ?? context.data?.name ?? 'your barangay';
  return <Screen>
    <Card>
      <Body heading>Home location</Body>
      <StatusBadge label={saved ? 'Location saved' : 'No location saved'} icon={saved ? 'checkmark.circle' : 'mappin.slash'} tone={saved ? 'success' : 'neutral'} />
      {saved && <Body tone="secondary">{savedAddress || 'No address on file'}</Body>}
      <Body role="footnote" tone="secondary">Saving a pin records where you say your home is. It is not proof of residency, and barangay staff may review it.</Body>
    </Card>
    <Card>
      <Body heading role="headline">Place your pin</Body>
      {context.loading && !context.data && <Loading label="Loading your barangay boundary…" />}
      {context.error && !context.data && <>
        <Notice tone="danger" message="Your barangay boundary could not be loaded. Check your connection and try again." />
        <Action label="Try again" secondary onPress={() => void context.refresh()} />
      </>}
      {!context.loading && !context.error && !boundary && <Notice tone="danger" message="Your barangay boundary is not available, so a home location cannot be verified right now." />}
      <PinPicker boundary={boundary} position={position} placement={placement} tiles={providers} areaName={areaName} disabled={busy} />
    </Card>
    <Card>
      <Body heading role="headline">Use your device location</Body>
      {locating && message && <Notice message={`${message.title}${message.detail ? ` ${message.detail}` : ''}`} tone={message.tone === 'error' ? 'danger' : 'primary'} />}
      {!locating || !message || message.actions.includes('locate') || message.actions.includes('retry')
        ? <Action label={origin ? 'Update from my location' : 'Use my current location'} secondary disabled={busy}
          onPress={() => { if (locating) gps.locate(); else setLocating(true); }} />
        : null}
      {locating && message?.actions.includes('confirm') && <Action label="Use this location" disabled={busy} onPress={gps.confirm} />}
      {locating && message?.actions.includes('reject') && <Action label="Try again" secondary disabled={busy} onPress={gps.reject} />}
      {locating && message?.actions.includes('open-settings') && <Action label="Open Settings" secondary onPress={gps.openSettings} />}
      {locating && message?.actions.includes('cancel') && <Action label="Cancel" secondary onPress={() => { gps.cancel(); setLocating(false); }} />}
      <Body role="footnote" tone="secondary">Your device location is used only to place the pin while the app is open. You can always place the pin yourself.</Body>
    </Card>
    <Card>
      <Body heading role="headline">Address</Body>
      <Field label="Address for this pin" value={address} onChangeText={(value) => { setAddress(value); setResult(null); }} maxLength={300} editable={!busy} multiline
        placeholder="House number, street and barangay" textContentType="fullStreetAddress" />
      {detecting && <Loading label="Detecting the address…" />}
      {addressNote && <Notice message={addressNote} />}
      {!providers && <Body role="footnote" tone="secondary">Automatic address detection is not available in this version yet. Type the address that matches your pin.</Body>}
    </Card>
    {result && <Notice message={result.text} tone={result.tone} />}
    <Action label={busy ? 'Saving…' : 'Save my location'} disabled={busy || !position || !boundary || !dirty} onPress={() => void save()} />
  </Screen>;
}
