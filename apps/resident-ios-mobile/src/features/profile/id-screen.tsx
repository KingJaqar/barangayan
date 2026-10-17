import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, confirmDestructive, Field, Loading, Notice, Screen, Selector, StatusBadge, useDiscardGuard, type StatusTone } from '../../components/ui';
import { toDataError } from '../../data/outcome';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { bytesToDataUri } from '../../lib/data-uri';
import { residentError } from '../../lib/errors';
import { storageBucket } from '../../lib/files';
import { pickImage, type ImageOrigin, type PickedImage } from '../../lib/image-source';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { createSignedPreview, previewExpired } from '../../lib/staged-uploads';
import { radius, space, useColors } from '../../lib/theme';
import { decodeIdType, encodeIdType, ID_STATE_COPY, ID_TYPES, idState, publishIdVersion, type IdState, type IdType } from './id-evidence';

const ID_TYPE_OPTIONS = ID_TYPES.map((value) => ({ value, label: value }));
const STATE_STYLE: Record<IdState['kind'], { tone: StatusTone; icon: 'checkmark.circle' | 'exclamationmark.triangle' | 'clock' | 'xmark.circle' | 'questionmark.circle' | 'doc' }> = {
  none: { tone: 'neutral', icon: 'doc' }, pending: { tone: 'info', icon: 'clock' }, verified: { tone: 'success', icon: 'checkmark.circle' },
  rejected: { tone: 'danger', icon: 'xmark.circle' }, revoked: { tone: 'warning', icon: 'exclamationmark.triangle' }, unconfirmed: { tone: 'warning', icon: 'questionmark.circle' },
};

export function IdVerificationRoute() {
  return <RequireResident purpose="submit your ID"><IdVerification /></RequireResident>;
}

type Side = { image: PickedImage; preview: string; pickId: string };

function IdVerification() {
  const { client, session, profile, refreshProfile } = useResident();
  const api = useApi();
  const colors = useColors();
  const latest = useResource('id-submission', (signal) => api.latestIdSubmission(signal));
  const stored = latest.data === undefined ? null : latest.data;
  const [typeDraft, setTypeDraft] = useState<{ type: IdType | ''; other: string } | null>(null);
  const selected = typeDraft ?? decodeIdType(stored?.id_type ?? profile?.id_type);
  const [front, setFront] = useState<Side | null>(null);
  const [back, setBack] = useState<Side | null>(null);
  const [busy, setBusy] = useState<'front' | 'back' | 'submit' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const [typeError, setTypeError] = useState<string>();
  // The same version id is reused for the same selection, so a retry can never create a second version.
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const userId = session?.user.id;
  const staged = front !== null || back !== null || typeDraft !== null;
  useDiscardGuard(staged && busy !== 'submit');
  if (!userId) return null;

  const state: IdState = latest.error && !latest.data ? { kind: 'unconfirmed' } : idState(stored);
  const copy = ID_STATE_COPY[state.kind];
  const style = STATE_STYLE[state.kind];
  const canUpload = releaseGates.privateIdUploads;

  async function choose(side: 'front' | 'back', origin: ImageOrigin) {
    if (busy) return;
    setBusy(side); setMessage(null);
    try {
      const image = await pickImage('id-image', origin);
      if (!image) return;
      const next: Side = { image, preview: bytesToDataUri(image.bytes, image.mimeType), pickId: randomUUID() };
      (side === 'front' ? setFront : setBack)(next);
    } catch (failure) { setMessage({ text: residentError(failure), tone: 'danger' }); }
    finally { setBusy(null); }
  }

  async function submit() {
    if (busy || !front || !back) return;
    const encoded = encodeIdType(selected.type, selected.other);
    if ('error' in encoded) { setTypeError(encoded.error); return; }
    setTypeError(undefined);
    if (state.kind === 'verified' || state.kind === 'pending') {
      const proceed = await confirmDestructive({
        title: 'Submit a new ID version?',
        message: state.kind === 'verified' ? 'Your current approval is replaced until staff review the new ID.' : 'The version under review is replaced by this one.',
        confirmLabel: 'Submit new version',
      });
      if (!proceed) return;
    }
    const signature = `${encoded.value}|${front.pickId}|${back.pickId}`;
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: randomUUID() };
    const submissionId = attempt.current.id;
    setBusy('submit'); setMessage(null);
    try {
      const outcome = await publishIdVersion({
        bucket: storageBucket(client, 'id-documents'),
        publish: async (input) => {
          const { error, status } = await client.rpc('publish_id_submission', { p_input: input });
          if (error) throw toDataError(error, { status, write: true });
        },
        exists: (id) => api.idSubmissionExists(id, new AbortController().signal),
      }, userId!, { submissionId, idType: encoded.value, front: front.image, back: back.image });
      if (outcome.kind === 'published') {
        attempt.current = null;
        setFront(null); setBack(null); setTypeDraft(null);
        await Promise.all([refreshProfile().catch(() => undefined), latest.refresh()]);
        setMessage({ text: 'Your ID was submitted for review. You will see its status here.', tone: 'primary' });
      } else {
        setMessage({ text: 'We could not confirm that your ID was submitted. Submitting again is safe and will not create a duplicate.', tone: 'danger' });
      }
    } catch (failure) {
      setMessage({ text: `${residentError(failure)} Your selected photos are still here, so you can submit again.`, tone: 'danger' });
    } finally { setBusy(null); }
  }

  const sides = [
    { key: 'front' as const, label: 'Front of ID', side: front },
    { key: 'back' as const, label: 'Back of ID', side: back },
  ];
  const storedType = stored ? decodeIdType(stored.id_type) : null;
  return <Screen>
    <Card>
      <Body heading>ID verification</Body>
      <StatusBadge label={copy.label} icon={style.icon} tone={style.tone} />
      <Body tone="secondary">{copy.detail}</Body>
      {(state.kind === 'rejected' || state.kind === 'revoked') && state.reason && <Notice tone="danger" message={`Reason from barangay staff: ${state.reason}`} />}
      {latest.loading && !latest.data && <Loading label="Checking your ID status…" />}
      {latest.error && <Action label="Check status again" secondary onPress={() => void latest.refresh()} />}
    </Card>
    {stored && storedType && <Card><Body heading role="headline">{`Submitted ID, version ${stored.version}`}</Body>
      <Body tone="secondary">{storedType.type === 'Other' ? storedType.other : stored.id_type}</Body>
      <PrivatePreview label={`Front of your ID, version ${stored.version}`} path={stored.front_path} userId={userId} />
      {stored.back_path && <PrivatePreview label={`Back of your ID, version ${stored.version}`} path={stored.back_path} userId={userId} />}
    </Card>}
    {canUpload
      ? <Card>
        <Body heading role="headline">{stored ? 'Submit a new version' : 'Submit your ID'}</Body>
        <Selector label="ID type" required options={ID_TYPE_OPTIONS} selected={selected.type} error={typeError} disabled={busy !== null}
          onChange={(type) => { setTypeDraft({ type, other: selected.other }); setTypeError(undefined); }} />
        {selected.type === 'Other' && <Field label="Exact ID name" required value={selected.other} maxLength={150} editable={busy === null}
          onChangeText={(other) => { setTypeDraft({ type: 'Other', other }); setTypeError(undefined); }} placeholder="For example, Barangay certification" />}
        {sides.map(({ key, label, side }) => <View key={key} style={{ gap: space[2] }}>
          <Body role="subheadline">{label} <Text style={{ color: colors.danger }}>*</Text></Body>
          {side
            ? <Image source={{ uri: side.preview }} accessibilityLabel={`${label}, selected photo`} accessibilityIgnoresInvertColors resizeMode="cover"
              style={{ height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceSelected }} />
            : <Body tone="secondary">No photo selected.</Body>}
          {busy === key && <Loading label="Preparing photo…" />}
          <Action label={side ? `Replace ${label.toLowerCase()} from library` : `Choose ${label.toLowerCase()} from library`} secondary disabled={busy !== null} onPress={() => void choose(key, 'library')} />
          <Action label={`Take a photo of the ${label.toLowerCase()}`} secondary disabled={busy !== null} onPress={() => void choose(key, 'camera')} />
          {side && <Action label={`Remove ${label.toLowerCase()} photo`} destructive secondary disabled={busy !== null} onPress={() => (key === 'front' ? setFront : setBack)(null)} />}
        </View>)}
        <Body role="footnote" tone="secondary">Photos are checked, resized if needed, and sent privately. Only you and barangay staff can open them. Each photo can be up to 5 MB.</Body>
        {message && <Notice message={message.text} tone={message.tone} />}
        <Action label={busy === 'submit' ? 'Submitting…' : 'Submit ID for review'} disabled={busy !== null || !front || !back || !selected.type} onPress={() => void submit()} />
        {(!front || !back) && <Body role="footnote" tone="secondary">Add both the front and the back of your ID to submit.</Body>}
      </Card>
      : <Card><Notice message="ID submission is not available in this version yet. Your submitted ID and its status are shown above." /></Card>}
  </Screen>;
}

/** A short-lived signed preview of a private ID image, renewed before it expires. */
export function PrivatePreview({ label, path, userId }: { label: string; path: string; userId: string }) {
  const { client } = useResident();
  const colors = useColors();
  const preview = useResource(`id-preview:${path}`, () => createSignedPreview(storageBucket(client, 'id-documents'), userId, path));
  const [imageFailed, setImageFailed] = useState(false);
  const { data, refresh } = preview;
  useEffect(() => {
    if (!data) return;
    const timer = setTimeout(() => { void refresh(); }, Math.max(1000, data.expiresAt - Date.now() - 30_000));
    return () => clearTimeout(timer);
  }, [data, refresh]);
  if (preview.error || imageFailed || (data && previewExpired(data))) {
    return <View style={{ gap: space[2] }}>
      <Notice tone="danger" message="This preview is not available right now." />
      <Action label={`Reload ${label.toLowerCase()}`} secondary onPress={() => { setImageFailed(false); void refresh(); }} />
    </View>;
  }
  return data
    ? <Image source={{ uri: data.url }} accessibilityLabel={label} accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setImageFailed(true)}
      style={{ height: 160, borderRadius: radius.md, backgroundColor: colors.surfaceSelected }} />
    : <View accessible accessibilityLabel={`Loading ${label}`} style={{ height: 160, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator /></View>;
}
