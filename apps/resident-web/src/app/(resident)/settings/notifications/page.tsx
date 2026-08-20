'use client';

/**
 * Notifications settings — SMS/email toggles only.
 * Push notifications are an explicit non-goal for resident-web v1 (§9, §14 Phase 7):
 * no service worker, no VAPID vars, no web-push edge function anywhere in the repo.
 * The toggles here are UI-only state for now — no backend preference column exists for
 * SMS/email in the current schema, matching mobile's comment "SMS stays local-state only".
 */

import { Bell, Mail, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function NotificationsPage() {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  function toggle(current: boolean, setter: (v: boolean) => void, label: string) {
    const next = !current;
    setter(next);
    toast(`${label} notifications ${next ? 'enabled' : 'disabled'}.`);
  }

  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Choose how you&apos;d like to be notified about updates from your barangay.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
        {/* Email */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-tint)]">
            <Mail size={18} className="text-[var(--accent)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Email Notifications</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Service request updates and announcements</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={emailEnabled}
            onClick={() => toggle(emailEnabled, setEmailEnabled, 'Email')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${emailEnabled ? 'bg-[var(--accent)]' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
            <span
              className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${emailEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>

        <hr className="border-black/[0.06] dark:border-white/[0.06]" />

        {/* SMS */}
        <div className="flex items-center gap-3 px-4 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--accent-tint)]">
            <MessageSquare size={18} className="text-[var(--accent)]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">SMS Notifications</p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Urgent community alerts</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={smsEnabled}
            onClick={() => toggle(smsEnabled, setSmsEnabled, 'SMS')}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent)] ${smsEnabled ? 'bg-[var(--accent)]' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
            <span
              className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${smsEnabled ? 'translate-x-5' : 'translate-x-0.5'}`}
            />
          </button>
        </div>
      </div>

      {/* Push non-goal notice */}
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-800/50">
        <Bell size={16} className="mt-0.5 shrink-0 text-zinc-400" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Push notifications are not yet available on the web — install the Barangayan mobile app for real-time push alerts.
        </p>
      </div>
    </div>
  );
}
