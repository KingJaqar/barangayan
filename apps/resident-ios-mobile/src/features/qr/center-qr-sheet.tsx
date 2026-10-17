import { useMemo, useState } from 'react';
import { Image, Share, View } from 'react-native';
import { z } from 'zod';
import { Action, Body, Card, EmptyState, Loading, Notice, Selector, Sheet } from '../../components/ui';
import { CENTER_POLICY } from '../../data/public-cache';
import { centerRow } from '../../data/schemas';
import { useApi } from '../../data/use-api';
import { usePublicResource } from '../../data/use-public-resource';
import { space } from '../../lib/theme';
import { ContentStatus } from '../emergency/content-status';
import { saveDeps } from '../payments/native-bindings';
import { centerPayload } from './payloads';
import { saveCenterCode, shareCenterCode } from './qr-actions';
import { pickCenter } from './show-qr';
import { qrDataUri } from './qr-image';

const centers = z.array(centerRow);
const QR_SIZE = 264;

/** "Show QR" (A26): an evacuation center's check-in code to display, share as text or save as an image. This is the center code, never the household code. */
export function CenterQrSheet({ visible, onClose, barangayId }: { visible: boolean; onClose: () => void; barangayId: string }) {
  return <Sheet visible={visible} title="Evacuation center QR code" onClose={onClose}>
    <CenterQrBody barangayId={barangayId} />
  </Sheet>;
}

function CenterQrBody({ barangayId }: { barangayId: string }) {
  const api = useApi();
  const resource = usePublicResource('evacuation-centers', api.centers, centers, CENTER_POLICY);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'share' | 'save' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);
  const list = useMemo(() => (resource.data ?? []).map((row) => ({ id: row.id, name: row.name, address: row.address })), [resource.data]);
  const picked = pickCenter(list, selectedId);
  // `picked.center` is an element of the memoized list, so the picture is made once per chosen center, not on every render.
  const chosen = picked?.center ?? null;
  const code = useMemo(() => {
    if (!chosen) return null;
    try {
      const payload = centerPayload(chosen, barangayId);
      return { payload, dataUri: qrDataUri(payload) };
    } catch { return 'failed' as const; }
  }, [chosen, barangayId]);

  async function share(payload: string) {
    if (busy) return;
    setBusy('share'); setMessage(null);
    const outcome = await shareCenterCode(async (text) => (await Share.share({ message: text })).action === Share.sharedAction ? 'shared' : 'dismissed', payload);
    setMessage({ text: outcome.message, tone: outcome.status === 'failed' ? 'danger' : 'primary' });
    setBusy(null);
  }
  async function save(dataUri: string, name: string) {
    if (busy) return;
    setBusy('save'); setMessage(null);
    const outcome = await saveCenterCode(saveDeps, dataUri, name);
    setMessage({ text: outcome.message, tone: outcome.status === 'saved' ? 'primary' : 'danger' });
    setBusy(null);
  }

  return <>
    <Body role="footnote" tone="secondary">This is the evacuation center’s check-in code. Residents scan it in Barangayan to check in. Anyone who has the code can use it, so share it only where it is needed.</Body>
    <ContentStatus resource={resource} retry={() => void resource.refresh()} />
    {resource.loading && !resource.data && <Loading />}
    {resource.data && list.length === 0 && <EmptyState title="No evacuation centers" message="There are no active evacuation centers to show a code for right now." />}
    {picked && <>
      {picked.replaced && <Notice tone="danger" message="The center you chose is no longer listed, so the first center is shown." />}
      {list.length > 1 && <Selector label="Evacuation center" options={list.map((center) => ({ value: center.id, label: center.name }))} selected={picked.center.id} onChange={setSelectedId} />}
      <Card>
        <Body heading>{picked.center.name}</Body>
        {!!picked.center.address && <Body tone="secondary">{picked.center.address}</Body>}
        {code === 'failed' || code === null
          ? <Notice tone="danger" message="This center’s QR code could not be created. Choose another center or try again later." />
          : <View accessible accessibilityRole="image" accessibilityLabel={`QR code for ${picked.center.name}. Scan it in Barangayan to check in.`} style={{ alignSelf: 'center', padding: space[3], borderRadius: 12, backgroundColor: '#FFFFFF' }}>
            <Image source={{ uri: code.dataUri }} style={{ width: QR_SIZE, height: QR_SIZE }} resizeMode="contain" />
          </View>}
      </Card>
      {code !== null && code !== 'failed' && <>
        <Action label={busy === 'share' ? 'Opening share sheet…' : 'Share code'} disabled={busy !== null} onPress={() => void share(code.payload)} />
        <Action label={busy === 'save' ? 'Saving to Photos…' : 'Save image to Photos'} secondary disabled={busy !== null} onPress={() => void save(code.dataUri, picked.center.name)} />
        <Body role="footnote" tone="secondary">Sharing sends the code’s text. Saving adds the picture to your Photos; Barangayan asks permission only when you choose it.</Body>
      </>}
    </>}
    {message && <Notice message={message.text} tone={message.tone} />}
  </>;
}
