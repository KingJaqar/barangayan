import { formatCentavosAsPHP, formatDate, formatDateTime } from '@barangayan/shared';
import { escapeHtml } from '../payments/receipt';
import type { ExportRow, ValidExport } from './export-contract';

export type ExportFormat = 'pdf' | 'json';

/** Local calendar date of the export, for the file name: `2026-10-21`. */
function fileDate(iso: string): string {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function exportFileName(exportedAt: string, format: ExportFormat): string {
  return `Barangayan-my-data-${fileDate(exportedAt)}.${format}`;
}

/** The raw, validated inventory exactly as the server returned it, for a resident who wants the machine-readable copy. */
export function exportJson(data: ValidExport): string {
  const sections = Object.fromEntries(data.sections.map((section) => [section.name, { label: section.label, rowCount: section.rows.length, rows: section.rows }]));
  return JSON.stringify({ contractVersion: 2, exportedAt: data.exportedAt, account: data.account, sections }, null, 2);
}

const DATE_ONLY_KEYS = new Set(['birth_date', 'prior_dose_date', 'drive_date']);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function labelize(key: string): string {
  const spaced = key.replace(/_/g, ' ').trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** A calendar date carries no time zone: it is read as year, month and day, never shifted by the device's zone. */
function dateOnly(value: string): string {
  const [year, month, day] = value.split('-').map(Number);
  return formatDate(new Date(year, month - 1, day).toISOString());
}

/** One cell of the readable export. Nothing is dropped: nested values are printed as compact JSON. */
export function displayValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return key.endsWith('_centavos') ? formatCentavosAsPHP(value) : String(value);
  if (typeof value === 'string') {
    if (DATE_ONLY_KEYS.has(key) && DATE_ONLY.test(value)) return dateOnly(value);
    if (TIMESTAMP.test(value)) return formatDateTime(value);
    return value;
  }
  if (Array.isArray(value) && value.length === 0) return '—';
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record);
    if (keys.length === 1 && keys[0] === 'name' && typeof record.name === 'string') return record.name;
    return JSON.stringify(value);
  }
  return String(value);
}

function rowTable(row: ExportRow): string {
  const lines = Object.entries(row).map(([key, value]) => `<tr><th>${escapeHtml(labelize(key))}</th><td>${escapeHtml(displayValue(key, value))}</td></tr>`).join('');
  return `<table>${lines}</table>`;
}

/**
 * The readable PDF source. Every required section is printed, an empty one says so, and records are laid out as their own
 * small tables so wide data prints legibly. Values are escaped; no remote resource or image is referenced.
 */
export function exportHtml(data: ValidExport, generatedAt: Date): string {
  const summary = data.sections.map((section) => `<tr><th>${escapeHtml(section.label)}</th><td>${section.rows.length}</td></tr>`).join('');
  const body = data.sections.map((section) => {
    const records = section.rows.length === 0 ? '<p class="muted">No records.</p>'
      : section.rows.map((row, index) => `<div class="record">${section.rows.length > 1 ? `<p class="n">Record ${index + 1}</p>` : ''}${rowTable(row)}</div>`).join('');
    return `<h2>${escapeHtml(section.label)} <span class="muted">(${section.rows.length})</span></h2>${records}`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8" /><style>
body{font-family:-apple-system,Helvetica,Arial,sans-serif;color:#1a1a1a;margin:28px;font-size:11px}
h1{font-size:20px;color:#0F6E5B;margin:0 0 2px}h2{font-size:14px;color:#0F6E5B;border-bottom:1px solid #d8ece7;padding-bottom:4px;margin-top:22px}
.sub{color:#666;margin:0 0 16px}.muted{color:#888;font-weight:normal}.n{color:#888;margin:8px 0 2px}
table{border-collapse:collapse;width:100%}th{text-align:left;color:#555;width:38%;vertical-align:top;padding:3px 8px 3px 0}
td{padding:3px 0;vertical-align:top;word-break:break-word}.record{page-break-inside:avoid;margin-bottom:8px}
footer{margin-top:26px;color:#888;font-size:9px}
</style></head><body>
<h1>Barangayan — My data</h1>
<p class="sub">Account ${escapeHtml(data.account.email ?? 'without an email address')}. Prepared on ${escapeHtml(formatDateTime(generatedAt.toISOString()))} from the records your barangay holds about you.</p>
<h2>What this file contains</h2><table>${summary}</table>
${body}
<footer>This is a complete export: every section above was read to its end. Identity photos, attached files and your password are not included.</footer>
</body></html>`;
}
