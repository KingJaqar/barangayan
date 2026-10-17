import { ResidentSubmissionAttempt, type ServiceCatalogContract, type ServiceSubmissionInput } from '@barangayan/shared';
import { randomUUID } from 'expo-crypto';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, View } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, confirmDestructive, Destination, EmptyState, Field, Loading, Notice, ResourceState, Screen, Selector, StatusBadge, Toggle, useDiscardGuard } from '../../components/ui';
import { createSingleFlight } from '../../data/mutation';
import type { DataScope } from '../../data/scope';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { bytesToDataUri } from '../../lib/data-uri';
import { drafts } from '../../lib/drafts';
import { residentError } from '../../lib/errors';
import { pickUploadFile, storageBucket } from '../../lib/files';
import { pickImage, type ImageOrigin, type PickedImage } from '../../lib/image-source';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { createStagedUploads } from '../../lib/staged-uploads';
import { radius, space, useColors } from '../../lib/theme';
import { decodeIdType } from '../profile/id-evidence';
import { PrivatePreview } from '../profile/id-screen';
import { applyState, describeService, type ApplyState, type CatalogueRow, type ServiceEntry } from './catalog';
import { ApplyBlock } from './document-detail';
import { clearRequestDraft, loadRequestDraft, saveRequestDraft } from './request-draft';
import {
  ADDRESS_MAX, BUSINESS_NAME_MAX, buildLegacySubmission, buildSubmission, catalogOf, choosePurpose, emptyFields, EXPLANATION_MAX, evidenceSlots, feeNote,
  type Evidence, type FormFields, NOTES_MAX, pruneEvidence, purposeOf, REFERENCE_MAX, type Requirement, reviewLines, type SubmissionDraft, validateLegacyNotes, validateSubmission,
} from './request-form';
import { sendRequest, uploadEvidence, uploadLegacyId, type SendOutcome, type UploadState } from './request-submit';
import { useServiceReadiness } from './readiness';

const staged = createStagedUploads(drafts);
const FILE_HELP = 'JPG, PNG, WEBP or PDF · up to 5 MB';
const UPLOAD_LABEL: Record<UploadState, string> = { waiting: 'Waiting to upload', uploading: 'Uploading…', uploaded: 'Uploaded', failed: 'Upload failed — try again' };

export function RequestRoute() {
  return <RequireResident purpose="request documents"><RequestScreen /></RequireResident>;
}

function RequestScreen() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const resource = useResource(`request-document:${id}`, (signal) => api.document(id, signal));
  const row = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && !row} error={resource.error} retry={() => void resource.refresh()} skeleton />
    {row === null && !resource.error && <EmptyState title="Service unavailable" message="This service is no longer offered by your barangay, or the link is not valid."><Destination title="Back to Services" href="/services" /></EmptyState>}
    {row && <RequestGate key={row.id} row={row} />}
  </Screen>;
}

/** Shows the form once a resident may request this service and keeps it mounted if the readiness check is repeated. */
function RequestGate({ row }: { row: CatalogueRow }) {
  const { session } = useResident();
  const readiness = useServiceReadiness();
  const entry = describeService(row);
  const apply = applyState({ entry, signedIn: readiness.signedIn, profileComplete: readiness.profileComplete, idStatus: readiness.idStatus });
  const [wasReady, setWasReady] = useState(false);
  if (apply.kind === 'ready' && !wasReady) setWasReady(true);
  const userId = session?.user.id;
  if (!userId) return null;
  if (apply.kind !== 'ready' && !wasReady) return <ApplyBlock apply={apply} id={row.id} readiness={readiness} />;
  return <RequestForm row={row} entry={entry} userId={userId} apply={apply} readiness={readiness} />;
}

type Message = { text: string; tone: 'primary' | 'danger' };
const withoutKey = ({ idempotencyKey: _key, ...rest }: ServiceSubmissionInput): SubmissionDraft => rest;
type LegacyPhoto = { image: PickedImage; preview: string; uploadId: string; path: string | null };

function RequestForm({ row, entry, userId, apply, readiness }: { row: CatalogueRow; entry: ServiceEntry; userId: string; apply: ApplyState; readiness: ReturnType<typeof useServiceReadiness> }) {
  const router = useRouter();
  const blocked = apply.kind !== 'ready';
  const { client, config, profile } = useResident();
  const catalog = useMemo(() => catalogOf(row), [row]);
  const scope = useMemo<DataScope & { userId: string }>(() => ({ environment: config.environment, barangayId: config.barangayId, userId }), [config.environment, config.barangayId, userId]);

  const [loaded, setLoaded] = useState(false);
  const [touched, setTouched] = useState(false);
  const [fields, setFields] = useState<FormFields>(emptyFields);
  const [evidence, setEvidence] = useState<Evidence>({});
  const [uploads, setUploads] = useState<Partial<Record<Requirement, UploadState>>>({});
  const [legacyPhoto, setLegacyPhoto] = useState<LegacyPhoto | null>(null);
  const [locked, setLocked] = useState<ServiceSubmissionInput | null>(null);
  const [step, setStep] = useState<'edit' | 'review'>('edit');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [gate] = useState(createSingleFlight);
  const attemptRef = useRef<ResidentSubmissionAttempt | null>(null);
  const committed = useRef(false);

  // Restore the unsent form (and an unconfirmed attempt) from protected storage before showing it.
  useEffect(() => {
    let alive = true;
    loadRequestDraft(drafts, scope, row.id).then((draft) => {
      if (!alive) return;
      setFields(draft.fields);
      if (draft.attempt) {
        attemptRef.current = new ResidentSubmissionAttempt(draft.attempt.idempotencyKey);
        setLocked(draft.attempt);
        setStep('review');
      }
      setLoaded(true);
    }).catch(() => {
      if (!alive) return;
      setMessage({ text: 'Details saved on this device could not be read, so the form starts empty.', tone: 'danger' });
      setLoaded(true);
    });
    return () => { alive = false; };
  }, [scope, row.id]);

  // Typed answers (and a locked attempt) are saved shortly after each change.
  useEffect(() => {
    if (!loaded || !touched || committed.current) return;
    const timer = setTimeout(() => {
      if (committed.current) return;
      saveRequestDraft(drafts, scope, row.id, { fields, attempt: locked }).then(() => setSaveFailed(false), () => setSaveFailed(true));
    }, 600);
    return () => clearTimeout(timer);
  }, [loaded, touched, fields, locked, scope, row.id]);

  // Navigate only after the guard has observed the committed request, so leaving is not treated as discarding input.
  useEffect(() => {
    if (createdId) router.replace({ pathname: '/request/received', params: { id: createdId } });
  }, [createdId, router]);

  const hasUnsavedFiles = Object.keys(evidence).length > 0 || legacyPhoto !== null;
  useDiscardGuard(hasUnsavedFiles && !createdId && !locked);

  const update = (patch: Partial<FormFields>) => { setTouched(true); setFields((previous) => ({ ...previous, ...patch })); };
  const errors = useMemo(() => showErrors && catalog ? validateSubmission(catalog, buildSubmission(catalog, row.id, userId, fields, evidence)) : {}, [showErrors, catalog, row.id, userId, fields, evidence]);
  const notesError = !catalog && showErrors ? validateLegacyNotes(fields.notes) : undefined;
  const hasErrors = Object.keys(errors).length > 0 || !!notesError;
  const slots = catalog ? evidenceSlots(catalog, fields) : [];
  const option = catalog ? purposeOf(catalog, fields) : undefined;
  const pricing = feeNote(catalog, entry.priceLabel, fields);
  const sending = busy || gate.running;
  const disabled = sending || blocked;

  async function chooseFile(code: Requirement) {
    if (disabled) return;
    setMessage(null);
    try {
      const picked = await pickUploadFile('request-attachment');
      if (!picked) return;
      setTouched(true);
      setEvidence((previous) => ({ ...previous, [code]: { uploadId: randomUUID(), name: picked.name, mimeType: picked.mimeType, bytes: picked.bytes, uploaded: false } }));
      setUploads((previous) => ({ ...previous, [code]: undefined }));
    } catch (failure) {
      setMessage({ text: residentError(failure), tone: 'danger' });
    }
  }
  function removeFile(code: Requirement) {
    setEvidence((previous) => { const next = { ...previous }; delete next[code]; return next; });
    setUploads((previous) => ({ ...previous, [code]: undefined }));
  }
  async function choosePhoto(origin: ImageOrigin) {
    if (disabled) return;
    setMessage(null);
    try {
      const image = await pickImage('id-image', origin);
      if (image) { setTouched(true); setLegacyPhoto({ image, preview: bytesToDataUri(image.bytes, image.mimeType), uploadId: randomUUID(), path: null }); }
    } catch (failure) {
      setMessage({ text: residentError(failure), tone: 'danger' });
    }
  }
  function toggleRenter(isRenter: boolean) {
    update({ isRenter });
    if (catalog && !isRenter) setEvidence((previous) => pruneEvidence(catalog, { isRenter }, previous));
  }

  function review() {
    setShowErrors(true);
    setMessage(null);
    const invalid = catalog ? Object.keys(validateSubmission(catalog, buildSubmission(catalog, row.id, userId, fields, evidence))).length > 0 : !!validateLegacyNotes(fields.notes);
    if (invalid) { setMessage({ text: 'Check the fields marked below, then review again.', tone: 'danger' }); return; }
    setStep('review');
  }

  async function submit() {
    if (disabled) return;
    setMessage(null);
    setBusy(true);
    const outcome = await gate.run(async (): Promise<SendOutcome | { kind: 'upload-failed'; message: string }> => {
      let payload: SubmissionDraft;
      if (locked) {
        payload = withoutKey(locked);
      } else {
        const active = catalog ? pruneEvidence(catalog, fields, evidence) : {};
        let legacyPath: string | undefined;
        if (!catalog && legacyPhoto) {
          const result = legacyPhoto.path ? { ok: true as const, path: legacyPhoto.path } : await uploadLegacyId({ bucket: storageBucket(client, 'id-documents'), staged, scope }, legacyPhoto.uploadId, legacyPhoto.image);
          if (!result.ok) return { kind: 'upload-failed', message: result.message };
          legacyPath = result.path;
          setLegacyPhoto({ ...legacyPhoto, path: result.path });
        }
        payload = catalog ? buildSubmission(catalog, row.id, userId, fields, active) : buildLegacySubmission(row.id, fields.notes, legacyPath);
        if (catalog) {
          const result = await uploadEvidence({ bucket: storageBucket(client, 'request-attachments'), staged, scope }, active, (code, state) => setUploads((previous) => ({ ...previous, [code]: state })));
          if (!result.ok) return { kind: 'upload-failed', message: result.message };
        }
      }
      attemptRef.current ??= new ResidentSubmissionAttempt();
      const attempt = attemptRef.current;
      return sendRequest({
        client, staged, scope,
        persistAttempt: (value) => saveRequestDraft(drafts, scope, row.id, { fields, attempt: value }).then(() => true, () => false),
      }, attempt, payload).then((result) => {
        if (result.kind === 'unknown') setLocked({ ...payload, idempotencyKey: attempt.key });
        return result;
      });
    });
    setBusy(false);
    if (outcome.status === 'busy') return;
    if (outcome.status === 'failed' || outcome.status === 'unknown') { setMessage({ text: residentError(outcome.error), tone: 'danger' }); return; }
    const result = outcome.value;
    switch (result.kind) {
      case 'committed':
        committed.current = true;
        await clearRequestDraft(drafts, scope, row.id).catch(() => undefined);
        setCreatedId(result.id);
        return;
      case 'rejected':
        if (result.freshKey) attemptRef.current = new ResidentSubmissionAttempt();
        setLocked(null);
        setStep('edit');
        setMessage({ text: result.message, tone: 'danger' });
        return;
      case 'unknown':
        setStep('review');
        setMessage({ text: result.message, tone: 'danger' });
        return;
      case 'upload-failed':
        setMessage({ text: result.message, tone: 'danger' });
    }
  }

  async function startNew() {
    const proceed = await confirmDestructive({
      title: 'Start a new request?',
      message: 'The earlier request may already have been created. Check My requests first: starting a new one can create a second request.',
      confirmLabel: 'Start new request',
    });
    if (!proceed) return;
    attemptRef.current = new ResidentSubmissionAttempt();
    setLocked(null); setEvidence({}); setUploads({}); setLegacyPhoto(null); setStep('edit'); setMessage(null); setTouched(true);
  }

  if (!loaded) return <Loading label="Opening your request form…" />;

  const fileNames = Object.fromEntries(Object.entries(evidence).map(([code, file]) => [code, file.name])) as Partial<Record<Requirement, string>>;
  // A legacy photo is only uploaded on submit, so the review marks it attached by selection.
  const payload = locked ? withoutKey(locked) : catalog ? buildSubmission(catalog, row.id, userId, fields, evidence) : buildLegacySubmission(row.id, fields.notes, legacyPhoto ? 'selected-photo' : undefined);
  const summary = reviewLines(catalog, payload, fileNames);

  return <>
    <Card>
      <Body heading role="title1">{row.name}</Body>
      <Body tone="secondary">{pricing}</Body>
      {catalog && <Body role="footnote" tone="secondary">Fields marked * are required.</Body>}
    </Card>
    {blocked && <ApplyBlock apply={apply} id={row.id} readiness={readiness} />}
    <ResidentCard fullName={profile?.full_name ?? null} mobile={profile?.mobile_number ?? null} />
    <ApprovedIdCard approvedId={profile?.approved_id_submission_id ?? null} userId={userId} readiness={readiness} />
    {saveFailed && <Notice tone="danger" message="Your answers could not be saved on this device. Keep this screen open until you submit." />}

    {step === 'review' || locked
      ? <Card>
        <Body heading role="headline">{locked ? 'Waiting to confirm your request' : 'Review your request'}</Body>
        {locked && <Body tone="secondary">We could not confirm whether this request was created. Retry sends exactly the same details and cannot create a duplicate. You can also open My requests to check.</Body>}
        {summary.map(([label, value]) => <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2 }}>
          <Body role="footnote" tone="secondary">{label}</Body><Body>{value}</Body>
        </View>)}
        <Body role="footnote" tone="secondary">Your ID and attachments are private to you and barangay staff. Submitting sends your request for processing: it does not mean the request is paid, approved or released.</Body>
        {!!message && <Notice message={message.text} tone={message.tone} />}
        {sending && <Loading label={Object.values(uploads).includes('uploading') ? 'Uploading your files…' : 'Sending your request…'} />}
        <Action label={sending ? 'Submitting…' : locked ? 'Retry unchanged' : 'Submit request'} disabled={disabled} onPress={() => void submit()} />
        {locked
          ? <>
            <Destination title="Check My requests" href="/requests" />
            <Action label="Start a new request" secondary destructive disabled={sending} onPress={() => void startNew()} />
          </>
          : <Action label="Edit details" secondary disabled={sending} onPress={() => { setStep('edit'); setMessage(null); }} />}
      </Card>
      : <>
        {catalog ? <>
          <Card>
            <Selector label="Purpose of request" required options={catalog.purposes.map((purpose) => ({ value: purpose.code, label: purpose.label }))} selected={fields.purposeCode}
              disabled={disabled} error={errors.purposeCode} onChange={(code) => { setTouched(true); setFields((previous) => choosePurpose(previous, code)); }} />
            {option?.requiresExplanation && <>
              <Field label="Explain your purpose" required multiline maxLength={EXPLANATION_MAX} value={fields.explanation} editable={!disabled} error={errors.purposeExplanation} onChangeText={(explanation) => update({ explanation })} />
              <Body role="footnote" tone="secondary">{`${fields.explanation.trim().length}/${EXPLANATION_MAX} characters`}</Body>
            </>}
          </Card>
          <ServiceFields catalog={catalog} fields={fields} errors={errors} disabled={disabled} update={update} toggleRenter={toggleRenter} />
          {slots.map((slot) => <Card key={slot.code}>
            <Body heading role="headline">{`${slot.label}${slot.required ? ' *' : ' (optional)'}`}</Body>
            <Body role="footnote" tone="secondary">{FILE_HELP}</Body>
            {evidence[slot.code] ? <Body>{evidence[slot.code]?.name}</Body> : <Body tone="secondary">No file selected.</Body>}
            {uploads[slot.code] && <Body role="footnote" tone={uploads[slot.code] === 'failed' ? 'danger' : 'secondary'}>{UPLOAD_LABEL[uploads[slot.code] as UploadState]}</Body>}
            {errors[slot.code] && <Notice tone="danger" message={errors[slot.code] ?? ''} />}
            <Action label={evidence[slot.code] ? `Replace ${slot.label}` : `Choose ${slot.label}`} secondary disabled={disabled} onPress={() => void chooseFile(slot.code)} />
            {evidence[slot.code] && <Action label={`Remove ${slot.label}`} secondary destructive disabled={disabled} onPress={() => removeFile(slot.code)} />}
          </Card>)}
        </> : <Card>
          <Field label="Purpose of request" multiline maxLength={NOTES_MAX} value={fields.notes} editable={!disabled} placeholder="For example, employment requirement" error={notesError} onChangeText={(notes) => update({ notes })} />
          <Body role="footnote" tone="secondary">You will pick up this document in person at the Barangay Hall once it is ready.</Body>
          {releaseGates.privateIdUploads && <LegacyPhotoPicker photo={legacyPhoto} disabled={disabled} choose={(origin) => void choosePhoto(origin)} remove={() => setLegacyPhoto(null)} />}
        </Card>}
        {catalog && <Card>
          <Field label="Additional notes (optional)" multiline maxLength={NOTES_MAX} value={fields.notes} editable={!disabled} onChangeText={(notes) => update({ notes })} />
        </Card>}
        {!!message && <Notice message={message.text} tone={message.tone} />}
        {hasErrors && <Notice tone="danger" message="Some details need your attention before you can review the request." />}
        <Action label="Review request" disabled={disabled} onPress={review} />
      </>}
  </>;
}

function Line({ label, value }: { label: string; value: string }) {
  return <View accessible accessibilityLabel={`${label}: ${value}`}><Body role="footnote" tone="secondary">{label}</Body><Body>{value}</Body></View>;
}

function ResidentCard({ fullName, mobile }: { fullName: string | null; mobile: string | null }) {
  const router = useRouter();
  return <Card>
    <Body heading role="headline">Resident details</Body>
    <Line label="Name" value={fullName ?? 'Not on file'} />
    <Line label="Mobile number" value={mobile ?? 'No mobile number on file'} />
    <Action label="Edit in profile" secondary onPress={() => router.push('/settings/profile')} />
  </Card>;
}

/** The verified ID version the request reuses, with private previews (A11-006…009). */
function ApprovedIdCard({ approvedId, userId, readiness }: { approvedId: string | null; userId: string; readiness: ReturnType<typeof useServiceReadiness> }) {
  const api = useApi();
  const router = useRouter();
  const resource = useResource(`approved-id:${approvedId}`, (signal) => (approvedId ? api.approvedIdSubmission(approvedId, signal) : Promise.resolve(null)));
  const version = resource.data;
  const type = version ? decodeIdType(version.id_type) : null;
  return <Card>
    <Body heading role="headline">Approved profile ID</Body>
    {resource.loading && !version && <Loading label="Checking your approved ID…" />}
    {resource.error && <Notice tone="danger" message="We could not load your approved ID. Refresh verification and try again." />}
    {version && type && <>
      <StatusBadge label="Verified" icon="checkmark.circle" tone="success" />
      <Body>{`${type.type === 'Other' ? type.other : version.id_type} · version ${version.version}`}</Body>
      <PrivatePreview label={`Front of your approved ID, version ${version.version}`} path={version.front_path} userId={userId} />
      {version.back_path && <PrivatePreview label={`Back of your approved ID, version ${version.version}`} path={version.back_path} userId={userId} />}
    </>}
    {!version && !resource.loading && !resource.error && <Body tone="secondary">No approved ID is on file. Verify your ID to request a document.</Body>}
    <Action label="Refresh verification" secondary disabled={readiness.checking} onPress={() => { void readiness.retry(); void resource.refresh(); }} />
    {!version && !resource.loading && <Action label="Verify now" onPress={() => router.push('/settings/id-verification')} />}
  </Card>;
}

function LegacyPhotoPicker({ photo, disabled, choose, remove }: { photo: LegacyPhoto | null; disabled: boolean; choose: (origin: ImageOrigin) => void; remove: () => void }) {
  const colors = useColors();
  return <View style={{ gap: space[2] }}>
    <Body role="subheadline">ID photo (optional)</Body>
    {photo
      ? <Image source={{ uri: photo.preview }} accessibilityLabel="Selected ID photo" accessibilityIgnoresInvertColors resizeMode="cover" style={{ height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceSelected }} />
      : <Body tone="secondary">No photo selected.</Body>}
    <Action label={photo ? 'Replace photo from library' : 'Choose photo from library'} secondary disabled={disabled} onPress={() => choose('library')} />
    <Action label="Take a photo" secondary disabled={disabled} onPress={() => choose('camera')} />
    {photo && <Action label="Remove photo" secondary destructive disabled={disabled} onPress={remove} />}
    <Body role="footnote" tone="secondary">JPG, PNG or WEBP up to 5 MB. The photo is sent privately.</Body>
  </View>;
}

/** The kind-specific answers: business, residency, certified copy and the personal-appearance acknowledgment. */
function ServiceFields({ catalog, fields, errors, disabled, update, toggleRenter }: {
  catalog: ServiceCatalogContract; fields: FormFields; errors: Partial<Record<string, string>>; disabled: boolean;
  update: (patch: Partial<FormFields>) => void; toggleRenter: (value: boolean) => void;
}) {
  const kind = catalog.serviceKind;
  const residency = kind === 'indigency' || kind === 'first_time_job_seeker';
  if (kind !== 'business' && !residency && kind !== 'certified_true_copy' && !catalog.requirementRules.personalAppearance) return null;
  return <Card>
    {kind === 'business' && <>
      <Field label="Business name" required maxLength={BUSINESS_NAME_MAX} value={fields.businessName} editable={!disabled} error={errors.businessName} onChangeText={(businessName) => update({ businessName })} />
      <Field label="Establishment address" required multiline maxLength={ADDRESS_MAX} value={fields.address} editable={!disabled} error={errors.establishmentAddress} onChangeText={(address) => update({ address })} />
    </>}
    {residency && <>
      <Body role="footnote" tone="secondary">An HOA certification may support or establish residency. Renters also attach an endorsement from their lessor.</Body>
      <Toggle label="I am a renter" value={fields.isRenter} disabled={disabled} onChange={toggleRenter} />
    </>}
    {kind === 'certified_true_copy' && <>
      <Field label="Record/document reference" required multiline maxLength={REFERENCE_MAX} value={fields.recordReference} editable={!disabled} error={errors.recordReference} onChangeText={(recordReference) => update({ recordReference })} />
      <Field label="Number of copies" required keyboardType="number-pad" maxLength={4} value={fields.copies} editable={!disabled} error={errors.copies} onChangeText={(copies) => update({ copies })} />
      <Field label="Total pages across all copies" required keyboardType="number-pad" maxLength={7} value={fields.totalPages} editable={!disabled} error={errors.totalPages} onChangeText={(totalPages) => update({ totalPages })} />
    </>}
    {catalog.requirementRules.personalAppearance && <>
      <Toggle label="I understand personal appearance at the Barangay Hall is required" value={fields.appearance} disabled={disabled} onChange={(appearance) => update({ appearance })} />
      {errors.personalAppearanceAcknowledged && <Notice tone="danger" message={errors.personalAppearanceAcknowledged} />}
    </>}
  </Card>;
}
