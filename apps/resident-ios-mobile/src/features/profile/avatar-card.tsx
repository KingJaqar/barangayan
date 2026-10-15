import { randomUUID } from 'expo-crypto';
import { useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { Action, Body, Card, Notice } from '../../components/ui';
import { drafts } from '../../lib/drafts';
import { residentError } from '../../lib/errors';
import { storageBucket } from '../../lib/files';
import { pickImage, type ImageOrigin } from '../../lib/image-source';
import { useResident, type Profile } from '../../lib/runtime';
import { createStagedUploads } from '../../lib/staged-uploads';
import { space, typeScale, useColors } from '../../lib/theme';
import { applyAvatar, replaceAvatar } from './avatar';
import { initials } from './profile-form';

const staged = createStagedUploads(drafts);

/**
 * Avatar upload is its own save, separate from the demographic form: the photo is uploaded as a
 * new object, then applied, and the outcome of each is reported on its own (A37-004…007).
 */
export function AvatarCard({ profile }: { profile: Profile }) {
  const { client, session, config, refreshProfile } = useResident();
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const [showFailed, setShowFailed] = useState(false);
  // An uploaded photo that was not applied yet; applying it again is safe.
  const [unapplied, setUnapplied] = useState<{ url: string; path: string } | null>(null);
  const userId = session?.user.id;
  if (!userId) return null;
  const scope = { environment: config.environment, barangayId: config.barangayId, userId } as const;

  async function change(origin: ImageOrigin) {
    if (busy) return;
    setBusy(true); setMessage(null);
    try {
      // Earlier uploads that never reached the profile are removed first; a failure here is not user-facing.
      await staged.cleanup(scope, (bucket) => storageBucket(client, bucket)).catch(() => undefined);
      const picked = await pickImage('avatar', origin);
      if (!picked) return;
      const uploadId = randomUUID();
      const bucket = storageBucket(client, 'profile-photos');
      await staged.stage(scope, 'profile-photos', `${userId}/${uploadId}/avatar.${picked.extension}`);
      const result = await replaceAvatar(client, bucket, userId!, uploadId, picked, profile.avatar_url);
      if (result.kind === 'applied') {
        await staged.link(scope, 'profile-photos', result.path).catch(() => undefined);
        setUnapplied(null);
        setShowFailed(false);
        await refreshProfile().catch(() => undefined);
        setMessage({ text: 'Profile photo updated.', tone: 'primary' });
      } else {
        setUnapplied({ url: result.url, path: result.path });
        setMessage({ text: 'Your photo was uploaded but could not be applied to your profile yet. Apply it again, or choose another photo.', tone: 'danger' });
      }
    } catch (failure) {
      setMessage({ text: residentError(failure), tone: 'danger' });
    } finally { setBusy(false); }
  }

  async function applyUploaded() {
    const pending = unapplied;
    if (!pending || busy) return;
    setBusy(true); setMessage(null);
    try {
      if (await applyAvatar(client, userId!, pending.url)) {
        await staged.link(scope, 'profile-photos', pending.path).catch(() => undefined);
        setUnapplied(null);
        await refreshProfile().catch(() => undefined);
        setMessage({ text: 'Profile photo updated.', tone: 'primary' });
      } else {
        setMessage({ text: 'The photo could not be applied. Check your connection and try again.', tone: 'danger' });
      }
    } finally { setBusy(false); }
  }

  const url = profile.avatar_url;
  return <Card>
    <View style={{ alignItems: 'center', gap: space[3] }}>
      <View accessible accessibilityRole="image" accessibilityLabel={url && !showFailed ? 'Your profile photo' : `No profile photo, initials ${initials(profile)}`}
        style={{ width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
        {url && !showFailed
          ? <Image source={{ uri: url }} style={{ width: 96, height: 96 }} onError={() => setShowFailed(true)} accessibilityIgnoresInvertColors />
          : <Text style={[typeScale.title1, { color: colors.primary }]}>{initials(profile)}</Text>}
        {busy && <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay }}><ActivityIndicator color={colors.onPrimary} /></View>}
      </View>
      <Body heading role="title2">{profile.full_name || 'Resident'}</Body>
      {busy && <Body tone="secondary">Updating your photo…</Body>}
    </View>
    <Action label="Choose from photo library" secondary disabled={busy} onPress={() => void change('library')} />
    <Action label="Take a photo" secondary disabled={busy} onPress={() => void change('camera')} />
    {unapplied && <Action label="Apply uploaded photo" disabled={busy} onPress={() => void applyUploaded()} />}
    {message && <Notice message={message.text} tone={message.tone} />}
    <Body role="footnote" tone="secondary">Profile photos are not private. Choose a photo you are comfortable sharing. Large and HEIC photos are resized and converted for you.</Body>
  </Card>;
}
