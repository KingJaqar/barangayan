import { formatCentavosAsPHP } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Destination, EmptyState, Loading, Notice, ResourceState, Screen, StatusBadge } from '../../components/ui';
import { uuid } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { space } from '../../lib/theme';
import { shareReceipt } from './native-actions';
import { shareDeps } from './native-bindings';
import { receiptLines, toReceipt } from './receipt';

export function ReceiptRoute() {
  return <RequireResident purpose="view your payment receipt"><ReceiptScreen /></RequireResident>;
}

/**
 * The paid receipt (A17). It is read from the committed paid payment of the request in the
 * link; route parameters are only a lookup hint and are never displayed as proof of payment,
 * so a forged amount, reference or status in a link changes nothing.
 */
function ReceiptScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const api = useApi();
  const parsed = uuid.safeParse(requestId);
  const id = parsed.success ? parsed.data : null;
  const resource = useResource(`receipt:${id ?? 'invalid'}`, async (signal) => {
    if (!id) return null;
    const row = await api.paidReceipt(id, signal);
    return row ? toReceipt(row) : null;
  });
  const receipt = resource.data;
  const lines = useMemo(() => (receipt ? receiptLines(receipt) : []), [receipt]);
  const [preparing, setPreparing] = useState(false);
  const [outcome, setOutcome] = useState<{ text: string; tone: 'primary' | 'danger' } | null>(null);

  async function download() {
    if (!receipt || preparing) return;
    setPreparing(true);
    setOutcome(null);
    const result = await shareReceipt(shareDeps, receipt);
    setPreparing(false);
    setOutcome({ text: result.message, tone: result.status === 'opened' ? 'primary' : 'danger' });
  }

  if (!id) {
    return <Screen><EmptyState title="Receipt not found" message="This link does not point to a request."><Destination title="My requests" href="/requests" /></EmptyState></Screen>;
  }
  return <Screen>
    <ResourceState loading={resource.loading && receipt === undefined} error={resource.error} retry={() => void resource.refresh()} skeleton />
    {receipt === null && !resource.error && <EmptyState title="No confirmed payment receipt" message="No paid payment is recorded for this request yet. If you have just paid, wait a moment and check again.">
      <Action label="Check again" onPress={() => void resource.refresh()} />
      <Destination title="Return to request" href={{ pathname: '/request/[id]', params: { id } }} />
    </EmptyState>}
    {receipt && <>
      <Card>
        <View style={{ gap: space[2] }}>
          <StatusBadge label="Payment received" icon="checkmark.circle" tone="success" />
          <Body heading role="title1">{formatCentavosAsPHP(receipt.amountCentavos)}</Body>
        </View>
        <Body role="footnote" tone="secondary">This receipt shows the payment recorded by your barangay for this request.</Body>
      </Card>
      <Card>
        <Body heading role="headline">Transaction details</Body>
        {lines.map(([label, value]) => <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2 }}>
          <Body role="footnote" tone="secondary">{label}</Body>
          <Body role={label === 'Reference number' || label === 'Transaction reference' ? 'monoReference' : 'body'}>{value}</Body>
        </View>)}
      </Card>
      {preparing && <Loading label="Preparing your receipt…" />}
      {!!outcome && <Notice message={outcome.text} tone={outcome.tone} />}
      <Action label={preparing ? 'Preparing…' : 'Download receipt (PDF)'} disabled={preparing} hint="Opens the share sheet with your PDF receipt" onPress={() => void download()} />
      <Card>
        <Destination title="Track my request" href={{ pathname: '/request/[id]', params: { id } }} />
        <Destination title="Return to Home" href="/home" />
      </Card>
    </>}
  </Screen>;
}
