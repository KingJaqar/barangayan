'use client';

/**
 * Download My Data — Data Privacy Act right-to-portability page.
 * Calls the same `export-my-data` edge function as mobile (§18 item 8: it derives
 * the export target from the caller's JWT server-side, so no user id is ever passed
 * from the client — this page relies on that contract, same as mobile does).
 *
 * The export is rate-limited server-side, so the format choice below must not itself
 * spend a call — only the actually-chosen export invokes the function.
 *
 * JSON: downloaded directly as a Blob.
 * PDF: rendered as a printable HTML report in a new tab; the resident uses the
 * browser's own Print → Save as PDF, since there's no server-side PDF renderer here
 * (mobile uses expo-print, which has no web equivalent without a headless browser).
 */

import { Download, FileJson, FileText } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import { buildDataExportHtml } from '@/lib/data-export-html';
import { toEdgeFunctionError } from '@/lib/edge-function-error';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function DownloadDataPage() {
  const [exporting, setExporting] = useState<'json' | 'pdf' | null>(null);

  async function runExport(format: 'json' | 'pdf') {
    setExporting(format);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke('export-my-data');
      if (error) throw await toEdgeFunctionError(error);

      const dateStr = new Date().toISOString().slice(0, 10);

      if (format === 'json') {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `barangayan-my-data-${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success('Your data was downloaded as JSON.');
        return;
      }

      const html = buildDataExportHtml(data as Record<string, unknown>);
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow pop-ups to view your PDF export.');
        return;
      }
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      // Give the new tab a moment to lay out before invoking print.
      setTimeout(() => printWindow.print(), 300);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not export your data. Please try again.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Download My Data</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Get a copy of your account, profile, service requests, incident reports, and other records under
          the Data Privacy Act&apos;s right to data portability.
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          disabled={exporting !== null}
          onClick={() => runExport('json')}
          className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white p-4 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-tint)]">
            <FileJson size={18} className="text-[var(--accent)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">JSON (raw data)</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Machine-readable, complete export</p>
          </div>
          <Download size={16} className="shrink-0 text-zinc-400" />
        </button>

        <button
          type="button"
          disabled={exporting !== null}
          onClick={() => runExport('pdf')}
          className="flex w-full items-center gap-3 rounded-xl border border-black/10 bg-white p-4 text-left transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-zinc-900 dark:hover:bg-zinc-800">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-tint)]">
            <FileText size={18} className="text-[var(--accent)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">PDF (readable)</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Opens a printable report — use your browser&apos;s Save as PDF</p>
          </div>
          <Download size={16} className="shrink-0 text-zinc-400" />
        </button>
      </div>

      {exporting ? (
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-400">Preparing your export…</p>
      ) : null}
    </div>
  );
}
