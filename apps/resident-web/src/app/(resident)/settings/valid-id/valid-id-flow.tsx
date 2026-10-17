'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Camera, Upload } from 'lucide-react';
import { ID_TYPES, idConfirmedDetailsSchema, idPublicationSchema, idVerificationState, publishIdEvidence, type IdConfirmedDetails } from '@barangayan/shared';
import { Button, buttonVariants } from '@/components/ui/button';
import { InlineReadError } from '@/components/shared/inline-read-error';
import { LoadingStatus } from '@/components/shared/loading-status';
import { imageExtension } from '@/lib/image-upload';
import { cn } from '@/lib/utils';
import { beginAttempt, notify, type OperationId } from '@/lib/notify';
import { useSettingsIdStatus } from '../settings-id-status';
import { scrollSettingsContentToDetails, scrollSettingsContentToTop } from '../settings-content';
import { BirthdayDialog } from './birthday-dialog';
import { CameraDialog } from './camera-dialog';
import { birthdayMaximum, composedIdType, detailErrors, detailFields, detailLabels, emptyDetails, mergeSuggestions, readSuggestions, type DetailField } from './draft';
import { MAX_OCR_BYTES, PHOTO_ERROR, prepareOcrPhoto, validatePhoto } from './photo';
import { abortable, createIdClient } from './transport';
import { SavedId } from './saved-id';

const steps = [
  { title: 'Select ID type', description: 'Choose the valid ID you want to submit for verification.' },
  { title: 'Provide an ID photo', description: 'Upload or take a clear photo of the front of your ID. A back photo is not required.' },
  { title: 'Review and confirm details', description: 'Enter the details shown on the front of your ID. You can also choose to read suggestions from the photo.' },
  { title: 'Review and submit', description: 'Review your front ID photo and confirmed details before submitting them to the barangay.' },
];
const inputClass = 'w-full min-w-0 rounded-xl border border-input bg-background px-3 py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring aria-invalid:border-destructive';
const statusCopy = {
  verified: 'Your current ID is verified. Submitting a replacement requires a new staff review before it can be used for service requests.',
  pending: 'Your current ID is awaiting staff verification. Submission is not approval.',
  failed: 'Your current ID needs attention. Review the reason below and submit a replacement for staff review.',
  missing: 'Submit your ID for staff verification. Approval is required before requesting documents.',
};
type Photo = { file: File; path: string; preview: string };
type Action = { kind: 'upload' | 'ocr' | 'publish'; controller: AbortController; timer: ReturnType<typeof setTimeout>; attempt: OperationId };
type Snapshot = { submissionId: string; idType: string; frontPath: string; confirmedDetails: IdConfirmedDetails };

export function ValidIdFlow({ userId }: { userId: string }) {
  const status = useSettingsIdStatus();
  if (status.owner !== userId) return <div className="mx-auto max-w-2xl space-y-4 p-6">
    <h1 className="text-2xl font-bold">Valid ID</h1>
    {status.loading ? <LoadingStatus active label="Checking your account…" /> : <><p role="alert">Your session changed. Sign in again to continue with a fresh ID submission.</p><Link className="underline" href="/login?next=%2Fsettings%2Fvalid-id">Sign in</Link></>}
  </div>;
  return <ResidentIdDraft key={userId} userId={userId} />;
}

function ResidentIdDraft({ userId }: { userId: string }) {
  const status = useSettingsIdStatus();
  const [replacing, setReplacing] = useState(false);
  const [step, setStep] = useState(1);
  const [type, setType] = useState('');
  const [other, setOther] = useState('');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [details, setDetails] = useState(emptyDetails);
  const edited = useRef(new Set<DetailField>());
  const birthdayProtected = useRef(false);
  const [errors, setErrors] = useState<Partial<Record<DetailField, string>>>({});
  const focusInvalid = useRef(false);
  const [error, setError] = useState('');
  const [ocrFeedback, setOcrFeedback] = useState('');
  const [ocrRetry, setOcrRetry] = useState(false);
  const [busy, setBusy] = useState<Action['kind'] | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const active = useRef<Action | null>(null);
  const publication = useRef<Snapshot | null>(null);
  const derivative = useRef<{ source: string; path: string } | null>(null);
  const mounted = useRef(false);
  const preview = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const detailsStart = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraTrigger = useRef<HTMLButtonElement>(null);
  const birthdayTrigger = useRef<HTMLButtonElement>(null);
  const idType = composedIdType(type, other);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const action = active.current;
      active.current = null;
      if (action) { action.controller.abort(); clearTimeout(action.timer); }
      if (preview.current) URL.revokeObjectURL(preview.current);
    };
  }, []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if ((step === 3 || step === 4) && !submitted) return scrollSettingsContentToDetails(detailsStart.current);
    scrollSettingsContentToTop(heading.current);
  }, [step, submitted, replacing]);
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    const field = detailFields.find(field => errors[field]);
    if (field) document.getElementById(`valid-id-${field}`)?.focus();
  }, [errors]);

  function current(action: Action) { return mounted.current && status.isOwner(userId) && active.current === action; }
  function acquire(kind: Action['kind'], duration: number): Action | null {
    if (active.current || !status.isOwner(userId) || !status.access) return null;
    const controller = new AbortController();
    const action: Action = { kind, controller, timer: setTimeout(() => controller.abort(), duration), attempt: beginAttempt(`id-${kind}`) };
    active.current = action;
    setBusy(kind); setError('');
    return action;
  }
  function release(action: Action) {
    clearTimeout(action.timer);
    if (current(action)) { active.current = null; setBusy(null); }
  }
  function cancel(announce = false) {
    const action = active.current;
    if (!action || action.kind === 'publish') return;
    active.current = null;
    action.controller.abort(); clearTimeout(action.timer);
    setBusy(null);
    if (action.kind === 'ocr') setOcrFeedback('Photo reading cancelled. You can enter the details below.');
    if (announce) notify.info(action.kind === 'ocr' ? 'Photo reading cancelled. You can enter the details manually.' : 'Photo upload cancelled.', { id: action.attempt });
  }
  async function verifiedClient(action: Action) {
    const client = createIdClient(action.controller.signal);
    const { data: { user }, error } = await abortable(client.auth.getUser(), action.controller.signal);
    if (error || !user || user.is_anonymous || user.id !== userId || !status.isOwner(userId)) throw new Error('session');
    return client;
  }
  function actionMessage(cause: unknown, fallback: string) {
    if (cause instanceof Error && cause.message === 'session') return 'Sign in again before continuing your ID submission.';
    if (cause instanceof Error && cause.message === 'access') return 'Your account cannot access this ID photo. Sign in with an active resident account or contact your barangay.';
    return fallback;
  }
  async function choosePhoto(file: File) {
    const action = acquire('upload', 45000);
    if (!action) return;
    let validated = false;
    try {
      await validatePhoto(file, action.controller.signal);
      validated = true;
      const client = await verifiedClient(action);
      const path = `${userId}/versions/${crypto.randomUUID()}/id-front.${imageExtension(file.type)}`;
      const { error: uploadError } = await abortable(client.storage.from('id-documents').upload(path, file, { upsert: false, contentType: file.type }), action.controller.signal);
      if (uploadError) throw new Error(uploadError.status === 401 ? 'session' : uploadError.status === 403 ? 'access' : 'upload');
      if (!current(action)) return;
      const nextPreview = URL.createObjectURL(file);
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = nextPreview;
      setPhoto({ file, path, preview: nextPreview });
      edited.current.clear(); setDetails(emptyDetails()); setErrors({}); setOcrFeedback(''); setOcrRetry(false);
      derivative.current = null; publication.current = null;
      notify.success('ID photo uploaded. Review the details before submitting.', { id: action.attempt });
    } catch (cause) {
      if (current(action)) {
        setError(actionMessage(cause, validated ? 'Could not upload this photo. Your previous photo and details are unchanged. Try again.' : PHOTO_ERROR));
        notify.error("Couldn't upload the ID photo. Please try again.", { id: action.attempt });
      }
    } finally { release(action); }
  }
  async function readPhoto() {
    if (!photo || !idType) return;
    const action = acquire('ocr', 90000);
    if (!action) return;
    setOcrFeedback('');
    setOcrRetry(false);
    try {
      const client = await verifiedClient(action);
      let path = derivative.current?.source === photo.path ? derivative.current.path : null;
      if (!path) {
        const image = await prepareOcrPhoto(photo.file, action.controller.signal);
        if (!image.size || image.size > MAX_OCR_BYTES) throw new Error('derivative');
        path = `${userId}/versions/${crypto.randomUUID()}/id-front.jpg`;
        const { error: uploadError } = await abortable(client.storage.from('id-documents').upload(path, image, { upsert: false, contentType: 'image/jpeg' }), action.controller.signal);
        if (uploadError) throw new Error(uploadError.status === 401 ? 'session' : uploadError.status === 403 ? 'access' : 'derivative');
        if (!current(action)) return;
        derivative.current = { source: photo.path, path };
      }
      const result = await abortable(client.functions.invoke('extract-resident-id-ocrspace', { body: { frontPath: path, idType }, signal: action.controller.signal }), action.controller.signal);
      if (!current(action)) return;
      if (result.error) {
        const response: unknown = result.error.context;
        const code = response instanceof Response ? response.status : 0;
        if (code === 401 || code === 403) throw new Error('session');
        throw new Error(code === 429 ? 'limited' : 'ocr');
      }
      const suggestions = readSuggestions(result.data);
      if (!suggestions) throw new Error('ocr');
      // Any calendar suggestion must also fit the local/UTC wheel maximum.
      if (suggestions.birthDate > birthdayMaximum()) suggestions.birthDate = '';
      setDetails(previous => mergeSuggestions(previous, birthdayProtected.current ? new Set([...edited.current, 'birthDate']) : edited.current, suggestions));
      const warnings: unknown = result.data?.warnings;
      const safeWarnings = Array.isArray(warnings) && warnings.every(item => typeof item === 'string' && item.length < 200) ? warnings as string[] : [];
      // Optional fields may legitimately be absent on the ID. Only a missing required
      // name or service warnings establish an incomplete read.
      const incomplete = !suggestions.fullName.trim() || safeWarnings.length > 0;
      notify[incomplete ? 'warning' : 'success'](incomplete ? "Some ID details couldn't be read. Check and complete them manually." : 'ID details read. Review every value before submitting.', { id: action.attempt });
      setOcrRetry(!Object.values(suggestions).some(Boolean));
      setOcrFeedback([Object.values(suggestions).some(Boolean) ? 'Suggestions are ready. Review every value and correct anything missing or incorrect.' : "We couldn't read details from this photo. Enter them below.", ...safeWarnings].join(' '));
    } catch (cause) {
      if (current(action)) {
        notify.error("Couldn't read the ID photo. You can enter the details manually.", { id: action.attempt });
        setOcrRetry(!(cause instanceof Error && cause.message === 'session'));
        setOcrFeedback(actionMessage(cause, cause instanceof Error && cause.message === 'limited' ? 'Photo reading is temporarily unavailable. Enter the details below or try again later.' : "We couldn't read your ID photo. You can enter the details below."));
      }
    } finally { release(action); }
  }
  function edit(field: DetailField, value: string) {
    edited.current.add(field);
    setDetails(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    publication.current = null;
  }
  function continueFlow() {
    const attempt = beginAttempt('id-validation');
    if (step === 1 && !idType) { setError('Choose an ID type. For Other, enter an ID name of at most 193 characters.'); notify.error('Review the highlighted ID details.', { id: attempt }); return; }
    if (step === 2 && !photo) { setError('Upload a front ID photo before continuing.'); notify.error('Review the highlighted ID details.', { id: attempt }); return; }
    if (step === 3) {
      const fieldErrors = detailErrors(details);
      if (details.birthDate && details.birthDate > birthdayMaximum()) fieldErrors.birthDate = 'Choose a valid date of birth.';
      if (Object.keys(fieldErrors).length) { focusInvalid.current = true; setErrors(fieldErrors); notify.error('Review the highlighted ID details.', { id: attempt }); return; }
      cancel();
      setDetails(idConfirmedDetailsSchema.parse(details));
    }
    setError(''); setStep(Math.min(4, step + 1));
  }
  async function submit() {
    if (!photo || !idType || active.current) return;
    const parsed = idPublicationSchema.safeParse(publication.current ?? { submissionId: crypto.randomUUID(), idType, frontPath: photo.path, confirmedDetails: details });
    if (!parsed.success || !parsed.data.confirmedDetails || (parsed.data.confirmedDetails.birthDate && parsed.data.confirmedDetails.birthDate > birthdayMaximum())) {
      notify.error('Review the highlighted ID details.', { id: beginAttempt('id-validation') });
      const fieldErrors = detailErrors(details);
      if (details.birthDate && details.birthDate > birthdayMaximum()) fieldErrors.birthDate = 'Choose a valid date of birth.';
      focusInvalid.current = true; setErrors(fieldErrors); setError('Review the ID details before submitting.'); setStep(3); return;
    }
    const action = acquire('publish', 90000);
    if (!action) return;
    const snapshot = publication.current ?? { submissionId: parsed.data.submissionId, idType: parsed.data.idType, frontPath: parsed.data.frontPath, confirmedDetails: { ...parsed.data.confirmedDetails } };
    publication.current = snapshot;
    try {
      const client = await verifiedClient(action);
      if (uncertain) {
        const result = await abortable(client.from('id_submissions').select('id, id_type, front_path, confirmed_details').eq('id', snapshot.submissionId).eq('resident_id', userId).maybeSingle(), action.controller.signal);
        if (result.error) throw new Error('unknown');
        if (result.data) {
          const saved = idConfirmedDetailsSchema.safeParse(result.data.confirmed_details);
          const extension = snapshot.frontPath.split('.').pop();
          const expectedPath = `${userId}/versions/${snapshot.submissionId}/id-front.${extension}`;
          if (result.data.id_type !== snapshot.idType || result.data.front_path !== expectedPath || !saved.success || detailFields.some(field => saved.data[field] !== snapshot.confirmedDetails[field])) throw new Error('unknown');
        } else {
          // Not-found is not proof of failure. Retry exactly the same immutable ID.
          await abortable(publishIdEvidence(client, snapshot), action.controller.signal);
        }
      } else await abortable(publishIdEvidence(client, snapshot), action.controller.signal);
      if (!current(action)) return;
      setUncertain(false); setSubmitted(snapshot.submissionId);
      notify.success(uncertain ? 'Your ID submission is confirmed and awaiting staff review.' : 'ID submitted for staff review.', { id: action.attempt });
      void status.refresh();
    } catch (cause) {
      if (current(action)) {
        const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
        const rejected = !uncertain && typeof code === 'string' && (code.startsWith('22') || code === '42501');
        if (rejected) publication.current = null;
        setUncertain(!rejected);
        notify[rejected ? 'error' : 'warning'](rejected ? "Your ID submission couldn't be accepted. Review the details and try again." : uncertain ? "We still couldn't confirm your submission. Use Retry to check again." : "We couldn't confirm your ID submission. Use Retry to check the same submission.", { id: action.attempt });
        setError(actionMessage(cause, rejected ? code === '42501' ? 'Your account cannot submit this ID. Sign in with an active resident account or contact your barangay.' : 'These ID details could not be accepted. Review them and try again.' : "We couldn't confirm your submission. Retry to check the same submission."));
      }
    } finally { release(action); }
  }
  const intro = steps[step - 1];
  const locked = busy === 'publish' || uncertain;
  const disabled = !status.access || busy === 'upload' || busy === 'publish';
  function startReplacement() {
    if (submitted) {
      // A newly approved submission must never be reused as the replacement draft.
      publication.current = null; derivative.current = null;
      if (preview.current) URL.revokeObjectURL(preview.current);
      preview.current = null;
      edited.current.clear(); birthdayProtected.current = false;
      setStep(1); setType(''); setOther(''); setPhoto(null); setDetails(emptyDetails());
      setErrors({}); setError(''); setOcrFeedback(''); setOcrRetry(false); setUncertain(false);
      setSubmitted(null);
    }
    setReplacing(true);
  }
  const verification = idVerificationState(status.profile);
  const saved = !status.loading && !status.error && status.access && (verification === 'verified' || verification === 'pending');
  const summaryId = submitted ? status.profile?.current_id_submission_id ?? submitted : saved && !replacing ? status.profile?.current_id_submission_id : null;
  if (summaryId) return <SavedId key={summaryId} userId={userId} submissionId={summaryId} lastSubmittedId={submitted} onReplace={startReplacement} />;
  if ((status.loading || status.error) && !replacing && !submitted && step === 1 && !type) return <div className="mx-auto max-w-2xl space-y-4 px-4 py-5 sm:px-6 sm:py-8"><h1 className="text-2xl font-bold">Valid ID</h1>{status.loading ? <LoadingStatus active label="Checking verification status…" /> : <InlineReadError message={status.error!} onRetry={() => void status.refresh()} />}</div>;
  return <div className="mx-auto max-w-2xl space-y-6 px-4 py-5 sm:px-6 sm:py-8">
    {saved && replacing && !busy && !uncertain && !submitted ? <Button variant="outline" onClick={() => setReplacing(false)}>{verification === 'verified' ? 'Back to verified ID' : 'Back to submitted ID'}</Button> : null}
    <div className="space-y-3" aria-label={`Valid ID submission, step ${step} of 4`}>
      <p className="text-xs font-semibold text-muted-foreground">Step {step} of 4</p>
      <div aria-hidden className="flex gap-2">{[1, 2, 3, 4].map(item => <span key={item} className={`h-1.5 flex-1 rounded-full ${item <= step ? 'bg-[var(--accent)]' : 'bg-muted'}`} />)}</div>
    </div>
    <div><h1 ref={heading} tabIndex={-1} className="scroll-mt-6 text-2xl font-bold tracking-tight outline-none">{intro.title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{intro.description}</p></div>
    <aside className="rounded-xl border border-border bg-muted/30 p-4 text-sm" aria-live="polite">
      {status.loading ? <LoadingStatus active label="Checking verification status…" /> : status.error ? <InlineReadError message={submitted ? 'Your ID was submitted. Verification status is temporarily unavailable.' : status.error} onRetry={() => void status.refresh()} /> : <><p>{statusCopy[idVerificationState(status.profile)]}</p>{status.reason ? <p className="mt-2 whitespace-pre-wrap break-words">Reason: {status.reason}</p> : null}</>}
    </aside>
      {step === 1 ? <div className="space-y-4"><label className="block text-sm font-semibold" htmlFor="valid-id-type">ID type</label>
        <select id="valid-id-type" className={inputClass} value={type} disabled={locked} onChange={event => { cancel(); setType(event.target.value); publication.current = null; setOcrFeedback(''); setOcrRetry(false); setError(''); }}><option value="">Select ID type</option>{ID_TYPES.map(item => <option key={item} value={item}>{item}</option>)}</select>
        {type === 'Other' ? <div><label className="mb-2 block text-sm font-semibold" htmlFor="valid-id-other">Exact ID name</label><input id="valid-id-other" className={inputClass} value={other} disabled={locked} onChange={event => { cancel(); setOther(event.target.value); publication.current = null; setOcrFeedback(''); setOcrRetry(false); }} /><p className="mt-2 text-xs text-muted-foreground">Up to 193 characters.</p></div> : null}
      </div> : null}
      {step >= 2 && photo ? <figure><Image unoptimized src={photo.preview} width={1000} height={640} alt="Front ID photo selected for submission" className="max-h-80 w-full rounded-xl border border-border bg-muted/30 object-contain" /><figcaption className="mt-2 text-xs text-muted-foreground">Front photo · {step === 2 ? 'Uploaded. Continue to enter your details.' : 'Check that all details match this photo.'}</figcaption></figure> : null}
      {step === 2 ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Use JPG, PNG, or WebP, up to 5 MB. Keep the entire front visible and the text readable.</p>
        <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose front ID photo" className="sr-only" tabIndex={-1} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void choosePhoto(file); }} />
        <div className="flex flex-wrap gap-3"><Button variant="outline" disabled={disabled || locked} onClick={() => fileInput.current?.click()}><Upload aria-hidden size={18} />Upload a photo</Button><button type="button" ref={cameraTrigger} className={buttonVariants({ variant: 'outline' })} disabled={disabled || locked} onClick={() => setCameraOpen(true)}><Camera aria-hidden size={18} />Take a photo</button></div>
        {busy === 'upload' ? <div className="flex flex-wrap items-center gap-3"><LoadingStatus active label="Checking and uploading photo…" /><Button variant="ghost" onClick={() => cancel(true)}>Cancel upload</Button></div> : null}
      </div> : null}
      {step === 3 ? <div className="space-y-5">
        <div className="space-y-3 rounded-xl border border-border p-4"><p className="text-sm leading-6 text-muted-foreground">Optional: Read details from photo sends a smaller copy of your ID photo to OCR.space for text recognition. You can enter everything yourself instead. OCR.space states it deletes uploaded documents after processing. <a className="underline" href="https://ocr.space/privacypolicy" target="_blank" rel="noreferrer">OCR.space privacy policy</a></p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-auto min-h-11 max-w-full whitespace-normal" disabled={!!busy || !status.access} onClick={() => void readPhoto()}>{ocrRetry ? 'Try reading again' : 'Read details from photo'}</Button>{busy === 'ocr' ? <Button variant="ghost" className="h-auto min-h-11 max-w-full whitespace-normal" onClick={() => cancel(true)}>Cancel reading</Button> : null}</div>
          <LoadingStatus active={busy === 'ocr'} label="Reading photo… You can keep entering details." />
          {ocrFeedback ? <p className="text-sm">{ocrFeedback}</p> : null}
        </div>
        <p className="text-sm text-muted-foreground">Full name is required. Leave optional details blank when they are not printed on the front.</p>
        {detailFields.map(field => <div key={field} ref={field === 'fullName' ? detailsStart : undefined} data-id-details={field === 'fullName' ? '' : undefined}><label htmlFor={`valid-id-${field}`} className="mb-2 block text-sm font-semibold">{detailLabels[field]} {field === 'fullName' ? '(required)' : '(optional)'}</label>
          {field === 'birthDate' ? <button type="button" ref={birthdayTrigger} id={`valid-id-${field}`} className={cn(buttonVariants({ variant: 'outline' }), 'h-auto min-h-11 w-full justify-start whitespace-normal text-left')} aria-describedby={errors[field] ? `valid-id-error-${field}` : undefined} onClick={() => { birthdayProtected.current = true; setBirthdayOpen(true); }}>{details.birthDate || 'Select date of birth'}</button> : field === 'address' ? <textarea id={`valid-id-${field}`} className={inputClass} rows={3} value={details[field]} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `valid-id-error-${field}` : undefined} onChange={event => edit(field, event.target.value)} /> : <input id={`valid-id-${field}`} className={inputClass} value={details[field]} autoComplete="off" required={field === 'fullName'} aria-invalid={!!errors[field]} aria-describedby={errors[field] ? `valid-id-error-${field}` : undefined} onChange={event => edit(field, event.target.value)} />}
          {errors[field] ? <p id={`valid-id-error-${field}`} className="mt-2 text-sm text-destructive">{errors[field]}</p> : null}
        </div>)}
      </div> : null}
      {step === 4 ? <div ref={detailsStart} data-id-details className="space-y-5"><dl className="space-y-4 rounded-xl border border-border p-4"><div><dt className="text-xs text-muted-foreground">ID type</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold">{idType}</dd></div>{detailFields.map(field => <div key={field}><dt className="text-xs text-muted-foreground">{detailLabels[field]}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold">{details[field] || 'Not shown on ID'}</dd></div>)}</dl><p className="text-sm text-muted-foreground">Submit this photo and these confirmed details for staff verification. Submitting a replacement requires a new review.</p></div> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        {step > 1 ? <Button variant="outline" disabled={disabled || locked} onClick={() => { cancel(); setError(''); setStep(Math.max(1, step - 1)); }}>Previous</Button> : null}
        <Button disabled={disabled || (step === 1 && !idType) || (step === 2 && !photo)} loading={busy === 'publish'} className="h-auto min-h-11 max-w-full whitespace-normal" onClick={step === 4 ? () => void submit() : continueFlow}>{step === 4 ? uncertain ? 'Retry same submission' : 'Submit' : 'Continue'}</Button>
      </div>
      <LoadingStatus active={busy === 'publish'} label="Submitting your ID…" className="sr-only" />
      {uncertain ? <p className="text-sm text-muted-foreground">The outcome is unknown. Your reviewed submission is locked until a same-submission retry confirms it.</p> : null}
    {cameraOpen && step === 2 && !submitted ? <CameraDialog triggerRef={cameraTrigger} onClose={() => setCameraOpen(false)} onPhoto={file => { setCameraOpen(false); void choosePhoto(file); }} /> : null}
    {birthdayOpen && step === 3 && !submitted ? <BirthdayDialog triggerRef={birthdayTrigger} value={details.birthDate} onClose={() => { birthdayProtected.current = false; setBirthdayOpen(false); }} onConfirm={value => { edit('birthDate', value); birthdayProtected.current = false; setBirthdayOpen(false); }} /> : null}
  </div>;
}
