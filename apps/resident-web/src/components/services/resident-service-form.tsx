'use client';
/* eslint-disable @next/next/no-img-element -- private signed URLs are short-lived evidence previews. */

import {
  residentServiceError,
  catalogContract,
  charterSections,
  createRequestKey,
  idVerificationMessages,
  idVerificationState,
  ResidentSubmissionAttempt,
  servicePriceLabel,
  submissionSchemaForCatalog,
  SUPPORTING_FILE_MAX_BYTES,
  SUPPORTING_FILE_MIME_TYPES,
  uploadSupportingEvidence,
  type Database,
  type Tables,
  type ServiceSubmissionInput,
} from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';

type Client = SupabaseClient<Database>;
type Requirement = ServiceSubmissionInput['attachments'][number]['requirementCode'];
const fieldClass = 'w-full rounded-lg border border-input bg-background p-3 text-sm';
const buttonClass = 'min-h-12 rounded-lg bg-primary px-5 py-3 text-primary-foreground disabled:opacity-50';

/** Fresh approval only: account changes, failed refreshes and stale responses clear it. */
export function useResidentEvidence(client: Client) {
  const [profile, setProfile] = useState<Tables<'profiles'> | null>(null);
  const [evidence, setEvidence] = useState<Tables<'id_submissions'> | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const ticket = ++generation.current;
    setLoading(true);
    setProfile(null);
    setEvidence(null);
    setImages([]);
    setError(null);
    try {
      const {
        data: { user },
        error: authError,
      } = await client.auth.getUser();
      if (authError) throw authError;
      if (!user) return;
      const { data, error: queryError } = await client
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (queryError) throw queryError;
      if (ticket !== generation.current) return;
      setProfile(data);
      if (idVerificationState(data) === 'verified') {
        const { data: approved, error: approvalError } = await client
          .from('id_submissions')
          .select('*')
          .eq('id', data.approved_id_submission_id!)
          .eq('resident_id', user.id)
          .single();
        if (approvalError || approved?.decision !== 'verified')
          throw new Error('Could not confirm approved ID. Refresh and try again.');
        const signed = await Promise.all(
          [approved.front_path, approved.back_path].map((path) =>
            client.storage.from('id-documents').createSignedUrl(path, 600),
          ),
        );
        if (ticket !== generation.current) return;
        if (signed.some((result) => result.error))
          throw new Error('Could not load ID previews. Refresh and try again.');
        setEvidence(approved);
        setImages(signed.map((result) => result.data!.signedUrl));
      }
    } catch (failure) {
      if (ticket === generation.current) {
        setProfile(null);
        setEvidence(null);
        setImages([]);
        setError(
          failure instanceof Error ? failure.message : 'Could not refresh verification. Reconnect and retry.',
        );
      }
    } finally {
      if (ticket === generation.current) setLoading(false);
    }
  }, [client]);
  useEffect(() => {
    const requestGeneration = generation;
    let channel: ReturnType<Client['channel']> | null = null;
    void Promise.resolve().then(refresh);
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      ++generation.current;
      setProfile(null);
      setEvidence(null);
      setImages([]);
      if (channel) void client.removeChannel(channel);
      channel = session
        ? client
            .channel(`service-evidence:${session.user.id}:${createRequestKey()}`)
            .on(
              'postgres_changes',
              { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
              () => void refresh(),
            )
            .subscribe()
        : null;
      // Avoid another auth operation inside the auth callback's lock.
      void Promise.resolve().then(refresh);
    });
    const focused = () => void refresh();
    window.addEventListener('focus', focused);
    return () => {
      ++requestGeneration.current;
      subscription.unsubscribe();
      if (channel) void client.removeChannel(channel);
      window.removeEventListener('focus', focused);
    };
  }, [client, refresh]);
  return { profile, evidence, images, loading, error, refresh };
}

export function VerificationNotice({
  client,
  profileHref = '/settings/profile#upload-valid-id',
}: {
  client: Client;
  profileHref?: string;
}) {
  const { profile, loading, error, refresh } = useResidentEvidence(client);
  if (loading)
    return (
      <p role="status" className="my-4 rounded-xl border p-4">
        Checking ID verification…
      </p>
    );
  if (!profile && !error) return null;
  const state = idVerificationState(profile);
  if (state === 'verified')
    return (
      <p role="status" className="my-4 rounded-xl border p-4 font-semibold">
        Valid ID Verified
      </p>
    );
  return (
    <aside role="status" className="my-4 rounded-xl border border-amber-500 bg-amber-50 p-4 text-zinc-900">
      <p>{error ?? idVerificationMessages[state]}</p>
      <a className="mt-2 inline-block font-semibold underline" href={profileHref}>
        Verify Now
      </a>
      {error ? (
        <button type="button" onClick={() => void refresh()} className="ml-4 underline">
          Retry verification check
        </button>
      ) : null}
    </aside>
  );
}

export function ServiceCharter({ doc }: { doc: Tables<'document_types'> }) {
  const catalog = catalogContract(doc);
  if (!catalog)
    return (
      <ul className="list-inside list-disc">
        {doc.requirements.map((requirement) => (
          <li key={requirement}>{requirement}</li>
        ))}
      </ul>
    );
  return (
    <dl className="space-y-4">
      {charterSections.map(([key, label]) => (
        <div key={key}>
          <dt className="font-semibold">{label}</dt>
          <dd className="whitespace-pre-wrap text-sm">
            {catalog.charter[key] ?? 'Not specified in the source charter'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Used by the drawer, deep link and the older resident portal. Key by service ID. */
export function ResidentServiceForm({
  doc,
  client,
  onSubmitted,
  profileHref = '/settings/profile#upload-valid-id',
}: {
  doc: Tables<'document_types'>;
  client: Client;
  onSubmitted: (id: string, reference: string) => void;
  profileHref?: string;
}) {
  const catalog = catalogContract(doc);
  const approved = useResidentEvidence(client);
  const [purpose, setPurpose] = useState('');
  const [explanation, setExplanation] = useState('');
  const [notes, setNotes] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [renter, setRenter] = useState(false);
  const [reference, setReference] = useState('');
  const [copies, setCopies] = useState('1');
  const [appearance, setAppearance] = useState(false);
  const [files, setFiles] = useState<Partial<Record<Requirement, { file: File; id: string }>>>({});
  const [legacyId, setLegacyId] = useState<File | null>(null);
  const legacyPath = useRef<string | null>(null);
  const [attempt] = useState(() => new ResidentSubmissionAttempt());
  const busy = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const purposeOption = catalog?.purposes.find((option) => option.code === purpose);
  function chooseFile(code: Requirement, file?: File) {
    if (!file) return;
    if (
      !(SUPPORTING_FILE_MIME_TYPES as readonly string[]).includes(file.type) ||
      file.size <= 0 ||
      file.size > SUPPORTING_FILE_MAX_BYTES
    ) {
      setError('Choose a JPG, PNG, WEBP or PDF file up to 5 MB.');
      return;
    }
    setError(null);
    setFiles((previous) => ({ ...previous, [code]: { file, id: createRequestKey() } }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      if (
        catalog &&
        (idVerificationState(approved.profile) !== 'verified' || !approved.evidence || approved.loading)
      )
        throw new Error('Your profile ID must be verified before submitting.');
      const attachments: ServiceSubmissionInput['attachments'] = [];
      for (const [code, selected] of Object.entries(files))
        if (selected)
          attachments.push(
            await uploadSupportingEvidence(client, {
              uploadId: selected.id,
              requirementCode: code as Requirement,
              mimeType: selected.file.type,
              bytes: new Uint8Array(await selected.file.arrayBuffer()),
            }),
          );
      const value: Omit<ServiceSubmissionInput, 'idempotencyKey'> = {
        documentTypeId: doc.id,
        purposeCode: catalog ? purpose : 'legacy',
        requesterNotes: notes.trim() || undefined,
        details: {},
        attachments,
      };
      if (catalog) {
        if (purposeOption?.requiresExplanation) value.purposeExplanation = explanation.trim();
        if (catalog.serviceKind === 'business')
          value.details = { businessName: businessName.trim(), establishmentAddress: address.trim() };
        if (['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind))
          value.details.isRenter = renter;
        if (catalog.serviceKind === 'certified_true_copy')
          value.details = { recordReference: reference.trim(), copies: Number(copies) };
        if (catalog.requirementRules.personalAppearance)
          value.details.personalAppearanceAcknowledged = appearance;
        submissionSchemaForCatalog(catalog).parse({ ...value, idempotencyKey: attempt.key });
      } else if (legacyId) {
        if (
          !['image/jpeg', 'image/png', 'image/webp'].includes(legacyId.type) ||
          legacyId.size > SUPPORTING_FILE_MAX_BYTES
        )
          throw new Error('ID must be JPG, PNG or WEBP up to 5 MB.');
        const {
          data: { user },
        } = await client.auth.getUser();
        if (!user) throw new Error('Sign in again.');
        legacyPath.current ??= `${user.id}/${createRequestKey()}/id.${legacyId.type.split('/')[1] === 'jpeg' ? 'jpg' : legacyId.type.split('/')[1]}`;
        const bucket = client.storage.from('id-documents');
        const bytes = new Uint8Array(await legacyId.arrayBuffer());
        const { error: uploadError } = await bucket.upload(legacyPath.current, bytes, {
          contentType: legacyId.type,
          upsert: false,
        });
        if (uploadError) {
          const { data } = await bucket.download(legacyPath.current);
          const saved = data ? new Uint8Array(await data.arrayBuffer()) : null;
          if (!saved || saved.length !== bytes.length || saved.some((v, i) => v !== bytes[i]))
            throw uploadError;
        }
        value.legacyIdPath = legacyPath.current;
      }
      const result = await attempt.submit(client, value);
      onSubmitted(result.id, result.reference_number);
    } catch (failure) {
      setError(residentServiceError(failure));
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }
  const upload = (code: Requirement, label: string, required: boolean) => (
    <label className="block rounded-xl border p-4" key={code}>
      {label}
      {required ? ' (required)' : ' (optional)'}
      <input
        aria-label={label}
        type="file"
        accept={SUPPORTING_FILE_MIME_TYPES.join(',')}
        disabled={submitting}
        onChange={(event) => {
          chooseFile(code, event.target.files?.[0]);
          event.target.value = '';
        }}
        className="mt-2 block w-full"
      />
      {files[code] ? (
        <span className="mt-2 block text-sm">
          {files[code]!.file.name}{' '}
          <button
            type="button"
            disabled={submitting}
            className="underline"
            onClick={() =>
              setFiles((previous) => {
                const next = { ...previous };
                delete next[code];
                return next;
              })
            }
          >
            Remove {label}
          </button>
        </span>
      ) : null}
      <span className="block text-xs">JPG, PNG, WEBP or PDF · maximum 5 MB</span>
    </label>
  );
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <h2 className="text-xl font-semibold">{doc.name}</h2>
      <p>{servicePriceLabel(doc)}</p>
      <section className="rounded-xl border p-4">
        <h3 className="font-semibold">Resident Details</h3>
        <p>
          {approved.profile?.full_name ?? 'Loading resident details…'} ·{' '}
          {approved.profile?.mobile_number ?? 'No mobile number on file'}
        </p>
        <a className="inline-block min-h-12 py-3 underline" href={profileHref.split('#')[0]}>
          Edit in Profile
        </a>
      </section>
      {catalog ? (
        <section className="rounded-xl border p-4">
          <h3 className="font-semibold">Approved profile ID</h3>
          <p role="status">
            {approved.loading
              ? 'Checking verification…'
              : (approved.error ?? idVerificationMessages[idVerificationState(approved.profile)])}
          </p>
          {approved.evidence ? (
            <>
              <p>
                {approved.profile?.full_name} · {approved.profile?.mobile_number}
                <br />
                {approved.evidence.id_type} · version {approved.evidence.version}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {approved.images.map((url, index) => (
                  <img
                    key={url}
                    src={url}
                    alt={`Approved ID ${index === 0 ? 'front' : 'back'}`}
                    className="max-h-40 w-full object-contain"
                  />
                ))}
              </div>
            </>
          ) : (
            <a href={profileHref} className="inline-block min-h-12 py-3 underline">
              Verify Now
            </a>
          )}
          <button type="button" onClick={() => void approved.refresh()} className="underline">
            Refresh verification
          </button>
        </section>
      ) : (
        <label>
          Valid ID (optional)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              setLegacyId(event.target.files?.[0] ?? null);
              legacyPath.current = null;
            }}
          />
        </label>
      )}
      {catalog ? (
        <>
          <label>
            Purpose of request
            <select
              aria-label="Purpose of request"
              required
              value={purpose}
              onChange={(event) => {
                setPurpose(event.target.value);
                setExplanation('');
              }}
              className={fieldClass}
            >
              <option value="">Choose a purpose</option>
              {catalog.purposes.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {purposeOption?.requiresExplanation ? (
            <label>
              Explain your purpose
              <textarea
                aria-label="Explain your purpose"
                required
                maxLength={1000}
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                className={fieldClass}
              />
              <span className="text-xs">{explanation.trim().length}/1000 characters</span>
            </label>
          ) : null}
          {catalog.serviceKind === 'business' ? (
            <>
              <label>
                Business name
                <input
                  required
                  maxLength={200}
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                Establishment address
                <textarea
                  required
                  maxLength={1000}
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className={fieldClass}
                />
              </label>
              {upload('dti', 'DTI registration', catalog.requirementRules.dtiRequired)}
            </>
          ) : null}
          {['indigency', 'first_time_job_seeker'].includes(catalog.serviceKind) ? (
            <>
              <p>
                HOA certification may support or establish residency. Staff will review eligibility and any
                fee exemption.
              </p>
              {upload('hoa', 'HOA certification', catalog.requirementRules.hoaRequired)}
              <label className="min-h-12 py-3">
                <input
                  type="checkbox"
                  checked={renter}
                  onChange={(event) => {
                    setRenter(event.target.checked);
                    if (!event.target.checked)
                      setFiles((previous) => {
                        const next = { ...previous };
                        delete next.lessor;
                        return next;
                      });
                  }}
                />{' '}
                I am a renter
              </label>
              {renter
                ? upload('lessor', 'Lessor endorsement', catalog.requirementRules.lessorForRenter)
                : null}
            </>
          ) : null}
          {catalog.serviceKind === 'certified_true_copy' ? (
            <>
              <label>
                Record/document reference
                <textarea
                  required
                  maxLength={1000}
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                Number of copies
                <input
                  type="number"
                  required
                  min={1}
                  max={1000}
                  value={copies}
                  onChange={(event) => setCopies(event.target.value)}
                  className={fieldClass}
                />
              </label>
              <p>
                Staff confirms the total billable pages across all copies. Fee: ₱10 × total confirmed pages.
              </p>
            </>
          ) : null}
          {catalog.requirementRules.personalAppearance ? (
            <label className="min-h-12 py-3">
              <input
                required
                type="checkbox"
                checked={appearance}
                onChange={(event) => setAppearance(event.target.checked)}
              />{' '}
              I understand that personal appearance at the Barangay Hall is required.
            </label>
          ) : null}
        </>
      ) : null}
      <label>
        Additional notes (optional)
        <textarea
          maxLength={1000}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={fieldClass}
        />
      </label>
      {error ? (
        <p role="alert" className="text-red-600">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting || (!!catalog && (approved.loading || !approved.evidence))}
        className={buttonClass}
      >
        {submitting ? 'Submitting…' : 'Submit request'}
      </button>
    </form>
  );
}
