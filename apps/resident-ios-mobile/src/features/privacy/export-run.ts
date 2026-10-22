import type { TempFile } from '../payments/native-actions';
import { validateExport } from './export-contract';
import { exportFileName, exportHtml, exportJson, type ExportFormat } from './export-files';
import { replyError, type FunctionReply } from './function-call';

export type ExportDeps = {
  /** Requests the complete v2 export for the signed-in resident. */
  request(): Promise<FunctionReply>;
  writeJson(name: string, text: string): TempFile;
  renderPdf(name: string, html: string): Promise<TempFile>;
  canShare(): Promise<boolean>;
  share(uri: string, format: ExportFormat): Promise<void>;
  now(): Date;
};

export type ExportOutcome =
  /** The share sheet was shown. It cannot say whether the resident saved or cancelled, so this is never "saved". */
  | { status: 'shared'; message: string }
  | { status: 'unavailable'; message: string }
  | { status: 'cooldown'; message: string; retryAfterSeconds: number }
  | { status: 'incomplete'; message: string }
  | { status: 'session'; message: string }
  | { status: 'failed'; message: string };

const FALLBACK_COOLDOWN_SECONDS = 60;

/** The resident-facing result of a server reply that is not a payload. */
function refusal(reply: Exclude<FunctionReply, { kind: 'ok' }>): ExportOutcome {
  if (reply.kind === 'unreachable') return { status: 'failed', message: 'Your export could not be reached. Check your connection and try again. Nothing was shared.' };
  if (reply.status === 429) {
    const seconds = reply.retryAfterSeconds ?? FALLBACK_COOLDOWN_SECONDS;
    return { status: 'cooldown', retryAfterSeconds: seconds, message: `You exported your data a moment ago. Try again in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}.` };
  }
  if (reply.status === 401) return { status: 'session', message: 'Your session has ended. Log in again to export your data.' };
  if (reply.status === 502) return { status: 'incomplete', message: 'Some of your data could not be read, so no export was created. Nothing was shared. Try again in a moment.' };
  return { status: 'failed', message: replyError(reply.body) ?? 'Your data could not be exported right now. Please try again later.' };
}

/**
 * Exports the resident's complete data: request, validate, build the file, open the share sheet, and remove the temporary
 * file whatever happens. A payload that is not complete and for this account is refused before any file exists (A45).
 */
export async function runExport(deps: ExportDeps, format: ExportFormat, accountId: string): Promise<ExportOutcome> {
  const reply = await deps.request();
  if (reply.kind !== 'ok') return refusal(reply);
  const checked = validateExport(reply.data, accountId);
  if (!checked.ok) {
    return checked.reason === 'incomplete'
      ? { status: 'incomplete', message: `Your export was missing ${checked.sections.join(', ')}, so it was not saved or shared. Try again in a moment.` }
      : { status: 'failed', message: 'The export did not match your account or the expected format, so it was not saved or shared.' };
  }
  const name = exportFileName(checked.value.exportedAt, format);
  let file: TempFile | null = null;
  try {
    file = format === 'json' ? deps.writeJson(name, exportJson(checked.value)) : await deps.renderPdf(name, exportHtml(checked.value, deps.now()));
    if (!(await deps.canShare())) {
      return { status: 'unavailable', message: 'Sharing is not available on this device, so the export could not be saved from here. Nothing was kept on the device.' };
    }
    await deps.share(file.uri, format);
    return { status: 'shared', message: 'The share sheet was closed. Choose Save to Files or another app whenever you need a copy. The temporary file has been removed from this iPhone.' };
  } catch {
    return { status: 'failed', message: 'Your export was prepared but the file could not be created or shared. Try again.' };
  } finally {
    try { file?.remove(); } catch { /* the next launch and logout purge the private folder */ }
  }
}
