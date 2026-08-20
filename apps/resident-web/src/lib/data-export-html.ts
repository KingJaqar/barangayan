// Turns the JSON payload from the export-my-data edge function into a
// printable HTML report (Download My Data → PDF option, via window.print()).
// Ported verbatim from resident-android-mobile's lib/data-export-pdf.ts —
// the renderer is pure string-building and platform-agnostic.
//
// Deliberately schema-agnostic: it doesn't hardcode "service_requests has
// columns X/Y/Z", it walks whatever keys are actually present. That's a
// consistency choice, not laziness — export-my-data's payload shape (see
// supabase/functions/export-my-data/index.ts) and this renderer would
// otherwise silently drift apart the moment either one adds/renames a
// field, and the PDF would quietly go stale without either side erroring.

const SECTION_LABELS: Record<string, string> = {
  account: 'Account',
  profile: 'Profile',
  service_requests: 'Service Requests',
  incident_reports: 'Incident Reports',
  medical_drive_registrations: 'Medical Drive Registrations',
  evacuation_center_checkins: 'Evacuation Center Check-ins',
  registered_devices: 'Registered Devices',
};

function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function labelize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Renders any JSON value as a table cell: primitives inline, nested
 * objects/arrays as compact indented JSON so nothing is silently dropped. */
function renderCell(value: unknown): string {
  if (value === null || value === undefined || value === '') return '<span class="muted">—</span>';
  if (typeof value === 'object') {
    return `<pre>${escapeHtml(JSON.stringify(value, null, 1))}</pre>`;
  }
  return escapeHtml(value);
}

function renderKeyValueSection(title: string, obj: Record<string, unknown>): string {
  const rows = Object.entries(obj)
    .map(([key, value]) => `<tr><th>${escapeHtml(labelize(key))}</th><td>${renderCell(value)}</td></tr>`)
    .join('');
  return `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <table class="kv">${rows}</table>
    </section>`;
}

function renderListSection(title: string, rows: Record<string, unknown>[]): string {
  if (rows.length === 0) {
    return `
      <section>
        <h2>${escapeHtml(title)} <span class="count">(0)</span></h2>
        <p class="muted">No records.</p>
      </section>`;
  }

  // Union of keys across all rows, in first-seen order — a single row missing
  // a field (e.g. a null relation) shouldn't drop that column for every row.
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }

  const head = columns.map((c) => `<th>${escapeHtml(labelize(c))}</th>`).join('');
  const body = rows
    .map((row) => `<tr>${columns.map((c) => `<td>${renderCell(row[c])}</td>`).join('')}</tr>`)
    .join('');

  return `
    <section>
      <h2>${escapeHtml(title)} <span class="count">(${rows.length})</span></h2>
      <div class="table-scroll">
        <table class="list"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
      </div>
    </section>`;
}

/** Builds a self-contained HTML document from the export-my-data JSON payload,
 * ready to open in a new tab and print (Save as PDF). */
export function buildDataExportHtml(payload: Record<string, unknown>): string {
  const exportedAt = typeof payload.exported_at === 'string' ? payload.exported_at : new Date().toISOString();

  const sections = Object.entries(payload)
    .filter(([key]) => key !== 'exported_at')
    .map(([key, value]) => {
      const title = SECTION_LABELS[key] ?? labelize(key);
      if (Array.isArray(value)) return renderListSection(title, value as Record<string, unknown>[]);
      if (value && typeof value === 'object') return renderKeyValueSection(title, value as Record<string, unknown>);
      return renderKeyValueSection(title, { [key]: value });
    })
    .join('');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Barangayan — My Data Export</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 24px; font-size: 12px; }
  h1 { font-size: 20px; color: #0F6E5B; margin-bottom: 2px; }
  .subtitle { color: #666; margin-top: 0; margin-bottom: 20px; }
  h2 { font-size: 14px; color: #0F6E5B; border-bottom: 1px solid #d8ece7; padding-bottom: 4px; margin-top: 22px; }
  .count { color: #888; font-weight: normal; font-size: 12px; }
  table { border-collapse: collapse; width: 100%; }
  table.kv th { text-align: left; color: #555; width: 220px; vertical-align: top; padding: 4px 8px 4px 0; }
  table.kv td { padding: 4px 0; vertical-align: top; word-break: break-word; }
  table.list { table-layout: auto; }
  table.list th, table.list td { border: 1px solid #e2e2e2; padding: 5px 7px; text-align: left; vertical-align: top; word-break: break-word; max-width: 220px; }
  table.list thead th { background: #f2f8f6; }
  .table-scroll { overflow-x: auto; }
  pre { margin: 0; white-space: pre-wrap; font-size: 10px; }
  .muted { color: #999; }
  footer { margin-top: 28px; color: #999; font-size: 10px; }
  @media print { body { margin: 12px; } }
</style>
</head>
<body>
  <h1>Barangayan — My Data Export</h1>
  <p class="subtitle">Generated ${escapeHtml(new Date(exportedAt).toLocaleString())}</p>
  ${sections}
  <footer>This document was generated from your Barangayan account under the Data Privacy Act's right to data portability.</footer>
</body>
</html>`;
}
