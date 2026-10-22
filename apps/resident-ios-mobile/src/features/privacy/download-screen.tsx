import { useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, EmptyState, Loading, Notice, Screen } from '../../components/ui';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { useCountdown } from '../payments/use-countdown';
import { PRIVACY_COPY } from './copy';
import { EXPORT_COOLDOWN_SECONDS } from './export-cooldown';
import { exportDeps } from './export-native';
import { runExport, type ExportOutcome } from './export-run';
import type { ExportFormat } from './export-files';

export function DownloadScreen() {
  return <RequireResident purpose="download your data">{releaseGates.completeExport ? <Download /> : <Screen><EmptyState title={PRIVACY_COPY.exportUnavailable.title} message={PRIVACY_COPY.exportUnavailable.message} /></Screen>}</RequireResident>;
}

/** Download My Data (A45): choose a format, wait for the complete export, share it. One export runs at a time, with a cooldown. */
function Download() {
  const { client, session } = useResident();
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<ExportOutcome | null>(null);
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(null);
  const running = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const left = useCountdown(cooldownEnd);
  const waiting = left !== null && left > 0;
  const accountId = session?.user.id;

  async function start(format: ExportFormat) {
    if (running.current || !accountId) return;
    running.current = true;
    setBusy(true); setOutcome(null);
    let result: ExportOutcome;
    try { result = await runExport(exportDeps(client), format, accountId); }
    catch { result = { status: 'failed', message: 'Your export could not be completed. Nothing was shared. Please try again.' }; }
    running.current = false;
    if (!alive.current) return;
    if (result.status === 'cooldown') setCooldownEnd(Date.now() + result.retryAfterSeconds * 1000);
    else if (result.status === 'shared' || result.status === 'unavailable') setCooldownEnd(Date.now() + EXPORT_COOLDOWN_SECONDS * 1000);
    setOutcome(result);
    setBusy(false);
  }

  function choose() {
    if (busy || waiting) return;
    Alert.alert(PRIVACY_COPY.exportChooserTitle, PRIVACY_COPY.exportChooserMessage, [
      { text: PRIVACY_COPY.exportPdf, onPress: () => void start('pdf') },
      { text: PRIVACY_COPY.exportJson, onPress: () => void start('json') },
      { text: 'Cancel', style: 'cancel' },
    ], { cancelable: true });
  }

  return <Screen>
    <Card>
      <Body heading>{PRIVACY_COPY.exportTitle}</Body>
      <Body>{PRIVACY_COPY.exportIntro}</Body>
      <Body role="footnote" tone="secondary">{PRIVACY_COPY.exportIncludes}</Body>
      <Body role="footnote" tone="secondary">{PRIVACY_COPY.exportExcludes}</Body>
      <Body role="footnote" tone="secondary">{PRIVACY_COPY.exportComplete}</Body>
    </Card>
    {busy && <Loading label={PRIVACY_COPY.exportPreparing} />}
    {outcome && <Notice tone={outcome.status === 'shared' ? 'primary' : 'danger'} message={outcome.message} />}
    <Action label={busy ? PRIVACY_COPY.exportPreparing : waiting ? PRIVACY_COPY.exportCooldown(left ?? 0) : PRIVACY_COPY.exportButton} disabled={busy || waiting} onPress={choose} />
  </Screen>;
}
