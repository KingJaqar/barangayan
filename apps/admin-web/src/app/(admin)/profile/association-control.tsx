'use client';
import { beginAttempt, notify } from '@/lib/notify';
import { useEffect, useRef, useState } from 'react';
import { openAccountProof, type AccountProof } from '@/lib/admin-profile/proof-window';
import { beginResidentAssociation, cancelResidentAssociation, finishResidentAssociation, readAssociatedResident } from './actions';
import styles from './profile.module.css';

export function AssociationControl({ enabled, disabled, onBusy, onLinked }: { enabled: boolean; disabled: boolean; onBusy: (busy: boolean) => void; onLinked: () => void }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const submitting = useRef(false); const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) summary.current?.focus(); }, [message]);
  async function link() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); onBusy(true); setMessage(null);
    const reserved = window.open('about:blank', 'profile-resident-verification', 'popup,width=520,height=720');
    const attempt = beginAttempt('resident-association');
    let outcome: 'success' | 'error' | 'warning' = 'warning';
    let notice = 'Account linking could not be confirmed. Check account details before trying again.';
    let challenge: string | null = null; let proof: AccountProof | null = null;
    try {
      if (!reserved) throw new Error('Allow the sign-in popup, then try again.');
      // Open a same-origin waiting popup in the user gesture before the server
      // challenge roundtrip, so browsers do not classify it as unsolicited.
      const started = await beginResidentAssociation();
      if (!started.ok) { outcome = 'error'; notice = 'Could not start account linking. Review the details below.'; setMessage(started.message); return; }
      challenge = started.value;
      proof = await openAccountProof('resident', challenge, reserved);
      const finished = await finishResidentAssociation(challenge);
      const current = await readAssociatedResident();
      if (finished.ok || (current.ok && current.value.state === 'linked')) { outcome = 'success'; notice = 'Resident account linked. Accounts and credentials remain separate.'; setMessage('Resident association verified. The accounts and credentials remain separate.'); onLinked(); }
      else setMessage(finished.message);
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Could not establish account ownership. Retry account details before starting again.'); }
    finally {
      proof?.retire();
      if (!proof) reserved?.close();
      if (challenge) {
        try {
          const cleanup = await cancelResidentAssociation(challenge);
          if (!cleanup.ok) { outcome = 'warning'; notice = 'Check account details before linking again. Temporary verification cleanup is incomplete.'; }
          if (!cleanup.ok) setMessage(previous => `${previous ?? ''} Temporary challenge cleanup is incomplete. It expires after five minutes; retry account details before starting again.`);
        } catch { outcome = 'warning'; notice = 'Check account details before linking again. Temporary verification cleanup is incomplete.'; setMessage(previous => `${previous ?? ''} Temporary challenge cleanup is incomplete. It expires after five minutes; retry account details before starting again.`); }
      }
      notify[outcome](notice, { id: attempt });
      submitting.current = false; setBusy(false); onBusy(false);
    }
  }
  return <div className="mt-5"><p className={styles.subtitle}>Linking authenticates an existing resident account in a separate window. It copies no profile information.</p>{!enabled && <p className="mt-3">Account linking is awaiting sign-in provider and callback verification.</p>}{message && <p ref={summary} tabIndex={-1} role="status" className={styles.message}>{message}</p>}<button type="button" disabled={!enabled || disabled || busy} onClick={link} className={`${styles.button} ${styles.primary} mt-4`}>{busy ? 'Verifying ownership…' : 'Link my resident account'}</button></div>;
}
