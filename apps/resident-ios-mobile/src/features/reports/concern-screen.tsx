import { isPointInPolygon, reverseGeocode, type LatLng } from '@barangayan/shared';
import { randomUUID } from 'expo-crypto';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, confirmDestructive, Field, Loading, Notice, Screen, Selector, useDiscardGuard } from '../../components/ui';
import type { IncidentCategory, WasteZone } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { bytesToDataUri } from '../../lib/data-uri';
import { useDeviceLocation } from '../../lib/device-location';
import { drafts } from '../../lib/drafts';
import { residentError } from '../../lib/errors';
import { storageBucket } from '../../lib/files';
import { pickImages, type ImageOrigin } from '../../lib/image-source';
import type { ValidatedFile } from '../../lib/file-validation';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { createStagedUploads } from '../../lib/staged-uploads';
import { useLatest } from '../../lib/use-latest';
import { radius, space, useColors } from '../../lib/theme';
import { readBoundary } from '../profile/location-map';
import { PinPicker, usePinPlacement } from '../profile/pin-picker';
import {
  ADDRESS_MAX, AREA_MAX, chooseCategory, DESCRIPTION_MAX, EMERGENCY_NOTICE, emptyConcern, PHOTO_MAX, TITLE_MAX, toggleZone, validateConcern, VISIBILITY_NOTICE, zoneApplies,
  type ConcernErrors, type ConcernFields,
} from './concern-form';
import { clearConcernDraft, loadConcernDraft, saveConcernDraft } from './concern-draft';
import { abandonAttempt, confirmAttempt, submitConcern, type ConcernAttempt, type SubmitDeps } from './concern-submit';
import { PhotoViewer } from './photo-viewer';

const staged = createStagedUploads(drafts);
const NO_ZONE = 'none';

export function ConcernRoute() {
  return <RequireResident purpose="report a concern"><ConcernGate /></RequireResident>;
}

/** A concern needs a completed resident profile (A33-001); the server repeats that check. */
function ConcernGate() {
  const router = useRouter();
  const { session } = useResident();
  const { setup } = useAuthFlow();
  const userId = session?.user.id;
  if (!userId) return null;
  const profileComplete = setup.state !== 'ready' || setup.status.profileComplete;
  if (!profileComplete) {
    return <Screen><Card>
      <Body heading role="headline">Complete your profile first</Body>
      <Body tone="secondary">Reports need your name, address and contact details so the barangay can follow up.</Body>
      <Action label="Complete your profile" onPress={() => router.push({ pathname: '/complete-profile', params: { next: '/reports/new' } })} />
    </Card></Screen>;
  }
  return <ConcernForm userId={userId} />;
}

type SelectedPhoto = { key: string; file: ValidatedFile; name: string; preview: string | null };
type Message = { text: string; tone: 'primary' | 'danger' };
type Phase = 'idle' | 'busy';

function ConcernForm({ userId }: { userId: string }) {
  const router = useRouter();
  const api = useApi();
  const { client, config } = useResident();
  const colors = useColors();
  const scope = useMemo(() => ({ environment: config.environment, barangayId: config.barangayId, userId }), [config.environment, config.barangayId, userId]);

  const categories = useResource('concern-categories', (signal) => api.incidentCategories(signal));
  const zones = useResource('concern-zones', (signal) => api.wasteZones(signal));
  const context = useResource('barangay-profile', (signal) => api.barangayProfile(signal));
  const boundary = useMemo(() => readBoundary(context.data?.boundary), [context.data?.boundary]);
  const areaName = context.data?.locality?.display_name ?? context.data?.name ?? 'your barangay';
  const categoryList: IncidentCategory[] = categories.data ?? [];
  const zoneList: WasteZone[] = zones.data ?? [];

  const [loaded, setLoaded] = useState(false);
  const [touched, setTouched] = useState(false);
  const [fields, setFields] = useState<ConcernFields>(emptyConcern);
  const [position, setPosition] = useState<LatLng | null>(null);
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [attempt, setAttempt] = useState<ConcernAttempt | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [state, setState] = useState<Phase>('idle');
  const [progress, setProgress] = useState<string | null>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [photoNotes, setPhotoNotes] = useState<string[]>([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [viewing, setViewing] = useState<number | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [addressNote, setAddressNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const geocodeTicket = useRef(0);
  const committed = useRef(false);
  const busy = state === 'busy';
  const locked = attempt !== null;
  const providers = releaseGates.mapProviders;

  // Restore the unsent report (and an unconfirmed filing) from protected storage before showing the form.
  useEffect(() => {
    let alive = true;
    loadConcernDraft(drafts, scope).then((draft) => {
      if (!alive) return;
      if (draft) { setFields(draft.fields); setPosition(draft.position); setAttempt(draft.attempt); }
      setLoaded(true);
    }).catch(() => {
      if (!alive) return;
      setMessage({ text: 'Details saved on this device could not be read, so the form starts empty.', tone: 'danger' });
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [scope]);

  // Typed answers, the pin and an unconfirmed filing are saved shortly after each change.
  useEffect(() => {
    if (!loaded || !touched || committed.current) return;
    const timer = setTimeout(() => {
      if (committed.current) return;
      saveConcernDraft(drafts, scope, { fields, position, attempt }).then(() => setSaveFailed(false), () => setSaveFailed(true));
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, touched, fields, position, attempt, scope]);

  // Navigate only after the guard has observed the filed concern, so leaving is not treated as discarding input.
  useEffect(() => {
    if (createdId) router.replace({ pathname: '/reports/incidents/[incidentId]', params: { incidentId: createdId, received: '1' } });
  }, [createdId, router]);
  useDiscardGuard(photos.length > 0 && !createdId && !attempt);

  const update = (patch: Partial<ConcernFields>) => { setTouched(true); setMessage(null); setFields((previous) => ({ ...previous, ...patch })); };
  const photoCount = locked ? attempt.paths.length : photos.length;
  const errors: ConcernErrors = showErrors ? validateConcern({ fields, position, boundary, photoCount, categories: categoryList, zones: zoneList }) : {};

  const placement = usePinPlacement(boundary, (point) => {
    setTouched(true);
    setMessage(null);
    setPosition(point);
    setAddressNote(null);
    if (!providers) return;
    const ticket = ++geocodeTicket.current;
    setDetecting(true);
    void reverseGeocode(point).then((detected) => {
      if (ticket !== geocodeTicket.current) return;
      setDetecting(false);
      if (detected) update({ address: detected.slice(0, ADDRESS_MAX) }); else setAddressNote('We could not detect an address for this pin. Type the address instead.');
    });
  });
  const placeLatest = useLatest(placement.place);
  const gps = useDeviceLocation(locating);
  const origin = gps.state.origin;
  useEffect(() => {
    // The confirmed fix is the trigger; the latest `place` reads the current boundary.
    if (origin) placeLatest.current({ lat: origin.lat, lng: origin.lng });
  }, [origin, placeLatest]);

  async function addPhotos(from: ImageOrigin) {
    if (busy || locked) return;
    setPhotoNotes([]);
    const room = PHOTO_MAX - photos.length;
    if (room <= 0) { setPhotoNotes([`You can attach up to ${PHOTO_MAX} photos. Remove one to add another.`]); return; }
    setState('busy');
    try {
      const picked = await pickImages('incident-photo', from, room);
      setTouched(true);
      setPhotos((previous) => [...previous, ...picked.images.map((image): SelectedPhoto => ({
        key: randomUUID(), file: { bytes: image.bytes, mimeType: image.mimeType, extension: image.extension }, name: image.name,
        preview: image.preview ? bytesToDataUri(image.preview, 'image/jpeg') : null,
      }))].slice(0, PHOTO_MAX));
      setPhotoNotes(picked.failures);
    } catch (failure) {
      setPhotoNotes([residentError(failure)]);
    } finally { setState('idle'); }
  }

  function deps(): SubmitDeps {
    const bucket = storageBucket(client, 'incident-photos');
    return {
      bucket, staged, scope, newId: randomUUID,
      publicUrl: (path) => client.storage.from('incident-photos').getPublicUrl(path).data.publicUrl,
      create: (concern) => api.createIncident(concern),
      persistAttempt: async (next) => {
        setAttempt(next);
        try { await saveConcernDraft(drafts, scope, { fields, position, attempt: next }); return true; } catch { return false; }
      },
    };
  }
  const exists = (target: ConcernAttempt) => () => api.incidentExists(target.id, new AbortController().signal);

  async function finish(id: string) {
    committed.current = true;
    await clearConcernDraft(drafts, scope).catch(() => undefined);
    setCreatedId(id);
  }

  async function submit() {
    if (busy || committed.current) return;
    setShowErrors(true);
    setMessage(null);
    const problems = validateConcern({ fields, position, boundary, photoCount, categories: categoryList, zones: zoneList });
    if (Object.keys(problems).length > 0 || !position) {
      setMessage({ text: 'Check the highlighted details before sending your report.', tone: 'danger' });
      return;
    }
    setState('busy');
    try {
      const outcome = await submitConcern(deps(), { fields, position, photos: photos.map((photo) => photo.file), attempt, onProgress: (done, total) => setProgress(`Uploading photo ${done} of ${total}…`) });
      if (outcome.kind === 'committed') { await finish(outcome.id); return; }
      if (outcome.kind === 'unknown') { setAttempt(outcome.attempt); setMessage({ text: outcome.message, tone: 'danger' }); return; }
      setMessage({ text: outcome.message, tone: 'danger' });
    } finally { setProgress(null); setState('idle'); }
  }

  async function check() {
    if (busy || !attempt) return;
    setState('busy');
    setMessage(null);
    try {
      const resolution = await confirmAttempt(deps(), attempt, exists(attempt));
      if (resolution === 'committed') { await finish(attempt.id); return; }
      setMessage({ text: resolution === 'not-found'
        ? 'The barangay has not received this report yet. You can send it again or discard it.'
        : 'We could not reach the server to check. Try again when you are online.', tone: 'danger' });
    } finally { setState('idle'); }
  }

  async function discardAttempt() {
    if (busy || !attempt) return;
    const confirmed = await confirmDestructive({ title: 'Discard this report?', message: 'The report and its uploaded photos will be removed if the barangay has not received it.', confirmLabel: 'Discard report' });
    if (!confirmed) return;
    setState('busy');
    try {
      const resolution = await abandonAttempt(deps(), attempt, exists(attempt));
      if (resolution === 'committed') { await finish(attempt.id); return; }
      if (resolution === 'unreachable') { setMessage({ text: 'We could not reach the server, so the report was kept. Try again when you are online.', tone: 'danger' }); return; }
      setAttempt(null);
      setMessage({ text: 'The unsent report was discarded. You can change it and send it again.', tone: 'primary' });
    } finally { setState('idle'); }
  }

  const trashZone = zoneApplies(fields, categoryList, zoneList);
  const categoryOptions = categoryList.map((category) => ({ value: category.id, label: category.name }));
  const zoneOptions = [{ value: NO_ZONE, label: 'No zone' }, ...zoneList.map((zone) => ({ value: zone.id, label: zone.name }))];
  const inside = position && boundary ? isPointInPolygon(position, boundary) : null;
  const gpsMessage = gps.message;
  if (!loaded || (categories.loading && !categories.data) || (context.loading && !context.data)) return <Screen><Loading label="Preparing the report form…" /></Screen>;
  if (categories.error || context.error) {
    return <Screen><Card><Body heading role="headline">The report form could not load</Body><Notice tone="danger" message={categories.error ?? context.error ?? ''} />
      <Action label="Try again" secondary onPress={() => { void categories.refresh(); void zones.refresh(); void context.refresh(); }} /></Card></Screen>;
  }
  return <Screen>
    <Card>
      <Body heading role="headline">Before you report</Body>
      <Body tone="secondary">{EMERGENCY_NOTICE}</Body>
      <Body tone="secondary">{VISIBILITY_NOTICE}</Body>
    </Card>
    {locked && <Card>
      <Body heading role="headline">Waiting for confirmation</Body>
      <Body tone="secondary">Your report was sent but we have not been able to confirm that the barangay received it. Its details are locked so that sending it again cannot create a second report.</Body>
      <Action label={busy ? 'Checking…' : 'Check if it was received'} disabled={busy} onPress={() => void check()} />
      <Action label="Send again" secondary disabled={busy} onPress={() => void submit()} />
      <Action label="Discard this report" secondary destructive disabled={busy} onPress={() => void discardAttempt()} />
    </Card>}
    <Card>
      <Body heading role="headline">What happened</Body>
      {categoryList.length === 0 ? <Notice tone="danger" message="Your barangay has not set up report categories yet, so a report cannot be sent." />
        : <Selector label="Category" required options={categoryOptions} selected={fields.categoryId} disabled={busy || locked}
          onChange={(categoryId) => { setTouched(true); setMessage(null); setFields((previous) => chooseCategory(previous, categoryId, categoryList, zoneList)); }} error={errors.category} />}
      {trashZone && <Selector label="Collection zone (optional)" options={zoneOptions} selected={fields.zoneId || NO_ZONE} disabled={busy || locked}
        onChange={(zone) => { setTouched(true); setFields((previous) => zone === NO_ZONE ? { ...previous, zoneId: '' } : toggleZone(previous, zone)); }} error={errors.zone} />}
      <Field label="Title" required value={fields.title} onChangeText={(title) => update({ title })} maxLength={TITLE_MAX} editable={!busy && !locked} error={errors.title} placeholder="For example: Broken streetlight on Purok 3" />
      <Body role="footnote" tone="secondary">{`${fields.title.length}/${TITLE_MAX}`}</Body>
      <Field label="Description (optional)" value={fields.description} onChangeText={(description) => update({ description })} maxLength={DESCRIPTION_MAX} editable={!busy && !locked} multiline error={errors.description} placeholder="Describe what you saw" />
      <Body role="footnote" tone="secondary">{`${fields.description.length}/${DESCRIPTION_MAX}`}</Body>
    </Card>
    <Card>
      <Body heading role="headline">{`Photos (${photoCount}/${PHOTO_MAX})`}</Body>
      <Body tone="secondary">{`Add up to ${PHOTO_MAX} photos as evidence. JPG, PNG, WEBP or HEIC; each is prepared to fit 10 MB. Location details stored in a photo are removed.`}</Body>
      {locked && <Body role="footnote" tone="secondary">{`${attempt.paths.length} photo${attempt.paths.length === 1 ? '' : 's'} already uploaded with this report.`}</Body>}
      {!locked && photos.length > 0 && <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        {photos.map((photo, index) => <View key={photo.key} style={{ width: 96, gap: space[1] }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`View photo ${index + 1}`} disabled={!photo.preview} onPress={() => setViewing(index)}
            style={{ width: 96, height: 96, borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.surfaceSelected, justifyContent: 'center', alignItems: 'center' }}>
            {photo.preview ? <Image source={{ uri: photo.preview }} accessibilityIgnoresInvertColors resizeMode="cover" style={{ width: 96, height: 96 }} /> : <Body role="footnote" tone="secondary">No preview</Body>}
          </Pressable>
          <Action label="Remove" secondary disabled={busy} hint={`Removes photo ${index + 1}`} onPress={() => { setTouched(true); setPhotos((previous) => previous.filter((item) => item.key !== photo.key)); }} />
        </View>)}
      </View>}
      {!locked && <>
        <Action label="Choose from library" secondary disabled={busy || photos.length >= PHOTO_MAX} onPress={() => void addPhotos('library')} />
        <Action label="Take a photo" secondary disabled={busy || photos.length >= PHOTO_MAX} onPress={() => void addPhotos('camera')} />
        {photos.length >= PHOTO_MAX && <Body role="footnote" tone="secondary">{`You have reached the ${PHOTO_MAX}-photo limit.`}</Body>}
      </>}
      {photoNotes.map((note) => <Notice key={note} tone="danger" message={note} />)}
      {errors.photos && <Notice tone="danger" message={errors.photos} />}
    </Card>
    <Card>
      <Body heading role="headline">Where it is</Body>
      {!boundary && <Notice tone="danger" message="Your barangay boundary is not available right now, so a location cannot be placed." />}
      <View pointerEvents={locked ? 'none' : 'auto'} style={{ opacity: locked ? 0.6 : 1 }}>
        <PinPicker boundary={boundary} position={position} placement={placement} tiles={providers} areaName={areaName} disabled={busy || locked} />
      </View>
      {inside === true && <Body role="footnote" tone="secondary">The pin is inside your barangay.</Body>}
      {errors.location && <Notice tone="danger" message={errors.location} />}
      {!locked && <>
        {locating && gpsMessage && <Notice message={`${gpsMessage.title}${gpsMessage.detail ? ` ${gpsMessage.detail}` : ''}`} tone={gpsMessage.tone === 'error' ? 'danger' : 'primary'} />}
        {!locating || !gpsMessage || gpsMessage.actions.includes('locate') || gpsMessage.actions.includes('retry')
          ? <Action label={origin ? 'Update from my location' : 'Use my current location'} secondary disabled={busy}
            onPress={() => { if (locating) gps.locate(); else setLocating(true); }} />
          : null}
        {locating && gpsMessage?.actions.includes('confirm') && <Action label="Use this location" disabled={busy} onPress={gps.confirm} />}
        {locating && gpsMessage?.actions.includes('reject') && <Action label="Try again" secondary disabled={busy} onPress={gps.reject} />}
        {locating && gpsMessage?.actions.includes('open-settings') && <Action label="Open Settings" secondary onPress={gps.openSettings} />}
        {locating && gpsMessage?.actions.includes('cancel') && <Action label="Cancel" secondary onPress={() => { gps.cancel(); setLocating(false); }} />}
        <Body role="footnote" tone="secondary">Your device location is used only to place the pin while the app is open. You can always place the pin yourself.</Body>
      </>}
      <Field label="Address (optional)" value={fields.address} onChangeText={(address) => update({ address })} maxLength={ADDRESS_MAX} editable={!busy && !locked} multiline error={errors.address}
        placeholder="House number, street and barangay" textContentType="fullStreetAddress" />
      {detecting && <Loading label="Detecting the address…" />}
      {addressNote && <Notice message={addressNote} />}
      {!providers && <Body role="footnote" tone="secondary">Automatic address detection is not available in this version yet. Type the address that matches your pin.</Body>}
      <Field label="Specific area or landmark (optional)" value={fields.specificArea} onChangeText={(specificArea) => update({ specificArea })} maxLength={AREA_MAX} editable={!busy && !locked} error={errors.specificArea}
        placeholder="For example: near the blue gate, second house from the corner" />
      <Body role="footnote" tone="secondary">{`${fields.specificArea.length}/${AREA_MAX}`}</Body>
    </Card>
    {saveFailed && <Body role="footnote" tone="danger">This report could not be kept on this device. Keep this screen open until you send it.</Body>}
    {progress && <Notice message={progress} />}
    {message && <Notice message={message.text} tone={message.tone} />}
    {!locked && <Action label={busy ? 'Sending your report…' : 'Send report'} disabled={busy || categoryList.length === 0} onPress={() => void submit()} />}
    <PhotoViewer uris={photos.map((photo) => photo.preview ?? '')} index={viewing} onIndex={setViewing} onClose={() => setViewing(null)} subject="Selected photo" />
  </Screen>;
}
