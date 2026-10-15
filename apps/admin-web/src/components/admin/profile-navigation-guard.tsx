'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { ProfileDialog } from './profile-dialog';

const NavigationContext = createContext<{
  setProfileDirty: (dirty: boolean) => void; setProfileBusy: (busy: boolean) => void;
  requestLeave: (proceed: () => void) => void; blockNavigation: (proceed: () => void) => boolean;
}>({
  setProfileDirty: () => {}, setProfileBusy: () => {}, requestLeave: proceed => proceed(), blockNavigation: () => false,
});

export function ProfileNavigationGuard({ children }: { children: ReactNode }) {
  const dirty = useRef(false);
  const busy = useRef(false);
  const continuation = useRef<(() => void) | null>(null);
  const [prompt, setPrompt] = useState<'dirty' | 'busy' | null>(null);
  const requestLeave = useCallback((proceed: () => void) => {
    if (busy.current) { setPrompt('busy'); return; }
    if (!dirty.current) { proceed(); return; }
    continuation.current = proceed;
    setPrompt('dirty');
  }, []);
  function close() { continuation.current = null; setPrompt(null); }
  const value = useMemo(() => ({ setProfileDirty: (value: boolean) => { dirty.current = value; }, setProfileBusy: (value: boolean) => { busy.current = value; }, requestLeave,
    blockNavigation: (proceed: () => void) => { if (!dirty.current && !busy.current) return false; requestLeave(proceed); return true; } }), [requestLeave]);
  return <NavigationContext.Provider value={value}>
    {children}
    {prompt && <ProfileDialog label={prompt === 'busy' ? 'Profile operation in progress' : 'Discard profile changes?'} onClose={close}>
      <div className="rounded-2xl bg-white p-6 dark:bg-zinc-900">
        <h2 className="text-lg font-semibold">{prompt === 'busy' ? 'Please wait for the current operation' : 'Discard unsaved profile changes?'}</h2>
        <p className="my-4">{prompt === 'busy' ? 'Check its result before leaving or trying again.' : 'Your saved profile will be kept. Unsaved edits will be discarded.'}</p>
        <button type="button" autoFocus onClick={close} className="rounded-lg border px-4 py-3">{prompt === 'busy' ? 'Stay here' : 'Keep editing'}</button>
        {prompt === 'dirty' && <button type="button" onClick={() => { const proceed = continuation.current; dirty.current = false; close(); proceed?.(); }} className="ml-3 rounded-lg bg-[var(--accent)] px-4 py-3 text-white">Discard changes</button>}
      </div>
    </ProfileDialog>}
  </NavigationContext.Provider>;
}

export function useProfileNavigation() { return useContext(NavigationContext); }
